# PE-4I.2 — Offline Multi-Competition + Match-Statistics Acquisition Infrastructure

**HEAD base:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Protocol:** `pe4.offline_multi_comp_stats_acquisition.v1`  
**Mode:** plan / dry-run only in this phase (**0 provider calls**)

## Purpose

Build safe, resumable, quota-bounded **offline** acquisition machinery for future PE-4 form research:

1. Multi-competition team schedules (`GET /fixtures?team&season`)
2. Per-fixture match statistics (`GET /fixtures/statistics`)

This phase does **not** contact API-Football.

## Architecture

```
lib/debug/calibration/pe4-acquisition/
  protocol.ts              frozen seasons, roster, holdout firewall
  competition-registry.ts  id-evidenced classifier (39=PL only)
  envelopes.ts             raw schedule + statistics contracts
  dedupe.ts                fixture-id identity + conflict fail-closed
  temporal.ts              kickoff(M) < kickoff(T) helpers
  statistics-discovery.ts  raw field inventory; xG UNKNOWN
  budget.ts                hard maxCalls (no unlimited)
  transport.ts             injectable / fake / refusing transports
  normalize.ts             provider payload → raw envelopes
  cache.ts                 gitignored content-addressed cache
  planner.ts               deterministic pre-execution plan
  acquire-unit.ts          single-unit acquire (tests / future live)
  dry-run.ts               default zero-call path
  fail-closed.ts           matrix
  pe4i2.acquisition.test.ts
CLI: run-pe4i2-acquisition-plan.ts
Cache root: data/calibration/pe4-acquisition-v1/  (gitignored)
```

## Raw contracts

**Schedule envelope** stores provider team/season request provenance, paging completeness, and per-fixture identity fields (competition id/name, kickoff, status, teams, goals). Competition class is attached but does **not** alter identity.

**Statistics envelope** stores per-team raw statistic names/values with explicit `valuePresence: present|missing`. Missing ≠ zero.

Derived features are **out of scope** for I.2.

## Competition registry

Only provider competition id **39** (Premier League) is classified from in-repo evidence.  
All other ids remain `unknown_competition` and are **preserved**.  
Name hints (FA Cup, UCL, …) are diagnostic only and never upgrade classification.

## Cache + resume

- Manifest with completed / failed / retryable units + digest
- Atomic JSON writes
- Conflicting digest → `Pe4I2CacheConflictError` (no silent overwrite)
- Resume skips completed units (cache hits do not consume budget attempts)

## Call budget

- `maxCalls` required
- Every provider attempt increments `attempted`
- Exhaustion throws `Pe4I2BudgetExhaustedError`
- Dry-run / plan: **attempted = 0**
- Live requires both `--execute-live` and `--confirm-provider-calls` (refused by I.2 CLI)

## Holdout 2025

Protocol rejects any plan/acquire for season `2025`. Separate metadata-only protocol would be required later.

## Team roster

2023/2024 PL club vendor ids are taken from GOALS-1B offline evidence (`competitionId=39`), not invented.

## xG status

`UNKNOWN_UNTIL_CONTROLLED_PROVIDER_SAMPLE`  
EloPoisson `expectedGoals` is **not** vendor xG.

## Future live-smoke procedure (DESIGN ONLY — do not run)

1. Authorize dual flags + explicit `--max-calls` ≤ planned remaining.
2. Run one team-season schedule for a single PL club (e.g. 42 / 2024).
3. Inspect competition-id inventory; optionally pin verified cup/UEFA ids into registry.
4. Sample 1–3 fixture statistics; run discovery for shots/SoT/possession/xG field presence.
5. Stop; document observed fields; do not open bulk acquisition without a new phase brief.

## Known limitations

- Cup/UEFA competition ids not yet evidenced → remain UNKNOWN
- Statistics units empty until schedules are acquired
- No as-of-T future-schedule snapshots
- Production expectation remains UNAVAILABLE; G1 unchanged; C0 off
