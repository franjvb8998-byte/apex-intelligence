# RC2 5C.3 Live Prospective Capture Protocol

Protocol freeze only. **No real fixtures. Zero API. No scoring.**

This document freezes the operational rules that will govern future live prospective captures. It does not collect the sample.

---

## 1. Purpose

Answer, before the first real capture:

1. eligible competitions
2. eligible seasons
3. mechanical fixture inclusion
4. exact capture timing
5. allowed pre-match evidence
6. sparse-evidence handling
7. postponement / cancellation
8. duplicate / reschedule handling
9. whether odds are required
10. API allowlist and budget
11. failure / retry
12. prospective sample accounting

## 2. Frozen base commit

`82162ad2cea7132cede9631ff268ad1c0fcee608`

Branch: `develop`. This is the 5C.2 capture-infrastructure freeze. CONTROL remains the production Probability Engine at `967b541f3947a4f9cfe0d1fe5eea57f3de880f62`.

## 3. Candidate fingerprint

Unchanged from 5C.1:

`7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Version: `apex.calibration.prospective.5c1.v1`

Future live batches must record **both** `candidateFingerprint` and `protocolFingerprint`.

## 4. Eligible competition

Premier League only. Provider league / competition ID **39**.

5C.3 does not broaden to other leagues.

## 5. Season verification boundary

`prospectiveSeason = UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`

Do not infer the provider season identifier from the calendar alone.

The first controlled live discovery (next sprint, Phase 1) must verify the provider’s current PL season id.

Offline 5C.3 tests use synthetic season **2099**.

Permanently excluded from prospective validation:

- PL 2023
- PL 2024
- PL 2025

## 6. Fixture inclusion

Mechanical only. An eligible fixture must:

- belong to league 39
- belong to the configured prospective season
- have a valid fixture ID and two team IDs
- have a scheduled kickoff
- be pre-match at capture
- satisfy the capture window
- pass leakage / integrity guards
- not already be captured under the frozen candidate fingerprint

Do **not** select on team strength, predicted probability, confidence, odds, EV, interesting matchup, or a preferred candidate result. No cherry-picking.

## 7. Exact capture window

Operational freeze:

| Item | Minutes before scheduled kickoff (UTC) |
|---|---|
| Target | 60 |
| Earliest | 75 |
| Latest | 45 |

A fixture is eligible only when capture occurs in **[T-75, T-45]**.

T-80 is too early. T-75 / T-60 / T-45 are eligible. T-44 and post-kickoff are `MISSED_WINDOW`.

Do not backfill a missed fixture after kickoff. Do not capture retrospectively.

This T-60 ±15 window is an operational compromise chosen **prospectively**: close enough to kickoff to be a genuine pre-match prediction, still strictly pre-kickoff, practical to schedule, and contemporaneous for evidence/odds. It is **not** a historically optimized parameter.

5C.2’s infrastructure placeholders remain `UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL`. Live window values live in this protocol and are injected into 5C.2 only when a later authorized capture run asks for them.

## 8. Status policy

Eligible pre-match equivalents: `NS`, `NOT_STARTED`, `SCHEDULED`.

Reject at capture: `LIVE`, `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `SUSP` / `SUSPENDED`, `INT`, `FT`, `AET`, `PEN`.

Unknown provider statuses are rejected until explicitly reviewed.

## 9. Postponement / cancellation

- Postponed **before** capture: do not capture the obsolete kickoff (`POSTPONED_BEFORE_CAPTURE`).
- Already captured, later postponed: keep the original pending record for audit. Future settlement must mark that kickoff non-scorable. Do not overwrite.
- Same fixture ID with a new kickoff: a **new** capture is allowed only if the protocol can distinguish the new kickoff from the original capture. Never replace the old prediction.
- Cancelled: never score (`CANCELLED_BEFORE_CAPTURE`).
- Abandoned: do not score unless a later scoring protocol defines it.

5C.3 defines policy only. No result scoring is implemented.

## 10. Evidence policy

Allowed catalogue-input evidence, available strictly before kickoff:

`matchesPlayed`, `wins`, `draws`, `losses`, `goalsFor`, `goalsAgainst`

Computed only from eligible prior **completed** fixtures with:

`prior kickoff < target kickoff`

No target-match result. No future fixtures in team statistics. No post-kickoff evidence.

Prefer reconstructing those counts from the already-fetched league fixture list. Do not authorize `/teams/statistics` in 5C.3.

## 11. Same-kickoff rule

Fixtures that share a kickoff timestamp must **not** provide evidence to one another.

Cutoff is strictly `<`, not `<=`.

Ordering remains deterministic: kickoff, then fixtureId.

## 12. Sparse evidence

Do not exclude fixtures because evidence is sparse.

Zero-match evidence is allowed.

All five frozen candidates process the fixture with their already-frozen mechanics.

Record evidence counts. No minimum-match eligibility threshold.

## 13. Odds policy

Odds remain **optional** for primary probability validation.

A fixture is not excluded because odds are missing.

If valid pre-match 1X2 odds are available inside the capture process, they may be snapshotted for secondary market comparison.

- Candidate scoring does not depend on odds
- Absence does not invalidate capture
- No historical odds backfill
- No post-kickoff or post-capture odds
- No repeated odds polling in 5C.3

## 14. Provider boundary

Future controlled live source: the existing API-Football provider.

5C.3 itself makes **zero** API calls.

Allowlist for the **next** live sprint only:

