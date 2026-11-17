-- BRIX Xbox authentication storage
-- Run this in Supabase SQL Editor. This does not alter existing session records.

CREATE TABLE IF NOT EXISTS public.brix_xbox_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS brix_xbox_oauth_states_expires_idx
  ON public.brix_xbox_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS public.brix_xbox_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xuid TEXT,
  user_hash TEXT,
  gamertag TEXT,
  refresh_token_enc TEXT,
  xsts_token_enc TEXT,
  xsts_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.brix_xbox_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brix_xbox_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.brix_xbox_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.brix_xbox_accounts FROM anon, authenticated;

GRANT ALL ON public.brix_xbox_oauth_states TO service_role;
GRANT ALL ON public.brix_xbox_accounts TO service_role;

COMMENT ON TABLE public.brix_xbox_oauth_states IS
  'Short-lived one-time OAuth state and PKCE verifier for BRIX Xbox sign-in.';
COMMENT ON TABLE public.brix_xbox_accounts IS
  'Server-only Xbox account metadata and encrypted tokens. Token columns must never be exposed to browser clients.';
