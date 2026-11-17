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
      capabilities: ["health", "microsoft-oauth", "xbox-live-auth", "xsts-auth", "gssv-xcloud-auth", "xcloud-entitlement-check", "session-database"],
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
      scope: "XboxLive.signin XboxLive.offline_access",
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
        headers: { "Content-Type": "application/json", "x-xbl-contract-version": "1" },
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
          scope: "XboxLive.signin XboxLive.offline_access",
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
        headers: { "Content-Type": "application/json", "x-xbl-contract-version": "1" },
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

      const cloudLoginResponse = await fetch("https://xgpuweb.gssv-play-prod.xboxlive.com/v2/login/user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, must-revalidate, no-cache",
          "x-gssv-client": "XboxComBrowser",
        },
        body: JSON.stringify({ token: gssvXsts.Token, offeringId: "xgpuweb" }),
      });
      const cloudLogin = await cloudLoginResponse.json();
      if (!cloudLoginResponse.ok || !cloudLogin.gsToken) {
        const serviceCode = cloudLogin.code ?? cloudLogin.errorCode ?? `http_${cloudLoginResponse.status}`;
        return json({
          authenticated: false,
          entitled: false,
          error: cloudLogin.message || "The xCloud service did not grant an XGPU session token.",
          code: String(serviceCode),
          market: cloudLogin.market ?? null,
        }, cloudLoginResponse.status === 403 ? 403 : 502);
      }

      const nextRefresh = refreshed.refresh_token ?? refreshToken;
      const regions = cloudLogin.offeringSettings?.regions ?? [];
      const accountUpdate = await db(`brix_xbox_accounts?user_id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          refresh_token_enc: await encrypt(nextRefresh),
          gssv_xsts_token_enc: await encrypt(gssvXsts.Token),
          gs_token_enc: await encrypt(cloudLogin.gsToken),
          cloud_offering_id: cloudLogin.offeringId ?? "xgpuweb",
          cloud_market: cloudLogin.market ?? null,
          cloud_regions: regions,
          gs_token_expires_at: new Date(Date.now() + Number(cloudLogin.durationInSeconds ?? 3600) * 1000).toISOString(),
          cloud_authenticated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!accountUpdate.ok) return json({ error: "xCloud authentication succeeded, but BRIX could not save the encrypted stream credentials. Apply the BRIX cloud-auth SQL update." }, 500);

      return json({
        authenticated: true,
        entitled: true,
        offeringId: cloudLogin.offeringId ?? "xgpuweb",
        market: cloudLogin.market ?? null,
        durationInSeconds: cloudLogin.durationInSeconds ?? null,
        regions: regions.map((region: { name?: string; baseUri?: string; isDefault?: boolean }) => ({
          name: region.name ?? null,
          isDefault: Boolean(region.isDefault),
        })),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "xCloud authentication failed." }, 500);
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
