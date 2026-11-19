import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("MICROSOFT_REDIRECT_URI")!;
const ENCRYPTION_KEY = Deno.env.get("BRIX_TOKEN_ENCRYPTION_KEY")!;
const BRIX_ORIGIN = "https://thebetafish.github.io";

const cors = {
  "Access-Control-Allow-Origin": BRIX_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomText(size = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function encryptionBytes() {
  if (!/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) throw new Error("Missing or invalid BRIX_TOKEN_ENCRYPTION_KEY.");
  return new Uint8Array(ENCRYPTION_KEY.match(/.{2}/g)!.map(x => parseInt(x, 16)));
}

async function encrypt(value: string) {
  const key = await crypto.subtle.importKey("raw", encryptionBytes(), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return JSON.stringify({ iv: base64url(iv), data: base64url(new Uint8Array(data)) });
}


async function decrypt(value: string) {
  const parsed = JSON.parse(value) as { iv: string; data: string };
  const decode = (input: string) => {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  };
  const key = await crypto.subtle.importKey("raw", encryptionBytes(), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(parsed.iv) }, key, decode(parsed.data));
  return new TextDecoder().decode(plain);
}

async function getUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization },
  });
  if (!response.ok) return null;
  return await response.json() as { id: string };
}

async function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function loginCloudOffering(gssvToken: string, offeringId: "xgpuweb" | "xgpuwebf2p") {
  const response = await fetch(`https://${offeringId}.gssv-play-prod.xboxlive.com/v2/login/user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, must-revalidate, no-cache",
      "x-gssv-client": "XboxComBrowser",
    },
    body: JSON.stringify({ token: gssvToken, offeringId }),
  });
  const responseText = await response.text().catch(() => "");
  let payload: Record<string, any> = {};
  try {
    const parsed = JSON.parse(responseText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch {
    // Some upstream failures return plain text instead of JSON.
  }

  const readErrorField = (keys: string[]): string | null => {
    const sources = [payload, payload.error, payload.details, payload.data]
      .filter((value) => value && typeof value === "object" && !Array.isArray(value));
    for (const source of sources) {
      for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) return value.trim().slice(0, 240);
        if (typeof value === "number") return String(value);
      }
    }
    return null;
  };

  const code = readErrorField(["code", "errorCode", "error_code", "statusCode", "status"]);
  const message = readErrorField(["message", "error_description", "description", "detail", "reason", "title"])
    ?? (!response.ok && responseText.trim() && !responseText.trim().startsWith("{")
      ? responseText.trim().slice(0, 240)
      : null);

  return {
    ok: response.ok && Boolean(payload.gsToken),
    status: response.status,
    code,
    message,
    bodyPreview: responseText.trim().slice(0, 360) || null,
    contentType: response.headers.get("content-type"),
    requestId: response.headers.get("ms-cv"),
    payload,
  };
}

function resultPage(message: string) {
  const safe = message.replace(/[<>&"]/g, "");
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BRIX Xbox</title></head><body style="font:16px system-ui;background:#101a2a;color:white;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px;text-align:center"><h1>BRIX Xbox Cloud</h1><p>${safe}</p><a style="color:#8bd5ff" href="https://thebetafish.github.io/BRIX/">Return to BRIX</a></main></body></html>`, {
    status: 200,
    headers: { ...cors, "Content-Type": "text/html; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (req.method === "GET" && path.endsWith("/health")) {
    return json({
      service: "brix-xbox-cloud",
      status: "ok",
      capabilities: ["health", "microsoft-oauth", "xbox-live-auth", "xsts-auth", "gssv-xcloud-auth", "xcloud-entitlement-check", "xcloud-entitled-title-catalog", "session-database"],
      streaming: false,
    });
  }

  if (req.method === "POST" && path.endsWith("/oauth/start")) {
    const user = await getUser(req);
    if (!user) return json({ error: "Sign in to BRIX first." }, 401);
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI || !ENCRYPTION_KEY) {
      return json({ error: "Xbox authentication secrets are not configured in Supabase." }, 503);
    }

    const state = randomText(32);
    const verifier = randomText(48);
    const challenge = base64url(await sha256(verifier));
    const saved = await db("brix_xbox_oauth_states", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ state, user_id: user.id, code_verifier: verifier }),
    });
    if (!saved.ok) return json({ error: "Could not start secure Xbox sign-in. Apply the BRIX Xbox SQL setup first." }, 500);

    const authorize = new URL("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
    authorize.search = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      response_mode: "query",
      scope: "XboxLive.signin openid profile offline_access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return json({ authorizationUrl: authorize.toString() });
  }

  if (req.method === "GET" && path.endsWith("/oauth/callback")) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.has("error")) return resultPage("Microsoft sign-in was cancelled or declined. Return to BRIX and try again.");
    if (!code || !state) return resultPage("The Microsoft sign-in response was incomplete.");

    const stateResult = await db(`brix_xbox_oauth_states?state=eq.${encodeURIComponent(state)}&select=state,user_id,code_verifier,expires_at`);
    if (!stateResult.ok) return resultPage("BRIX could not validate this sign-in request.");
    const rows = await stateResult.json();
    const pending = rows[0];
    if (!pending || new Date(pending.expires_at).getTime() < Date.now()) {
      return resultPage("This sign-in request expired. Return to BRIX and try again.");
    }
    await db(`brix_xbox_oauth_states?state=eq.${encodeURIComponent(state)}`, { method: "DELETE" });

    try {
      const tokenForm = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.code_verifier,
      });
      const tokenResponse = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm,
      });
      const microsoft = await tokenResponse.json();
      if (!tokenResponse.ok || !microsoft.access_token) {
        return resultPage("Microsoft did not issue the requested Xbox authorization. Check the app registration and consent.");
      }

      const userResponse = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-xbl-contract-version": "1",
          "Cache-Control": "no-cache",
          "Origin": "https://www.xbox.com",
          "Referer": "https://www.xbox.com/",
        },
        body: JSON.stringify({
          RelyingParty: "http://auth.xboxlive.com",
          TokenType: "JWT",
          Properties: {
            AuthMethod: "RPS",
            SiteName: "user.auth.xboxlive.com",
            RpsTicket: `d=${microsoft.access_token}`,
          },
        }),
      });
      const xboxUser = await userResponse.json();
      if (!userResponse.ok || !xboxUser.Token) {
        return resultPage("Microsoft sign-in worked, but Xbox Live did not issue a user token for this account.");
      }

      const xstsResponse = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-xbl-contract-version": "1" },
        body: JSON.stringify({
          Properties: { SandboxId: "RETAIL", UserTokens: [xboxUser.Token] },
          RelyingParty: "http://xboxlive.com",
          TokenType: "JWT",
        }),
      });
      const xsts = await xstsResponse.json();
      if (!xstsResponse.ok || !xsts.Token) {
        return resultPage("Xbox Live user authentication succeeded, but the XSTS authorization step was rejected.");
      }

      const claims = xsts.DisplayClaims?.xui?.[0] ?? xboxUser.DisplayClaims?.xui?.[0] ?? {};
      const refreshEncrypted = microsoft.refresh_token ? await encrypt(microsoft.refresh_token) : null;
      const xstsEncrypted = await encrypt(xsts.Token);
      const accountSave = await db("brix_xbox_accounts", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: pending.user_id,
          xuid: claims.xuid ?? null,
          user_hash: claims.uhs ?? xboxUser.DisplayClaims?.xui?.[0]?.uhs ?? null,
          gamertag: claims.gtg ?? null,
          refresh_token_enc: refreshEncrypted,
          xsts_token_enc: xstsEncrypted,
          xsts_expires_at: xsts.NotAfter ?? null,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!accountSave.ok) return resultPage("Xbox authenticated, but BRIX could not save the protected account record. Apply the SQL setup.");
      return new Response(null, {
        status: 302,
        headers: { ...cors, Location: `${BRIX_ORIGIN}/BRIX/?xbox_connected=1` },
      });
    } catch {
      return resultPage("The Xbox connection could not be completed. Return to BRIX and try again.");
    }
  }


  if (req.method === "POST" && path.endsWith("/api/xbox/cloud/authenticate")) {
    const user = await getUser(req);
    if (!user) return json({ error: "Sign in to BRIX first." }, 401);
    if (!CLIENT_ID || !CLIENT_SECRET || !ENCRYPTION_KEY) {
      return json({ error: "Xbox authentication secrets are not configured." }, 503);
    }

    try {
      const accountResult = await db(`brix_xbox_accounts?user_id=eq.${user.id}&select=refresh_token_enc`);
      if (!accountResult.ok) return json({ error: "Could not read the protected Xbox account record." }, 502);
      const accountRows = await accountResult.json();
      const storedRefresh = accountRows[0]?.refresh_token_enc;
      if (!storedRefresh) return json({ error: "Reconnect your Microsoft account. BRIX has no stored refresh token." }, 409);

      const refreshToken = await decrypt(storedRefresh);
      const refreshResponse = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "XboxLive.signin openid profile offline_access",
        }),
      });
      const refreshed = await refreshResponse.json();
      if (!refreshResponse.ok || !refreshed.access_token) {
        return json({ error: "Microsoft token refresh failed. Reconnect your Xbox account.", code: refreshed.error ?? "refresh_failed" }, 401);
      }

      const userResponse = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-xbl-contract-version": "1" },
        body: JSON.stringify({
          RelyingParty: "http://auth.xboxlive.com",
          TokenType: "JWT",
          Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${refreshed.access_token}` },
        }),
      });
      const xboxUser = await userResponse.json();
      if (!userResponse.ok || !xboxUser.Token) {
        return json({ error: "Xbox Live rejected the refreshed Microsoft credential." }, 502);
      }

      const gssvXstsResponse = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-xbl-contract-version": "1",
          "Cache-Control": "no-cache",
          "Origin": "https://www.xbox.com",
          "Referer": "https://www.xbox.com/",
          "Accept": "*/*",
          "ms-cv": "0",
        },
        body: JSON.stringify({
          Properties: { SandboxId: "RETAIL", UserTokens: [xboxUser.Token] },
          RelyingParty: "http://gssv.xboxlive.com/",
          TokenType: "JWT",
        }),
      });
      const gssvXsts = await gssvXstsResponse.json();
      if (!gssvXstsResponse.ok || !gssvXsts.Token) {
        const xboxCode = gssvXsts.XErr ?? gssvXsts.Identity ?? "gssv_xsts_rejected";
        return json({ error: "Xbox did not authorize the xCloud service token for this account.", code: String(xboxCode) }, 403);
      }

      // Xbox exposes free-to-play cloud games (including Fortnite) through a
      // separate offering from the Game Pass Ultimate catalog.
      // Keep offering requests sequential. The reference client requests the
      // Game Pass offering first; BRIX also checks F2P explicitly because
      // Fortnite is not guaranteed to be present in the Game Pass catalog.
      const gpuLogin = await loginCloudOffering(gssvXsts.Token, "xgpuweb");
      const f2pLogin = await loginCloudOffering(gssvXsts.Token, "xgpuwebf2p");
      const gpu = gpuLogin.payload;
      const f2p = f2pLogin.payload;
      if (!gpuLogin.ok && !f2pLogin.ok) {
        const serviceCode = gpu.code ?? gpu.errorCode ?? f2p.code ?? f2p.errorCode ?? `gpu_http_${gpuLogin.status}_f2p_http_${f2pLogin.status}`;
        return json({
          authenticated: false,
          entitled: false,
          error: gpu.message || f2p.message || "Xbox did not grant a cloud gaming token for either offering.",
          code: String(serviceCode),
          market: gpu.market ?? f2p.market ?? null,
          offeringStatuses: { gamePass: gpuLogin.status, freeToPlay: f2pLogin.status },
        offeringErrors: {
          gamePass: gpuLogin.ok ? null : { code: gpuLogin.code, message: gpuLogin.message, bodyPreview: gpuLogin.bodyPreview, contentType: gpuLogin.contentType, requestId: gpuLogin.requestId },
          freeToPlay: f2pLogin.ok ? null : { code: f2pLogin.code, message: f2pLogin.message, bodyPreview: f2pLogin.bodyPreview, contentType: f2pLogin.contentType, requestId: f2pLogin.requestId },
        },
        }, 502);
      }

      const nextRefresh = refreshed.refresh_token ?? refreshToken;
      const regions = Array.isArray(gpu.offeringSettings?.regions) ? gpu.offeringSettings.regions : [];
      const f2pRegions = Array.isArray(f2p.offeringSettings?.regions) ? f2p.offeringSettings.regions : [];
      const market = gpu.market ?? f2p.market ?? null;
      const accountUpdate = await db(`brix_xbox_accounts?user_id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          refresh_token_enc: await encrypt(nextRefresh),
          gssv_xsts_token_enc: await encrypt(gssvXsts.Token),
          gs_token_enc: gpu.gsToken ? await encrypt(gpu.gsToken) : null,
          cloud_offering_id: gpu.offeringId ?? "xgpuweb",
          cloud_market: market,
          cloud_regions: regions,
          gs_token_expires_at: gpu.gsToken ? new Date(Date.now() + Number(gpu.durationInSeconds ?? 3600) * 1000).toISOString() : null,
          f2p_gs_token_enc: f2p.gsToken ? await encrypt(f2p.gsToken) : null,
          f2p_cloud_regions: f2pRegions,
          f2p_gs_token_expires_at: f2p.gsToken ? new Date(Date.now() + Number(f2p.durationInSeconds ?? 3600) * 1000).toISOString() : null,
          cloud_authenticated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!accountUpdate.ok) return json({ error: "xCloud authentication succeeded, but BRIX could not save the encrypted stream credentials. Apply the BRIX cloud-auth SQL update." }, 500);

      return json({
        authenticated: true,
        entitled: Boolean(gpu.gsToken || f2p.gsToken),
        offerings: { gamePass: Boolean(gpu.gsToken), freeToPlay: Boolean(f2p.gsToken) },
        offeringStatuses: { gamePass: gpuLogin.status, freeToPlay: f2pLogin.status },
        offeringErrors: {
          gamePass: gpuLogin.ok ? null : { code: gpuLogin.code, message: gpuLogin.message, bodyPreview: gpuLogin.bodyPreview, contentType: gpuLogin.contentType, requestId: gpuLogin.requestId },
          freeToPlay: f2pLogin.ok ? null : { code: f2pLogin.code, message: f2pLogin.message, bodyPreview: f2pLogin.bodyPreview, contentType: f2pLogin.contentType, requestId: f2pLogin.requestId },
        },
        gssvClaims: {
          xuidPresent: Boolean(claims.xuid),
          userHashPresent: Boolean(claims.uhs),
          gamertagPresent: Boolean(claims.gtg),
          xstsExpiryPresent: Boolean(gssvXsts.NotAfter),
        },
        market,
        durationInSeconds: Math.max(Number(gpu.durationInSeconds ?? 0), Number(f2p.durationInSeconds ?? 0)) || null,
        regions: [...regions, ...f2pRegions].map((region: { name?: string; baseUri?: string; isDefault?: boolean }) => ({
          name: region.name ?? null,
          isDefault: Boolean(region.isDefault),
        })),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "xCloud authentication failed." }, 500);
    }
  }


  // Return only the signed-in user's entitled xCloud titles. Stream credentials
  // remain server-side; the browser receives catalog metadata only.
  if (req.method === "GET" && path.endsWith("/api/xbox/cloud/titles")) {
    const user = await getUser(req);
    if (!user) return json({ error: "Sign in to BRIX first." }, 401);

    try {
      const accountResult = await db(`brix_xbox_accounts?user_id=eq.${user.id}&select=user_hash,gs_token_enc,cloud_regions,cloud_market,gs_token_expires_at,f2p_gs_token_enc,f2p_cloud_regions,f2p_gs_token_expires_at`);
      if (!accountResult.ok) return json({ error: "Could not read the protected xCloud account record. Apply the BRIX free-to-play catalog SQL update if the new columns are missing." }, 502);
      const rows = await accountResult.json();
      const account = rows[0];
      if (!account?.user_hash || (!account?.gs_token_enc && !account?.f2p_gs_token_enc)) {
        return json({ error: "Connect Xbox Cloud and check xCloud access before loading your library." }, 409);
      }

      const offerings = [
        { id: "xgpuweb", label: "Game Pass", tokenEnc: account.gs_token_enc, regions: account.cloud_regions, expiresAt: account.gs_token_expires_at },
        { id: "xgpuwebf2p", label: "Free-to-play", tokenEnc: account.f2p_gs_token_enc, regions: account.f2p_cloud_regions, expiresAt: account.f2p_gs_token_expires_at },
      ];
      const attempts: Array<{ offering: string; region: string | null; status: number; auth: string }> = [];
      const allTitles: Array<Record<string, unknown>> = [];
      const successfulRegions: string[] = [];
      let lastStatus = 0;
      let lastRegionHost: string | null = null;
      let lastUpstreamMessage = "";

      for (const offering of offerings) {
        if (!offering.tokenEnc) continue;
        if (offering.expiresAt && new Date(offering.expiresAt).getTime() <= Date.now()) continue;
        const token = await decrypt(offering.tokenEnc);
        const regions = Array.isArray(offering.regions) ? [...offering.regions] : [];
        // Prefer the Xbox-marked default datacenter instead of the first array entry.
        regions.sort((left: { isDefault?: boolean }, right: { isDefault?: boolean }) =>
          Number(Boolean(right?.isDefault)) - Number(Boolean(left?.isDefault))
        );
        let offeringLoaded = false;
        for (const region of regions) {
          const baseUri = typeof region?.baseUri === "string" ? region.baseUri.replace(/\/+$/, "") : "";
          if (!baseUri || !/^https:\/\/[a-z0-9.-]+$/i.test(baseUri)) continue;
          lastRegionHost = new URL(baseUri).host;
          const authHeaders = [
            { label: "XBL3.0", value: `XBL3.0 x=${account.user_hash};${token}` },
            { label: "Bearer", value: `Bearer ${token}` },
          ];
          for (const auth of authHeaders) {
            const response = await fetch(`${baseUri}/v2/titles?mr=25`, {
              headers: {
                Authorization: auth.value,
                "x-xbl-contract-version": "1",
                Accept: "application/json",
                "Cache-Control": "no-store",
              },
            });
            lastStatus = response.status;
            attempts.push({ offering: offering.id, region: region.name ?? null, status: response.status, auth: auth.label });
            if (response.ok) {
              const payload = await response.json();
              if (payload && Array.isArray(payload.results)) {
                for (const item of payload.results as Array<Record<string, unknown>>) {
                  const details = (item.details ?? {}) as Record<string, unknown>;
                  if (!details.hasEntitlement) continue;
                  allTitles.push({ ...item, offering: offering.label });
                }
                successfulRegions.push(`${offering.label}: ${region.name ?? "region"}`);
                offeringLoaded = true;
                break;
              }
            } else {
              const responseText = await response.text();
              try {
                const parsed = JSON.parse(responseText);
                lastUpstreamMessage = String(parsed.message ?? parsed.error_description ?? parsed.error ?? parsed.code ?? "").slice(0, 240);
              } catch {
                lastUpstreamMessage = responseText.slice(0, 240);
              }
            }
            if (response.status !== 401) break;
          }
          if (offeringLoaded) break;
        }
      }

      if (!successfulRegions.length) {
        return json({
          error: "The xCloud title service rejected or could not process either catalog request. Run Check xCloud access again.",
          upstreamStatus: lastStatus || null,
          upstreamHost: lastRegionHost,
          upstreamMessage: lastUpstreamMessage || null,
          attempts,
        }, 502);
      }

      const uniqueTitles = new Map<string, Record<string, unknown>>();
      for (const item of allTitles) {
        const details = (item.details ?? {}) as Record<string, unknown>;
        const titleId = item.titleId;
        if (typeof titleId !== "string") continue;
        const mapped = {
          titleId,
          productId: details.productId ?? null,
          title: details.name ?? titleId,
          description: details.description ?? "",
          supportedInputTypes: details.supportedInputTypes ?? [],
          offering: item.offering,
        };
        if (!uniqueTitles.has(titleId)) uniqueTitles.set(titleId, mapped);
        else if (item.offering === "Free-to-play") uniqueTitles.set(titleId, mapped);
      }
      const titles = [...uniqueTitles.values()];
      return json({
        market: account.cloud_market ?? null,
        region: successfulRegions.join(" · "),
        count: titles.length,
        titles,
        catalogSources: successfulRegions,
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not load the xCloud library." }, 500);
    }
  }

  if (req.method === "GET" && path.endsWith("/api/xbox/account")) {
    const user = await getUser(req);
    if (!user) return json({ error: "Sign in to BRIX first." }, 401);
    const accountResult = await db(`brix_xbox_accounts?user_id=eq.${user.id}&select=xuid,gamertag,connected_at,xsts_expires_at`);
    if (!accountResult.ok) return json({ error: "Could not read Xbox account status." }, 502);
    const accounts = await accountResult.json();
    return accounts.length ? json({ connected: true, ...accounts[0] }) : json({ connected: false });
  }

  return json({ error: "Endpoint not found." }, 404);
});
