# RC2 5C.5A First Prospective Capture Runbook

Offline orchestration freeze. **5C.5A DOES NOT AUTHORIZE LIVE CAPTURE.**

This document describes how frozen 5C.1–5C.4 modules are composed for a future authorized live capture. It does not collect a sample, contact API-Football, or write a real pending batch.

---

## 1. Purpose

Prove, with synthetic fixtures only, that discovery metadata can flow through protocol eligibility, injected pre-match evidence, the 5C.2 capture runner, the five frozen 5C.1 candidates, and pending persistence — without duplicating frozen rules and without any provider I/O.

## 2. Frozen baseline

Branch: `develop`.

5C.4 discovery commit: `e9284f9515f4087d85497f71a9b5fd00b695bbf3`.

CONTROL / production Probability Engine remains `967b541f3947a4f9cfe0d1fe5eea57f3de880f62`.

## 3. Fingerprints

Candidate fingerprint (5C.1, unchanged):

`7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Protocol fingerprint (5C.3, unchanged):

`825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9`

Both must be recorded on any future live batch. 5C.5A does not rewrite either fingerprint.

## 4. Accepted season 2026

5C.4 live discovery verified API-Football Premier League season **2026**. That identifier is an operational fact for 5C.5A (`ACCEPTED_PROSPECTIVE_SEASON`).

The frozen 5C.3 config field `prospectiveSeason` remains `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`. This sprint does **not** mutate that protocol object or its fingerprint.

Competition remains Premier League `competitionId = 39`.

USED historical seasons 2023 / 2024 / 2025 stay firewalled.

## 5. T-75 / T-45 window

Operational freeze, injected into 5C.2 only at capture time via `liveProtocolCaptureWindow()`:

| Item | Minutes before scheduled kickoff (UTC) |
|---|---|
| Target | 60 |
| Earliest | 75 |
| Latest | 45 |

T-80 is `TOO_EARLY`. T-75 / T-60 / T-45 are eligible. T-44, kickoff, and post-kickoff are `MISSED_WINDOW`.

Do not retune this window from discovered fixtures.

## 6. Orchestration flow

```
injected projected fixture metadata
        + injected pre-match evidence
        + optional injected odds
        ↓
5C.5A input / leakage contract
        ↓
5C.3 protocol planner (season option = 2026)
        ↓
5C.2 eligibility, evidence snapshot, capture runner
        ↓
five frozen 5C.1 candidate predictions
        ↓
5C.2 pending persistence (only if dryRun=false)
```

The orchestrator **calls** existing modules. It does not reimplement window math, candidate geometry, hashing, or persistence.

## 7. Evidence contract

5C.5A never fetches team statistics, standings, or a second fixture list.

Callers supply a frozen pre-match snapshot sufficient for catalogue Elo:

- home/away: `matchesPlayed`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`, `teamId`
- `evidenceAsOf`
- source competition/season via the fixture fields

Sparse evidence is legal. Zero-match evidence is legal. There is no minimum-match filter.

Same-kickoff fixtures must not become evidence for one another (`isEligiblePriorEvidence` cutoff is strictly `<`). 5C.5A does not derive sibling evidence; each fixture's snapshot is injected independently.

`evidenceAsOf <= capturedAt` and all evidence timestamps `< kickoff`.

## 8. Five-arm atomicity

Accepted fixtures run **exactly** the five frozen candidates:

`CONTROL_PRODUCTION`, `CANDIDATE_A_INPUT`, `CANDIDATE_B_TRANSFORM`, `CANDIDATE_C_COMBINED`, `CANDIDATE_D_COMBINED_HIGH_EQUAL`

Record count = `acceptedFixtureCount × 5`.

If any arm fails, the fixture/batch capture fails atomically: no partial 4/5 write, no pending file, no prospective N change.

## 9. Odds policy

Odds remain optional. 5C.5A makes **zero** odds API calls.

A fixture is not excluded because odds are missing.

If odds are present: `oddsCapturedAt <= capturedAt` and `oddsCapturedAt < kickoff`.

No EV-based selection. No ranking.

## 10. Persistence policy

Real target remains `data/prospective/pending/`.

Default orchestrator mode is `dryRun = true`. Persistence requires an explicit `dryRun: false`.

5C.5A tests may persist only into isolated temporary directories. No overwrite. No duplicate fixture under the frozen fingerprint. Atomic temp-then-rename remains the 5C.2 behavior.

## 11. Duplicate protection

- duplicate `fixtureId` inside one input batch → reject
- fixture already present in the prior capture index for this candidate fingerprint → reject / `DUPLICATE`

Never replace an old prediction.

## 12. Leakage protection

Reuse 5C.2 `assertNoOutcomeLeakage` plus extra result-shaped keys (`homeGoals`, `awayGoals`, `goals`, `halftime`, `fulltime`, `extratime`, `penalty`, …).

At capture, records are `PENDING` with `finalHomeGoals = null`, `finalAwayGoals = null`, `scoredAt = null`.

Final statuses `FT` / `AET` / `PEN` and in-play statuses are ineligible.

## 13. UTC policy

Canonical timestamps are ISO-8601 UTC. Window arithmetic is UTC. Local display never drives eligibility.

## 14. Dry-run behavior

`dryRun` defaults to `true`. Dry-run builds the in-memory five-arm batch and hashes, writes **nothing**, and does not increment prospective N.

## 15. Real execution boundary

5C.5A contains **no** API-Football transport, `fetch`, API key access, discovery runner invocation, or odds retrieval.

The orchestrator accepts already-projected metadata and already-available evidence through function arguments.

## 16. Prospective N semantics

`N` counts unique fixtures with a valid frozen five-arm capture that later become scoreable.

Dry-run / synthetic 5C.5A fixtures do **not** increment N.

Real prospective N remains **0** until a later authorized live capture actually persists `CAPTURED_PENDING`.

Checkpoints remain 100 / 250 / 500. No optional stopping.

## 17. Failure handling

Ineligible window/status/league/season/leakage/duplicate → reject with zero records persisted.

Transient provider failure is **out of scope** for 5C.5A (no provider). A later live sprint may retry only while the fixture remains inside T-75 to T-45, under the frozen API budget.

## 18. No-backfill rule

Fixtures whose T-75–T-45 window was missed must not enter the primary prospective sample later. Do not reconstruct what APEX “would have predicted.”

## 19. API prohibition in 5C.5A

Forbidden in the 5C.5A orchestration sources:

- `fetch(` / axios
- `API_FOOTBALL_KEY` / `x-apisports-key`
- `/api/fixtures` / `/api/odds`
- invoking 5C.4 live discovery transport
- `/odds`, lineups, events, statistics, standings, H2H, team statistics

Existing 5C.4 discovery transport may remain in the repository. 5C.5A must not call it.

## 20. Exact future authorization required for live capture

A **separate 5C.5B** sprint must explicitly authorize live capture before any origin request or real pending write.

That authorization must still require:

1. frozen fingerprints unchanged
2. season 2026 accepted by human review (already accepted as a 5C.4 fact; not silently written into 5C.3 config here)
3. fixture independently inside T-75–T-45 at the capture clock
4. injected or budgeted evidence obeying prior-kickoff exclusivity
5. five-arm atomic persist
6. no candidate tuning and no window retuning

**5C.5A DOES NOT AUTHORIZE LIVE CAPTURE.**
