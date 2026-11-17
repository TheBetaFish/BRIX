-- BRIX xCloud GSSV authentication storage extension
-- Run in Supabase SQL Editor after the original brix-xbox-auth.sql.

ALTER TABLE public.brix_xbox_accounts
  ADD COLUMN IF NOT EXISTS gssv_xsts_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS gs_token_enc TEXT,
  ADD COLUMN IF NOT EXISTS cloud_offering_id TEXT,
  ADD COLUMN IF NOT EXISTS cloud_market TEXT,
  ADD COLUMN IF NOT EXISTS cloud_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gs_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cloud_authenticated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.brix_xbox_accounts.gssv_xsts_token_enc IS
  'Encrypted XSTS token scoped to the GSSV xCloud relying party. Server-only.';
COMMENT ON COLUMN public.brix_xbox_accounts.gs_token_enc IS
  'Encrypted xCloud gsToken used for session API requests. Server-only.';
COMMENT ON COLUMN public.brix_xbox_accounts.cloud_regions IS
  'Region metadata returned by the xCloud offering login; contains no credentials.';
