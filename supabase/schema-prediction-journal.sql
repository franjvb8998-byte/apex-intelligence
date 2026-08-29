-- APEX Prediction Journal MVP
-- Append-friendly journal of Decision Engine recommendations.
-- Apply in Supabase SQL editor after schema.sql.
-- Does not alter Decision Engine tables or the unused public.predictions shape.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'apex_prediction_journal_status') then
    create type public.apex_prediction_journal_status as enum (
      'PENDING',
      'SETTLED',
      'VOID'
    );
  end if;
end$$;

create table if not exists public.prediction_journal (
  id text primary key,
  fixture_id text not null,
  league text not null,
  season text,
  home_team text not null,
  away_team text not null,
  market text not null,
  recommendation text not null,
  bookmaker_odds numeric,
  model_probability numeric,
  fair_odds numeric,
  expected_value numeric,
  confidence numeric,
  risk text not null,
  apex_score numeric not null,
  decision jsonb not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  status public.apex_prediction_journal_status not null default 'PENDING',
  updated_at timestamptz not null default now()
);

create unique index if not exists prediction_journal_id_uidx
  on public.prediction_journal (id);

create unique index if not exists prediction_journal_pending_fixture_market_uidx
  on public.prediction_journal (fixture_id, market)
  where status = 'PENDING';

create index if not exists prediction_journal_fixture_id_idx
  on public.prediction_journal (fixture_id);

create index if not exists prediction_journal_status_created_at_idx
  on public.prediction_journal (status, created_at desc);

create index if not exists prediction_journal_league_idx
  on public.prediction_journal (league);

create index if not exists prediction_journal_created_at_idx
  on public.prediction_journal (created_at desc);

drop trigger if exists prediction_journal_set_updated_at on public.prediction_journal;
create trigger prediction_journal_set_updated_at
before update on public.prediction_journal
for each row
execute function public.set_updated_at();

alter table public.prediction_journal enable row level security;

drop policy if exists prediction_journal_select_authenticated on public.prediction_journal;
create policy prediction_journal_select_authenticated
  on public.prediction_journal
  for select
  to authenticated
  using (true);

drop policy if exists prediction_journal_write_authenticated on public.prediction_journal;
create policy prediction_journal_write_authenticated
  on public.prediction_journal
  for all
  to authenticated
  using (true)
  with check (true);
