-- APEX Data Platform v1 — target Postgres schema
--
-- DESIGN ONLY. Do not apply this file until:
--   1. A dedicated migration is reviewed
--   2. The unused football tables in schema.sql (leagues, teams, matches,
--      predictions, user_predictions) are dropped or migrated
--   3. Collector writes go through a service-role client, not the Next.js UI
--
-- Auth `profiles` in schema.sql stays. This file is the football + product
-- catalogue that those tables never became.
--
-- Scale notes (tens of thousands of users, millions of fixtures over years):
--   - UUID PKs everywhere user-facing; provider ids live in external_ids
--   - Odds and recommendations are append-only snapshots (never mutate history)
--   - Partition fixtures / odds_quotes by kickoff month when volume justifies it
--   - Collector is the only writer of football tables; RLS denies client writes

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'apex_match_status') then
    create type public.apex_match_status as enum (
      'scheduled', 'live', 'finished', 'cancelled', 'postponed', 'suspended', 'unknown'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'apex_market_type') then
    create type public.apex_market_type as enum (
      '1x2', 'over_under', 'btts', 'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'apex_decision_verdict') then
    create type public.apex_decision_verdict as enum (
      'strong_bet', 'bet', 'lean', 'avoid', 'no_bet'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'apex_bet_result') then
    create type public.apex_bet_result as enum (
      'pending', 'won', 'lost', 'void'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'apex_collector_resource') then
    create type public.apex_collector_resource as enum (
      'fixtures', 'odds', 'standings', 'team_statistics',
      'injuries', 'lineups', 'h2h', 'recent_form'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Users (auth.users + profiles already exist). Product prefs only.
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_currency text not null default 'EUR',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Provider identity — never store vendor ids as APEX primary keys
-- ---------------------------------------------------------------------------
create table if not exists public.external_ids (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  entity_type text not null,
  external_id text not null,
  apex_id uuid not null,
  created_at timestamptz not null default now(),
  unique (provider, entity_type, external_id)
);

create index if not exists external_ids_apex_id_idx on public.external_ids (apex_id);
create index if not exists external_ids_lookup_idx
  on public.external_ids (entity_type, provider, external_id);

-- ---------------------------------------------------------------------------
-- Leagues / seasons / teams
-- ---------------------------------------------------------------------------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  sport text not null default 'football',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null,
  year_start smallint not null,
  year_end smallint,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, year_start)
);

create index if not exists seasons_league_id_idx on public.seasons (league_id);
create index if not exists seasons_current_idx on public.seasons (league_id) where is_current;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  country text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_name_idx on public.teams (name);

create table if not exists public.season_teams (
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, team_id)
);

-- ---------------------------------------------------------------------------
-- Fixtures (matches)
-- ---------------------------------------------------------------------------
create table if not exists public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons (id) on delete set null,
  league_id uuid references public.leagues (id) on delete set null,
  home_team_id uuid not null references public.teams (id) on delete restrict,
  away_team_id uuid not null references public.teams (id) on delete restrict,
  kickoff_at timestamptz not null,
  status public.apex_match_status not null default 'scheduled',
  home_score smallint,
  away_score smallint,
  ht_home_score smallint,
  ht_away_score smallint,
  minute smallint,
  venue_name text,
  venue_city text,
  referee text,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index if not exists fixtures_kickoff_at_idx on public.fixtures (kickoff_at);
create index if not exists fixtures_status_kickoff_idx on public.fixtures (status, kickoff_at);
create index if not exists fixtures_league_kickoff_idx on public.fixtures (league_id, kickoff_at);
create index if not exists fixtures_home_team_idx on public.fixtures (home_team_id, kickoff_at desc);
create index if not exists fixtures_away_team_idx on public.fixtures (away_team_id, kickoff_at desc);
create index if not exists fixtures_season_idx on public.fixtures (season_id);

-- Finished fixtures are the historical store (cache policy: permanent).
-- Recent-form / H2H queries use these indexes, not extra vendor pulls.

-- ---------------------------------------------------------------------------
-- Standings (snapshot per team per season; overwrite on collect)
-- ---------------------------------------------------------------------------
create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  rank smallint not null,
  points smallint not null,
  played smallint not null default 0,
  won smallint not null default 0,
  drawn smallint not null default 0,
  lost smallint not null default 0,
  goals_for smallint not null default 0,
  goals_against smallint not null default 0,
  form text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, team_id)
);

create index if not exists standings_season_rank_idx on public.standings (season_id, rank);

-- ---------------------------------------------------------------------------
-- Markets (catalogue) + odds (append-only quotes)
-- ---------------------------------------------------------------------------
create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  market_type public.apex_market_type not null,
  name text not null,
  line numeric(8, 3),
  created_at timestamptz not null default now(),
  unique (market_type, name, line)
);

create table if not exists public.odds_quotes (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete restrict,
  bookmaker text,
  captured_at timestamptz not null,
  source_provider text not null,
  created_at timestamptz not null default now()
);

create index if not exists odds_quotes_fixture_captured_idx
  on public.odds_quotes (fixture_id, captured_at desc);
