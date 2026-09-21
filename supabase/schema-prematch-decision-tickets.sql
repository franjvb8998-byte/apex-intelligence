-- APEX Prematch Decision Tickets — immutable historical evidence.
-- Apply in Supabase SQL editor after schema.sql.
-- Do not apply schema-data-platform-v1.sql.
-- Does not alter prediction_journal, PE tables, or auth.

create table if not exists public.prematch_decision_tickets (
  ticket_id text primary key,
  fixture_id text not null,
  schema_version text not null,
  kickoff_utc timestamptz not null,
  captured_at_utc timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint prematch_decision_tickets_fixture_id_key unique (fixture_id)
);

create index if not exists prematch_decision_tickets_kickoff_utc_idx
  on public.prematch_decision_tickets (kickoff_utc);

create index if not exists prematch_decision_tickets_captured_at_utc_idx
  on public.prematch_decision_tickets (captured_at_utc);

alter table public.prematch_decision_tickets enable row level security;

drop policy if exists prematch_decision_tickets_select_authenticated
  on public.prematch_decision_tickets;
create policy prematch_decision_tickets_select_authenticated
  on public.prematch_decision_tickets
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.prematch_decision_tickets from anon, authenticated;
grant select on public.prematch_decision_tickets to authenticated;

-- No UPDATE trigger. Rows are insert-only historical evidence.
-- Trusted writes: service-role server client (bypasses RLS). Never expose
-- that key to the browser.
