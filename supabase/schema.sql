-- BRIX initial database schema
-- Run this in Supabase Dashboard -> SQL Editor.
-- All user-owned tables are protected by Row Level Security.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark', 'metallic')),
  updated_at timestamptz not null default now()
);

create table if not exists public.local_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  description text not null default '',
  launch_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, title)
);

create table if not exists public.favorite_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.local_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.recent_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.local_games(id) on delete cascade,
  played_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.local_games enable row level security;
alter table public.favorite_games enable row level security;
alter table public.recent_games enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can manage their own settings" on public.user_settings;
create policy "Users can manage their own settings" on public.user_settings
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own local games" on public.local_games;
create policy "Users can manage their own local games" on public.local_games
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own favorites" on public.favorite_games;
create policy "Users can manage their own favorites" on public.favorite_games
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own recent games" on public.recent_games;
create policy "Users can manage their own recent games" on public.recent_games
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Create a profile and default settings automatically after a user registers.
create or replace function public.handle_new_brix_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_brix_auth_user_created on auth.users;
create trigger on_brix_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_brix_user();
