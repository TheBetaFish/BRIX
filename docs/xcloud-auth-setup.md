# BRIX xCloud authentication setup

The BRIX Edge Function now has a server-side xCloud authentication check. It uses the Microsoft refresh token already stored by the BRIX OAuth flow, obtains an Xbox XSTS token scoped to the GSSV service, then exchanges it for an xCloud `gsToken`.

## Apply the database migration

In the Supabase Dashboard, open **SQL Editor**, create a query, and run the complete contents of:

`supabase/sql/brix-xcloud-auth.sql`

This adds encrypted token columns and non-secret region metadata to `public.brix_xbox_accounts`.

## Deploy the Edge Function

Replace the deployed `brix-xbox-cloud` function with the current contents of:

`supabase/functions/brix-xbox-cloud/index.ts`

Keep gateway JWT verification disabled. The function validates the BRIX bearer token itself on protected routes; the Microsoft OAuth callback uses state and PKCE.

## Test from BRIX

After deploying the function and applying the migration:

1. Open BRIX and sign in.
2. Open the account menu.
3. Confirm Xbox Cloud Gaming shows your linked gamertag.
4. Click **Check xCloud access**.

A successful response means the xCloud authentication endpoint issued a stream token and returned offering region metadata. It does **not** mean a game session has been created or that streaming is working yet.

A 403 response may mean the account is not entitled to the xCloud XGPU offering, the market is unsupported, or Microsoft rejected the request. The endpoint intentionally does not attempt region or entitlement bypasses.

## Security

Microsoft refresh tokens, GSSV XSTS tokens, and xCloud `gsToken` values are encrypted with `BRIX_TOKEN_ENCRYPTION_KEY` and remain server-side. The browser receives only the authentication result, market, and region names.
