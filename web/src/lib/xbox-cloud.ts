/**
 * BRIX's Xbox Cloud integration talks to a trusted server-side adapter.
 *
 * Microsoft/Xbox tokens must never be stored in localStorage, exposed in
 * VITE_* variables, or sent to this browser module. The adapter owns OAuth
 * token exchange, Xbox session creation, and WebRTC signalling.
 */
export type XboxCloudHealth = {
  service: "brix-xbox-cloud";
  status: "ok";
  capabilities: string[];
};

export type XboxCloudConnection =
  | { state: "unconfigured"; message: string }
  | { state: "checking"; message: string }
  | { state: "online"; message: string; health: XboxCloudHealth }
  | { state: "offline"; message: string };

const configuredBaseUrl = (import.meta.env.VITE_XBOX_CLOUD_API_URL as string | undefined)?.trim().replace(/\/+$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isXboxCloudConfigured(): boolean {
  return Boolean(configuredBaseUrl);
}

export async function checkXboxCloudHealth(): Promise<XboxCloudConnection> {
  if (!configuredBaseUrl) {
    return { state: "unconfigured", message: "The BRIX Xbox Cloud service URL has not been configured." };
  }

  try {
    const response = await fetch(`${configuredBaseUrl}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } : {}),
      },
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      return { state: "offline", message: `The BRIX Xbox Cloud service returned HTTP ${response.status}.` };
    }
    const health = await response.json() as Partial<XboxCloudHealth>;
    if (health.service !== "brix-xbox-cloud" || health.status !== "ok" || !Array.isArray(health.capabilities)) {
      return { state: "offline", message: "The configured server did not identify itself as a compatible BRIX Xbox Cloud service." };
    }
    return { state: "online", message: "The BRIX Xbox Cloud service is reachable.", health: health as XboxCloudHealth };
  } catch {
    return { state: "offline", message: "Could not reach the BRIX Xbox Cloud service. Check its URL, deployment, and CORS settings." };
  }
}