| Family | Narrowest existing call | Notes |
|---|---|---|
| Fixture discovery | `GET /fixtures?league=39&season={id}` via `getFixturesByLeague` | Unpaged single call. No hidden pagination. |
| Prior fixture evidence | Reuse the discovery fixtures payload | Filter `prior kickoff < target`. Extra evidence call ceiling = 1. |
| Optional pre-match odds | `GET /odds?fixture={id}` via `getFixtureOdds` | Optional. Never required. Never per-candidate. |

Denied unless a later sprint re-authorizes: lineups, events, fixture statistics, H2H, team statistics, standings, injuries, players.

Prefer cache / repository reuse where already valid. All five candidates reuse **one** evidence snapshot.

## 15. API budget architecture

Hard configurable ceilings per capture run:

| Ceiling | Value |
|---|---|
| `maxFixtureDiscoveryCalls` | 1 |
| `maxEvidenceCalls` | 1 |
| `maxOddsCalls` | 20 |
| `maxTotalCalls` | 22 |

No unlimited loops. No hidden pagination. No per-candidate API calls.

Exact evidence-call count is derived later from implementation but must stay under the ceiling. 5C.3 spends **zero** calls.

## 16. First-live-discovery boundary

The next sprint must separate:

- **Phase 1 — discovery:** verify current PL season id, upcoming fixtures, provider status strings, kickoff timestamps. Must **not** create prospective predictions.
- **Phase 2 — capture:** only fixtures that independently satisfy this frozen window.

Discovery itself does not capture. No accidental capture during discovery.

## 17. No-backfill rule

After this freeze, fixtures whose T-75–T-45 window was missed must **not** enter the primary prospective sample later.

They may be recorded only as `MISSED_WINDOW` with **no** candidate prediction.

Do not reconstruct what APEX “would have predicted.”

## 18. Dispositions

Every discovered league-39 fixture should eventually have one of:

| Disposition | Enters sample N |
|---|---|
| `CAPTURED_PENDING` | yes |
| `MISSED_WINDOW` | no |
| `POSTPONED_BEFORE_CAPTURE` | no |
| `CANCELLED_BEFORE_CAPTURE` | no |
| `INELIGIBLE_STATUS` | no |
| `DUPLICATE` | no |
| `INTEGRITY_REJECTED` | no |
| `SOURCE_FAILURE` | no |

Planner-only labels before capture: `TOO_EARLY`, `IN_WINDOW`.

## 19. Sample accounting

`N` = number of **unique fixtures** with a valid frozen five-arm capture that later become scoreable.

Five candidate records for one fixture are **not** N=5.

One fixture = one observation across five arms.

Only `CAPTURED_PENDING` enters prediction sample N.

## 20. Checkpoints

Preserved: **100 / 250 / 500**.

Descriptive. No early candidate modification. No optional stopping.

## 21. Failure / retry

Before kickoff, a transient source failure may be retried **only** while the fixture remains inside T-75 to T-45.

When the window closes: `SOURCE_FAILURE` or `MISSED_WINDOW`.

Never capture after T-45 merely to fill the sample. Never backfill after kickoff. Retries obey the API budget.

## 22. UTC policy

Canonical timestamps are ISO-8601 UTC.

Provider kickoffs are normalized once to UTC. Window arithmetic is UTC.

Human reports may show local time. Local display never drives eligibility.

Timezone-equivalent stamps must classify identically.

## 23. Operational config

See `LIVE_PROTOCOL_CONFIG` in `lib/debug/calibration/prospective/protocol/protocol-config.ts`.

Minimum frozen fields:

- `competitionId = 39`
- `prospectiveSeason = UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY`
- `targetCaptureMinutesBeforeKickoff = 60`
- `earliestCaptureMinutesBeforeKickoff = 75`
- `latestCaptureMinutesBeforeKickoff = 45`
- `candidateVersion = apex.calibration.prospective.5c1.v1`
- `candidateFingerprint = 7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`
- `oddsRequired = false`
- `historicalUsedSeasons = [2023, 2024, 2025]`
- `reportingCheckpoints = [100, 250, 500]`

No adaptive tuning.

## 24. Protocol fingerprint

Deterministic SHA-256 of the canonical protocol configuration.

Runtime: `LIVE_PROTOCOL_FINGERPRINT`.

SHA-256: `825dcadc2cb541687b1ff852088f680c360a55901b3abb77757416d0d0c845b9`

This is **not** the candidate fingerprint. Do not modify the candidate fingerprint.

## 25. Offline planner

`planDiscoveredFixtures` / `protocolDryRun` accept synthetic discovered metadata and classify dispositions.

No network. No candidate prediction required for planner-only classification.

## 26. What remains forbidden

- Live API-Football or any origin HTTP in 5C.3
- Real fixture collection
- Result access or scoring
- Candidate or production edits
- Cherry-picking
- Retrospective backfill
- Other leagues
- USED seasons 2023/2024/2025
- Commit / push in this sprint

## 27. Exact requirements to authorize first live discovery

A later sprint may authorize Phase 1 discovery only after:

1. This protocol and both fingerprints remain frozen.
2. `prospectiveSeason` is still unverified until the discovery response names it.
3. The runner is discovery-only: `GET /fixtures?league=39&season={id}` (or equivalent unpaged call), budget 1 discovery call, **zero** capture writes.
4. Provider status strings and kickoff UTC values are logged, not captured.
5. No fixture is captured unless it independently sits in T-75–T-45 at an authorized Phase 2 clock.
6. USED seasons remain firewalled.
7. Human review accepts the discovered season identifier before Phase 2.

---

Status: **PROTOCOL FROZEN FOR LIVE AUTHORIZATION REVIEW — no real fixtures collected, no predictions captured, no outcomes scored**
