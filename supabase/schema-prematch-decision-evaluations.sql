-- APEX Prematch Decision Evaluations — immutable ticket-vs-evidence scores.
-- Apply after schema-prematch-decision-tickets.sql and
-- schema-fixture-final-evidence.sql.
-- Additive. Does not alter ticket payload or PE / calibration tables.

create table if not exists public.prematch_decision_evaluations (
  evaluation_id text primary key,
  ticket_id text not null references public.prematch_decision_tickets (ticket_id),
  fixture_id text not null,
  evidence_id text not null references public.fixture_final_evidence (evidence_id),
  evidence_revision integer not null,
  schema_version text not null,
  settlement_policy_version text not null,
  evaluated_at_utc timestamptz not null,
  final_status text not null,
  evaluation_state text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint prematch_decision_evaluations_revision_positive
    check (evidence_revision >= 1),
  constraint prematch_decision_evaluations_identity_key
    unique (ticket_id, settlement_policy_version, evidence_revision)
);

create index if not exists prematch_decision_evaluations_fixture_id_idx
  on public.prematch_decision_evaluations (fixture_id);

create index if not exists prematch_decision_evaluations_evaluated_at_utc_idx
  on public.prematch_decision_evaluations (evaluated_at_utc);

create index if not exists prematch_decision_evaluations_final_status_idx
  on public.prematch_decision_evaluations (final_status);

alter table public.prematch_decision_evaluations enable row level security;

drop policy if exists prematch_decision_evaluations_select_authenticated
  on public.prematch_decision_evaluations;
create policy prematch_decision_evaluations_select_authenticated
  on public.prematch_decision_evaluations
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.prematch_decision_evaluations
  from anon, authenticated;
grant select on public.prematch_decision_evaluations to authenticated;

-- Markets live inside payload jsonb. No per-market SQL columns.
-- Identity is ticket + settlement_policy_version + evidence_revision.
-- Duplicate inserts are first-write-wins. No UPDATE/UPSERT.
-- Trusted writes: service-role server client. Never expose that key.
-- Default historical view uses evidence_revision = 1.