create index if not exists odds_quotes_market_idx on public.odds_quotes (market_id);

create table if not exists public.odds_selections (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.odds_quotes (id) on delete cascade,
  selection_key text not null,
  label text not null,
  decimal_odds numeric(8, 3),
  implied_probability numeric(8, 6),
  created_at timestamptz not null default now()
);

create index if not exists odds_selections_quote_idx on public.odds_selections (quote_id);

-- ---------------------------------------------------------------------------
-- Predictions = Probability Engine 1X2 (not a betting recommendation)
-- ---------------------------------------------------------------------------
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  model_version text not null,
  home_win_prob numeric(8, 6) not null,
  draw_prob numeric(8, 6) not null,
  away_win_prob numeric(8, 6) not null,
  confidence numeric(8, 6),
  created_at timestamptz not null default now(),
  check (home_win_prob + draw_prob + away_win_prob between 0.99 and 1.01)
);

create index if not exists predictions_fixture_created_idx
  on public.predictions (fixture_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Recommendations = Decision Engine only (verdict, EV, Kelly, APEX score)
-- ---------------------------------------------------------------------------
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  prediction_id uuid references public.predictions (id) on delete set null,
  engine_version text not null,
  side text,
  verdict public.apex_decision_verdict not null,
  apex_score numeric(6, 2),
  model_probability numeric(8, 6),
  decimal_odds numeric(8, 3),
  expected_value numeric(10, 6),
  kelly_fraction numeric(10, 6),
  stake_pct numeric(8, 4),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_fixture_created_idx
  on public.recommendations (fixture_id, created_at desc);
create index if not exists recommendations_verdict_idx
  on public.recommendations (verdict, created_at desc);

-- ---------------------------------------------------------------------------
-- Match ratings — persist Match Rating output until UI reads recommendations
-- ---------------------------------------------------------------------------
create table if not exists public.match_ratings (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  apex_score numeric(6, 2) not null,
  action text,
  expected_value numeric(10, 6),
  kelly_fraction numeric(10, 6),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_ratings_fixture_idx
  on public.match_ratings (fixture_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Bankroll / bets / portfolio
-- ---------------------------------------------------------------------------
create table if not exists public.bankroll_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency text not null default 'EUR',
  initial_bankroll numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bankroll_accounts (id) on delete cascade,
  fixture_id uuid references public.fixtures (id) on delete set null,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  placed_at timestamptz not null,
  market text not null,
  selection text,
  decimal_odds numeric(8, 3) not null,
  stake numeric(14, 2) not null,
  result public.apex_bet_result not null default 'pending',
  profit numeric(14, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bets_account_placed_idx on public.bets (account_id, placed_at desc);
create index if not exists bets_fixture_idx on public.bets (fixture_id);
create index if not exists bets_result_idx on public.bets (account_id, result);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bankroll_accounts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  current_bankroll numeric(14, 2) not null,
  active_exposure numeric(14, 2) not null default 0,
  health_score numeric(6, 2),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_snapshots_account_idx
  on public.portfolio_snapshots (account_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- Watchlist
-- ---------------------------------------------------------------------------
create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, fixture_id)
);

create index if not exists watchlist_user_idx on public.watchlist_items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Opportunities — materialized Decision Engine rows for the scan board
-- ---------------------------------------------------------------------------
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  recommendation_id uuid not null references public.recommendations (id) on delete cascade,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  rank_score numeric(8, 4),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (fixture_id, recommendation_id)
);

create index if not exists opportunities_published_idx
  on public.opportunities (published_at desc);
create index if not exists opportunities_rank_idx
  on public.opportunities (rank_score desc nulls last);

-- ---------------------------------------------------------------------------
-- News (no vendor today — table reserved, Collector must not invent rows)
-- ---------------------------------------------------------------------------
create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  headline text not null,
  url text,
  published_at timestamptz,
  fixture_id uuid references public.fixtures (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  body text,
  created_at timestamptz not null default now()
);

create index if not exists news_items_published_idx on public.news_items (published_at desc);

-- ---------------------------------------------------------------------------
-- Feed — materialized desk islands (not a live vendor wire)
-- ---------------------------------------------------------------------------
create table if not exists public.feed_items (
  id uuid primary key default gen_random_uuid(),
  island text not null,
  fixture_id uuid references public.fixtures (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete cascade,
  rank smallint,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists feed_items_island_rank_idx
  on public.feed_items (island, rank, generated_at desc);

-- ---------------------------------------------------------------------------
-- Collector watermarks — prevent duplicate vendor pulls
-- ---------------------------------------------------------------------------
create table if not exists public.collector_watermarks (
  resource public.apex_collector_resource not null,
  scope_key text not null,
  last_collected_at timestamptz not null,
  last_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (resource, scope_key)
);

-- ---------------------------------------------------------------------------
-- RLS sketch (apply in a later migration)
--   football catalogue: authenticated SELECT; service role INSERT/UPDATE
--   bankroll/bets/watchlist/user_settings: owner-only
--   news/feed: authenticated SELECT
-- ---------------------------------------------------------------------------
