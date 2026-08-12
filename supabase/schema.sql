-- APEX Intelligence — initial database schema (Supabase / Postgres)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at in sync
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  sport text not null default 'football',
  season text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger leagues_set_updated_at
before update on public.leagues
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  short_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

create index teams_league_id_idx on public.teams (league_id);

create trigger teams_set_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  kickoff_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'cancelled', 'postponed')),
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index matches_league_id_idx on public.matches (league_id);
create index matches_kickoff_at_idx on public.matches (kickoff_at);
create index matches_home_team_id_idx on public.matches (home_team_id);
create index matches_away_team_id_idx on public.matches (away_team_id);

create trigger matches_set_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- predictions (system / model predictions for a match)
-- ---------------------------------------------------------------------------
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  predicted_outcome text not null
    check (predicted_outcome in ('home', 'draw', 'away')),
  confidence numeric(5, 4) check (confidence >= 0 and confidence <= 1),
  home_win_prob numeric(5, 4) check (home_win_prob >= 0 and home_win_prob <= 1),
  draw_prob numeric(5, 4) check (draw_prob >= 0 and draw_prob <= 1),
  away_win_prob numeric(5, 4) check (away_win_prob >= 0 and away_win_prob <= 1),
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index predictions_match_id_idx on public.predictions (match_id);

create trigger predictions_set_updated_at
before update on public.predictions
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_predictions
-- ---------------------------------------------------------------------------
create table public.user_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  prediction_id uuid references public.predictions (id) on delete set null,
  predicted_outcome text not null
    check (predicted_outcome in ('home', 'draw', 'away')),
  stake numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index user_predictions_user_id_idx on public.user_predictions (user_id);
create index user_predictions_match_id_idx on public.user_predictions (match_id);
create index user_predictions_prediction_id_idx on public.user_predictions (prediction_id);

create trigger user_predictions_set_updated_at
before update on public.user_predictions
for each row
execute function public.set_updated_at();
