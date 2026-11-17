# BRIX Xbox authentication setup

This adds a separate Xbox Live authorization flow. The existing Supabase Azure identity link is not reused as an Xbox token.

## 1. Apply the SQL

Open Supabase → SQL Editor → New query. Copy and run:

`supabase/sql/brix-xbox-auth.sql`

Then generate a 256-bit encryption key:

```sql
select encode(gen_random_bytes(32), 'hex') as brix_token_encryption_key;
```

Copy the returned 64-character value. Treat it as a password. Do not put it in GitHub or this repository.

## 2. Add the Microsoft redirect URI

In the existing Microsoft Entra app registration, add a **Web** platform redirect URI:

`https://ufqcoqawkenitwecyglr.supabase.co/functions/v1/brix-xbox-cloud/oauth/callback`

Keep the existing Supabase callback URI as well. The app must support personal Microsoft accounts. Create a new client secret if the old secret has expired; copy its value immediately.

## 3. Add Supabase Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret name | Value |
|---|---|
| `MICROSOFT_CLIENT_ID` | Application (client) ID from the Entra app |
| `MICROSOFT_CLIENT_SECRET` | Client secret value from Entra |
| `MICROSOFT_REDIRECT_URI` | Exact callback URI above |
| `BRIX_TOKEN_ENCRYPTION_KEY` | The 64-character SQL-generated key |

Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

Never paste client secrets, encryption keys, or tokens into ChatGPT or GitHub.

## 4. Deploy the function

Replace the Dashboard editor contents for `brix-xbox-cloud` with:

`supabase/functions/brix-xbox-cloud/index.ts`

Then deploy the function.

In the function's settings, turn **Verify JWT** off. The OAuth callback is a public redirect endpoint; the function separately verifies the BRIX user's bearer token on `/oauth/start` and `/api/xbox/account`. The callback validates a one-time state value and PKCE verifier before exchanging the authorization code.

## 5. Test

Open BRIX → Account → Connect Xbox Cloud. Complete Microsoft consent. BRIX should return to the Account page and show Xbox Cloud as connected.

## Scope and limitation

This implements Microsoft OAuth, Xbox user-token exchange, XSTS authentication, and encrypted server-side token storage. It does **not** implement xCloud session allocation or WebRTC media streaming. Xbox service sign-in is not itself a public consumer cloud-streaming API.
