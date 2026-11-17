-- Add a separately encrypted session token and region list for Xbox's free-to-play cloud offering.
-- This is required for free-to-play cloud titles such as Fortnite.
ALTER TABLE public.brix_xbox_accounts
  ADD COLUMN IF NOT EXISTS f2p_gs_token_enc text,
  ADD COLUMN IF NOT EXISTS f2p_cloud_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS f2p_gs_token_expires_at timestamptz;
