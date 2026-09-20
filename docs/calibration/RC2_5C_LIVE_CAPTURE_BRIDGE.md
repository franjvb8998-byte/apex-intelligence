# RC2 5C.5B.2 Offline Controlled Live Capture Bridge

Infrastructure preparation only. **This sprint does not authorize live capture and must make zero provider calls.**

The bridge is the reviewed-handoff execution path that will later connect a human-reviewed 5C.4 discovery result to the frozen 5C.5B.1 adapter and 5C.2 pending capture pipeline.

It does not weaken the frozen 5C.5B.1 `kind: "live"` rejection. It does not call API-Football. It does not read `API_FOOTBALL_KEY`. It does not execute discovery. It does not write `data/prospective/pending/` or `data/prospective/scored/`.

---

## 1. Purpose

When a fixture later enters the frozen T-75 to T-45 window, APEX already has a reviewed, offline-testable path:

```
reviewed eligible fixture
        ->
minimal provider evidence acquisition
        ->
optional odds acquisition
        ->
final eligibility / window recheck
        ->
frozen five-arm prediction
        ->
atomic PENDING persistence
```

5C.5B.2 implements that path with synthetic transports only.

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

5C.1 / 5C.2 / 5C.3 / 5C.4 / 5C.5A / 5C.5B.1 / 5C.6 / production Probability Engine files are not modified.

## 3. Discovery / capture separation

The bridge never discovers fixtures.

It accepts only an explicit human-reviewed handoff. There is no discovery-then-capture command and no automatic capture.

Required handoff fields:

- fixture identity: `fixtureId`, `competitionId`, `season`, `kickoffUtc`, `status`, home/away ids and names
- review metadata: `reviewedDiscoveryAtUtc`, `reviewedClassification`

`reviewedClassification` must be `IN_WINDOW`.

Anything else (`TOO_EARLY`, `MISSED_WINDOW`, unknown, ineligible) is rejected **before** evidence acquisition.

## 4. Identity binding

Provider-shaped data loaded later must match the reviewed handoff exactly:

- `fixtureId`
- `competitionId`
- `season`
- kickoff
- `homeTeamId`
- `awayTeamId`

Mismatch stops that fixture. The reviewed target is never replaced by another provider fixture.

## 5. Final window recheck

Even after a reviewed `IN_WINDOW` handoff, time may have passed.

Immediately before prediction/capture the frozen 5C.3 window is re-evaluated with an injected UTC clock.

| Recheck | Persistence |
|---|---|
| `IN_WINDOW` | allowed only if the rest of the contract holds |
| `TOO_EARLY` | zero pending persistence |
| `MISSED_WINDOW` | zero pending persistence |

No backfill. No window widening. No machine-local time.

## 6. Evidence contract

Evidence is projected by the frozen 5C.5B.1 catalogue builder. Allowed evidence only:

- same competition
- same season
- completed prior fixtures
- kickoff strictly `<` target kickoff
- `FT` / `AET` / `PEN`

Catalogue fields only: W / D / L / GF / GA.

Excluded: H2H, standings, rankings, lineups, injuries, xG, possession, shots, cards, corners, news, market information, future fixtures, target outcome, same-kickoff fixtures, the target fixture itself.

Sparse evidence is legal. Zero prior evidence is legal if frozen downstream contracts allow it.

## 7. Provider transport seam

The bridge uses a separate injectable transport:

- `loadEvidenceUniverse(handoff)`
- `loadOdds(fixtureId)?`

This sprint ships `createSyntheticCaptureBridgeTransport` only. `kind` must be `"synthetic"`.

Future request families are documentation descriptors, not executable networking:

- `evidenceFamily = prior_completed_same_league_season`
- `oddsFamily = optional_prematch_odds`

They are not HTTP clients and do not contain an API key.

5C.5B.1 remains frozen: `kind: "live"` is still rejected there. The bridge never passes a live transport into that adapter.

## 8. Call budget

Frozen protocol budget:

- discovery = 1
- evidence = 1
- odds <= 20
- total <= 22

