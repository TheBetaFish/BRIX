import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://thebetafish.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  return await response.json() as { id: string; email?: string };
}

async function database(path: string, init: RequestInit = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (req.method === "GET" && path.endsWith("/health")) {
    return json({
      service: "brix-xbox-cloud",
      status: "ok",
      capabilities: ["health", "authenticated-account", "session-database"],
      streaming: false,
      message: "Backend online. Xbox session allocation and streaming are not connected yet.",
    });
  }

  const user = await authenticatedUser(req);
  if (!user) return json({ error: "Sign in to BRIX to use this endpoint." }, 401);

  if (req.method === "GET" && path.endsWith("/api/xbox/account")) {
    return json({ connected: false, userId: user.id, message: "Xbox-specific authorization is not configured. A linked Supabase Microsoft identity is not an Xbox session." });
  }

  if (req.method === "POST" && path.endsWith("/api/xbox/sessions")) {
    let body: { game_id?: string; game_name?: string };
    try { body = await req.json(); } catch { return json({ error: "Expected a JSON request body." }, 400); }
    if (!body.game_id || !body.game_name || body.game_name.length > 120) {
      return json({ error: "game_id and game_name are required." }, 400);
    }
    const inserted = await database("brix_xbox_sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        game_id: body.game_id,
        game_name: body.game_name,
        status: "pending",
      }),
    });
    if (!inserted.ok) return json({ error: "Could not create the session record." }, 502);
    const rows = await inserted.json();
    return json({ session: rows[0], streaming: false, message: "Session record created; Xbox streaming is not yet implemented." }, 202);
  }

  const sessionMatch = path.match(/\/api\/xbox\/sessions\/([0-9a-f-]{36})$/i);
  if (sessionMatch && (req.method === "GET" || req.method === "DELETE")) {
    const sessionId = sessionMatch[1];
    if (req.method === "GET") {
      const result = await database(`brix_xbox_sessions?id=eq.${sessionId}&user_id=eq.${user.id}&select=id,game_id,game_name,status,created_at,updated_at,expires_at`);
      if (!result.ok) return json({ error: "Could not read the session." }, 502);
      const rows = await result.json();
      return rows.length ? json({ session: rows[0] }) : json({ error: "Session not found." }, 404);
    }
    const result = await database(`brix_xbox_sessions?id=eq.${sessionId}&user_id=eq.${user.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "ended" }),
    });
    if (!result.ok) return json({ error: "Could not end the session." }, 502);
    const rows = await result.json();
    return rows.length ? json({ session: rows[0] }) : json({ error: "Session not found." }, 404);
  }

  return json({ error: "Endpoint not found." }, 404);
});
