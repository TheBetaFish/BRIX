# BRIX Xbox Cloud integration

BRIX is a static React application hosted on GitHub Pages. It cannot safely perform the complete Xbox token exchange or hold long-lived Xbox credentials in browser storage. The custom BRIX interface and in-browser player remain the frontend; a trusted server-side adapter is required for the authentication and session-control plane.

## Frontend configuration

Set this GitHub Actions build variable (or local `web/.env` value):

```env
VITE_XBOX_CLOUD_API_URL=https://your-brix-xbox-service.example
```

The frontend health check expects `GET /health` and a JSON response:

```json
{
  "service": "brix-xbox-cloud",
  "status": "ok",
  "capabilities": ["xbox-auth", "catalog", "sessions", "webrtc"]
}
```

The frontend currently uses this endpoint only to verify service availability. It does not claim that Xbox authentication or streaming works when the health check succeeds.

## Required server-side responsibilities

- Microsoft authorization using a registered OAuth application and authorization-code flow with PKCE.
- Xbox Live user-token and XSTS exchange on the trusted server side.
- Secure session storage and refresh/revocation handling. Do not log tokens.
- Xbox Cloud Gaming catalog and offering discovery.
- Cloud session allocation and the service-specific WebRTC signalling flow.
- Authenticated endpoints for account status, catalog, session creation, session state, and session termination.
- Strict CORS allowlisting for the BRIX deployment origin, CSRF protections for cookie-authenticated actions, rate limiting, and per-user authorization.

The Microsoft identity currently linked through Supabase is an account-linking identity, not an Xbox Live access token. Its existing `email` scope is intentionally not repurposed as Xbox authorization.

## Proposed session API contract

- `GET /health`
- `GET /api/xbox/account`
- `GET /api/xbox/catalog`
- `POST /api/xbox/sessions` with a BRIX catalog game identifier
- `GET /api/xbox/sessions/:sessionId`
- `DELETE /api/xbox/sessions/:sessionId`

Session creation must return only the client-safe WebRTC negotiation data needed by the player. It must never return Microsoft refresh tokens, Xbox user tokens, or XSTS tokens.

## Current implementation boundary

This repository contains the frontend service-health client and this integration contract. It does not yet contain the server-side Xbox authentication/session adapter or a working WebRTC player. A reachable health endpoint is a prerequisite, not proof that a game can launch.
