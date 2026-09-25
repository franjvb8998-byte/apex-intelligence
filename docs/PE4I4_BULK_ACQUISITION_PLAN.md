# PE-4I.4 — Multi-Competition Historical Acquisition Plan

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Planning + offline validation only  
**PROVIDER_CALLS_MADE:** `0`  
**Live Stage-1 / Stage-2:** **NOT authorized**

## Purpose

Determine how the 2023–2024 multi-competition dataset should be acquired with
minimal provider-call cost and without duplicate fixture-statistics calls —
**before** authorizing bulk historical acquisition.

## Stage table

| Stage | Units | Already cached | Estimated new calls | What each call obtains | Stop condition |
|---|---|---|---|---|---|
| **1 — Schedule discovery** | 40 club-season pairs (20 PL clubs × seasons 2023+2024) | 1 (`schedule::team=33::season=2024` from PE-4I.3 smoke) | **39** | Team-season fixture list (`GET /fixtures?team=&season=`) including all competitions | All missing schedules acquired **or** batch `maxCalls` exhausted; then normalize/dedupe/classify and emit exact unique statistics queue; **STOP** (no stats calls) |
| **2 — Statistics acquisition** | Exact unique eligible fixture IDs from Stage-1 queue | 1 sample (`statistics::fixture=1208021`) — not counted against unknown Stage-2 total | **960–1260** (range; exact unknown until Stage-1) | Per-fixture match statistics (`GET /fixtures/statistics?fixture=`) once per unique ID | Each eligible unique fixture acquired once **or** batch `maxCalls` exhausted; resume-safe; no silent partial promotion |

## Call estimate summary

| Metric | Value |
|---|---|
| Club-season units | 40 |
| Cached schedule units | 1 (MU 2024 smoke) |
| Missing schedule units / `estimatedScheduleCalls` | 39 |
| Estimated unique league fixtures | 760 (380 × 2 seasons) |
| Estimated additional cup/Europe fixtures | 200–500 |
| `estimatedStatisticsCallsRange` | **960–1260** |
| `estimatedTotalProviderCallsRange` | **999–1299** |

### Assumptions

- Premier League structure: 20 clubs × 19 opponents = **380 unique league fixtures per season**.
- Team schedules list each league fixture twice (home + away club); **fixture-id dedupe** collapses to 380.
- Cup / UEFA unique fixtures are **uncertain** until Stage-1; band scaled from PE-4I.3 Manchester United competitive mix with cross-club overlap.
- Friendlies (667), Summer Series (1022), Community Shield (528) are **not** in the primary stats queue.
- Exact Stage-2 count is **unknowable** before Stage-1 completes — do not pretend otherwise.

## Fixture deduplication

- Primary identity: **provider fixture ID**.
- Identical duplicate payloads collapse; conflicting digests **fail closed**.
- Canonical order: `kickoffUtc`, then `fixtureId`.
- Competition classification does **not** participate in identity.
- Participating-team references preserved on rows.
- **Expected savings:** ~50% on league fixtures vs naïvely calling statistics once per team schedule row (760 team-rows → 380 unique IDs per season).

## Competition policy (performance features)

| ID | Class | Primary performance / stats queue |
|---|---|---|
| 39 | Premier League | INCLUDE |
| 45 | FA Cup | INCLUDE |
| 48 | League Cup | INCLUDE |
| 3 | UEFA Europa League | INCLUDE |
| 2 | UCL | Unknown until observed — preserve raw |
| 848 | UECL | Unknown until observed — preserve raw |
| 528 | Community Shield | Preserve raw; **separate audit** (not PL-weight) |
| 667 | Friendlies Clubs | Preserve raw; **exclude** primary stats |
| 1022 | PL Summer Series | Preserve raw; **exclude** primary stats |
| other | unknown | Preserve raw; audit-only (not dropped) |

Raw acquisition always preserves all returned fixtures.

## Statistics eligibility (primary queue)

Must have unique provider fixture ID, completed status, usable FT/regulation evidence path, evidence-supported competitive competition (or separately auditable if unknown), kickoff ≤ acquisition clock, and **not** discovered via provider season 2025.

## Budget / safety architecture

- Provider daily allowance context: **7500**/day — do **not** auto-consume remaining quota.
- Stage-1 recommended batch `maxCalls`: **50** (covers 39 + buffer).
- Stage-2 recommended batch `maxCalls`: **150** per authorized run.
- Counters: dry-run, planned, attempted, succeeded, failed, cache hits, remaining.
- Resume-safe cache: successful units never re-fetched; failures retryable without repeating successes.
- No unlimited retries; no silent partial-success promotion.

## xG / performance contract

- `XG_STATUS = OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE` (fixture 1208021; field `expected_goals`).
- Does **not** prove global coverage.
- Canonical candidate fields include goals, xG, shots, SOT, possession, corners, cards (for/against).
- **missing ≠ zero**; retain raw name/value; parsed may be null.
- **Never** substitute EloPoisson `expectedGoals` when provider xG is missing.

## As-of-T future contract

Only fixtures `M` with `kickoff(M) < kickoff(T)`. Exclude self and same-kickoff. Per field: requested window, actual observations, missing count, competition composition, evidence cutoff, provenance. No predictive blend in this phase.

## 2025 holdout firewall

Distinguish explicitly:

1. **Provider season identifier** (API `season=` query) — 2023/2024 only; **no season=2025 requests**.
2. **Calendar kickoff year** — provider season 2024 may include calendar-2025 kickoffs; keep in raw cache.
3. **Research development/confirmatory/holdout axis** — holdout-2025 outcome evaluation remains **SEALED**. Calendar-2025 kickoffs under provider season 2024 are **not** automatic holdout evidence.

## PE-4I.3 cache preservation

Offline verification of smoke cache:

- Unit: `schedule::team=33::season=2024`
- Content digest: `3c7ce9ebbd05eb2cefdbc080b37d64dec74f18e4076f0eeda8b13764657b7148`
- Unique fixtures: **68**
- Do **not** re-call the provider to rediscover this sample.

## Resume behavior

- Manifest tracks completed / failed / retryable / absent.
- Conflicting digest on completed unit → fail closed.
- Next authorized run continues only missing/retryable units under a new explicit `maxCalls`.

## Recommended next phase

**PE-4I.5 — Stage-1 schedule discovery** under hard `maxCalls` (suggest 50), then stop with exact statistics queue. No Stage-2 until separately authorized.

## Limitations

- Statistics call count is a **range**, not exact.
- UCL / UECL IDs remain unpinned until observed.
- Smoke envelopes may still carry pre-pin class labels; policy resolves by registry **id**.
- Production PE / lifecycle / scanner / scheduler / G1 untouched.