Discovery already happened before bridge authorization. The bridge therefore accounts for `priorDiscoveryCalls` (default 1) plus planned remaining evidence/odds calls.

This sprint does not spend calls. Reported spent values remain:

- `evidenceCalls = 0`
- `oddsCalls = 0`
- `outcomeCalls = 0`
- `totalCalls = 0`

Plans that exceed the frozen totals are rejected before evidence load.

## 9. Odds

Odds remain optional.

Missing, unavailable, invalid, late, future, or transport-failed odds drop the odds snapshot. The fixture stays capture-eligible if mandatory evidence/window contracts still hold.

Odds never select a candidate, never change candidate probabilities, and never introduce EV / stake / betting logic.

Accepted odds must be pre-match: evidence timestamp strictly before kickoff.

## 10. Five-arm atomicity and pending reuse

Successful execution delegates to frozen 5C.5B.1 / 5C.5A / 5C.2.

Exactly five frozen arms. If any arm fails, persist zero candidate records.

At capture:

- `status = PENDING`
- `homeGoals = null`
- `awayGoals = null`
- `scoredAt = null`

Deterministic batch identity, canonical JSON, evidence hash, records hash, and batch hash are reused. 5C.2 hashing is not redefined.

## 11. Persistence and dry-run

| Mode | Behavior |
|---|---|
| `DRY_RUN` (default) | Build five arms and hashes. Write nothing. `capturedN` unchanged. |
| `PERSIST_PENDING` | Requires explicit mode plus explicit `persistRoot`. Atomic five-arm persist only. |

No environment variable by itself may change `DRY_RUN` into persistence.

Tests persist only in temporary directories. The real `data/prospective/pending/` and `data/prospective/scored/` directories are not written.

`capturedN` increments by 1 for one persisted five-arm fixture, not by 5. Rejected, dry-run, partial, failed, and duplicate fixtures increment `capturedN` by 0.

5C.6 `scoredN` is unrelated and remains unchanged by capture.

Duplicates do not overwrite existing PENDING artifacts and do not mint a new random batch ID.

## 12. Live safety interlock

`CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED` is `false`.

The bridge rejects:

- `authorizeLiveProvider === true`
- any non-synthetic transport
- any attempt to treat this sprint as live provider execution

Importing the module performs no network activity and does not read `APEX_CALIBRATION_LIVE` or `API_FOOTBALL_KEY`.

### Future authorization (not enabled here)

A later explicitly authorized live run would require **all** of:

1. a human-reviewed `IN_WINDOW` handoff
2. explicit persistence mode / `persistRoot` if pending artifacts will be written
3. a later-authorized live transport that still does not live inside 5C.5B.1
4. a later change that enables the 5C.5B.2 interlock (this flag stays false now)

`APEX_CALIBRATION_LIVE=1` is not sufficient and is not used by this sprint.

This document does **not** authorize live capture.

## 13. Safe report

The debug report includes fixture identity, reviewed discovery time and classification, execution start, minutes to kickoff at final recheck, final classification, identity verification, evidence count and cutoff, same-kickoff excluded count, target excluded, odds disposition, five-arm count, candidate IDs, capture disposition, dry-run/persist mode, provider-call accounting, batch hashes if generated, and `capturedN` / `scoredN` before/after.

It must not include API keys, raw provider payloads, winner, candidate ranking, best model, bet recommendation, stake, EV selection, or real outcomes.

## 14. Files

| Path | Role |
|---|---|
| `lib/debug/calibration/prospective/live-capture-bridge/` | debug-only bridge |
| `lib/debug/calibration/sprint-5c5b2-live-capture-bridge.test.ts` | synthetic tests |
| `lib/debug/calibration/index.ts` | debug exports only |
| `docs/calibration/RC2_5C_LIVE_CAPTURE_BRIDGE.md` | this document |

## 15. Next step (not authorized here)

Human review, then a **separate 5C.5B.2 freeze checkpoint**.

Do not execute live capture as part of this sprint.
