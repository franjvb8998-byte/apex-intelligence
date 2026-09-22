-- APEX Final Fixture Evidence — immutable observed results.
-- Apply in Supabase SQL editor after schema-prematch-decision-tickets.sql.
-- Additive. Does not alter prematch_decision_tickets, PE tables, or auth.

create table if not exists public.fixture_final_evidence (
  evidence_id text primary key,
  fixture_id text not null,
  ticket_id text null references public.prematch_decision_tickets (ticket_id),
  schema_version text not null,
  observation_revision integer not null,
  observed_at_utc timestamptz not null,
  source text not null,
  vendor_status_short text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint fixture_final_evidence_revision_positive
    check (observation_revision >= 1),
  constraint fixture_final_evidence_fixture_revision_key
    unique (fixture_id, observation_revision)
);

create unique index if not exists fixture_final_evidence_canonical_fixture_uidx
  on public.fixture_final_evidence (fixture_id)
  where observation_revision = 1;

create index if not exists fixture_final_evidence_fixture_id_idx
  on public.fixture_final_evidence (fixture_id);

create index if not exists fixture_final_evidence_observed_at_utc_idx
  on public.fixture_final_evidence (observed_at_utc);

create index if not exists fixture_final_evidence_vendor_status_idx
  on public.fixture_final_evidence (vendor_status_short);

alter table public.fixture_final_evidence enable row level security;

drop policy if exists fixture_final_evidence_select_authenticated
  on public.fixture_final_evidence;
create policy fixture_final_evidence_select_authenticated
  on public.fixture_final_evidence
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.fixture_final_evidence from anon, authenticated;
grant select on public.fixture_final_evidence to authenticated;

-- No UPDATE trigger. Revision 1 is first-write-wins. Later differing
-- observations insert observation_revision 2+. Never overwrite.
-- Trusted writes: service-role server client. Never expose that key.
