# RC2 5C.5B.1 Live Execution Adapter

Offline evidence construction and capture-execution seam. **This sprint does not authorize live capture and must make zero provider calls.**

The adapter turns a synthetic pre-match fixture snapshot into the already-frozen 5C.5A orchestrator input, then into a five-arm 5C.2 pending batch. Persistence is opt-in. Default mode is `DRY_RUN`.

---

## 1. Purpose

Prepare the missing execution layer required for the first real prospective capture, fully testable with local synthetic payloads before the frozen T-75 to T-45 window.

Do not collect real evidence, odds, or predictions. Do not increment real prospective N. Do not invoke 5C.4 live discovery transport.

## 2. Frozen science (unchanged)

Candidate fingerprint:

`7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Protocol fingerprint:

`825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9`

| Fact | Value |
|---|---|
| Competition | Premier League `39` |
| Accepted operational season | `2026` |
| Window | T-75 open / T-60 target / T-45 close |
| Arms | the five frozen 5C.1 candidates, always all five |

5C.3 `prospectiveSeason` remains `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`. This adapter does not mutate that field.

## 3. Conceptual flow

```
synthetic provider fixture payload
        |
        v
validate identity / status / time
        |
        v
project minimum safe target fields
        |
        v
build PRE-MATCH catalogue evidence
from completed PRIOR fixtures only
        |
        v
optional PRE-MATCH odds snapshot
        |
        v
final frozen-window recheck (5C.3 / 5C.5A)
        |
        v
5C.5A live-capture orchestrator
        |
        v
five frozen candidate arms
        |
        v
5C.2 pending batch
        |
        v
atomic persist only if PERSIST_PENDING
```

The adapter does not implement a new prediction engine.

## 4. Provider projection

Raw synthetic payloads may look like provider fixture objects and may contain extra fields. The adapter projects only:

Target: fixture id, league id, season, kickoff UTC, status, home team id/name, away team id/name.

Prior: the target fields plus the minimum completed-result goals required to update catalogue counts.

Dropped: raw payload remainder, headers, secrets, standings, lineups, injuries, xG, H2H blocks.

Target projection never carries target goals or a winner.

## 5. Evidence construction

Evidence for target T may use only fixtures that are:

- same competition
- same accepted season
- completed (`FT` / `AET` / `PEN`)
- prior kickoff **strictly less than** target kickoff

Excluded from evidence:

- same-kickoff siblings (`prior kickoff == target kickoff`)
- future fixtures
- the target fixture itself
- live / in-progress fixtures
- postponed / cancelled / abandoned fixtures
- incomplete completed-looking rows (missing identifiers or goals)

Sparse evidence is legal. Zero-match evidence is legal. No new features are added.

Provenance recorded on every snapshot:

- target fixture id and kickoff
- evidenceAsOf
- competition, season, home/away team ids
- priors inspected / accepted
- home and away evidence match counts
- latest accepted evidence kickoff, if any (`<` target kickoff)

No target outcome may appear in provenance.

## 6. Odds

Odds are optional.

- Valid `oddsCapturedAt <= capturedAt` and `oddsCapturedAt < kickoff` may attach as the existing 5C.2 odds snapshot.
- Missing odds: capture remains eligible.
- Invalid or late odds: drop the odds snapshot; do not reject the fixture.

No bookmaker ranking, EV selection, or historical odds performance logic.

## 7. Final window recheck

Immediately before `orchestrateLiveCapture`, the adapter reuses frozen 5C.5A / 5C.3 eligibility. It does not redefine T-75 / T-60 / T-45.

| Capture time | Classification |
|---|---|
| T-80 | `TOO_EARLY` |
| T-75 | eligible |
| T-60 | eligible |
| T-45 | eligible |
| T-44 | `MISSED_WINDOW` |
| kickoff | `MISSED_WINDOW` |
| post-kickoff | `MISSED_WINDOW` |
| wrong league | reject |
| wrong season | reject |
| `LIVE` | reject |
| `FT` | reject |
| unknown status | reject |

## 8. Execution modes

| Mode | Behavior |
|---|---|
| `DRY_RUN` (default) | Evidence, optional odds, five arms, hash verification. No write to `data/prospective/pending`. N unchanged. |
| `PERSIST_PENDING` | Explicit caller selection plus explicit `persistRoot`. Atomic five-arm persist only. |

Persistence is never implicit. `PERSIST_PENDING` without `persistRoot` is rejected.

## 9. Transport seam

`LiveExecutionTransport` is an injected interface:

- `loadUniverse()` — target + fixture/evidence payload
- `loadOdds(fixtureId)?` — optional odds payload

5C.5B.1 ships `createSyntheticLiveExecutionTransport` only. A `kind: "live"` transport is rejected. The frozen 5C.4 discovery transport is not modified and is not invoked.

A later authorized sprint may attach a live transport to this same seam without rewriting the adapter core.

## 10. Call accounting

The adapter reports `discoveryCalls`, `evidenceCalls`, `oddsCalls`, and `totalCalls`.

For 5C.5B.1 those values remain `0 / 0 / 0 / 0`. Synthetic in-memory loads are not provider calls.

Evidence is shared by all five arms. Odds are shared by all five arms. There is no per-candidate provider call.

## 11. Prospective N

N = unique target fixtures with a valid successfully persisted complete five-arm pending capture under the frozen candidate fingerprint.

- 1 captured fixture / 5 candidate records => N + 1
- `DRY_RUN` => N + 0
- partial or failed capture => N + 0

N does not count candidate rows. This sprint does not score outcomes.

## 12. Atomicity

Eligible fixture + five arms succeed => exactly five prediction records.

Simulated candidate, evidence, integrity, or persistence failure => zero valid persisted records. No partial five-arm fixture may remain.

## 13. Safe report

The execution report may include fixture identity, kickoff, capturedAt, minutes to kickoff, status, protocol classification, evidence/odds presence and counts, execution mode, candidate fingerprint and IDs, record count, hash verification, persistence status, N before/after, and call accounting.

It must not include API keys, auth headers, raw provider payloads, target result/goals/winner, settled outcomes, historical scoring, bet recommendations, or candidate ranking.

## 14. Files

| Path | Role |
|---|---|
| `lib/debug/calibration/prospective/live-execution/` | debug-only adapter |
| `lib/debug/calibration/sprint-5c5b1-live-execution-adapter.test.ts` | synthetic tests |
| `lib/debug/calibration/index.ts` | exports only |
| `docs/calibration/RC2_5C_LIVE_EXECUTION_ADAPTER.md` | this document |

Frozen 5C.1 / 5C.2 / 5C.3 / 5C.4 / 5C.5A / production Probability Engine files are not modified.

## 15. Next step (not authorized here)

If this sprint passes review, the next separate authorization is **5C.5C FIRST LIVE CAPTURE**, executed only inside a frozen T-75 to T-45 window. This document does not authorize that execution.
