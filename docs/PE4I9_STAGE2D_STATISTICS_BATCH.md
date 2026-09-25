# PE-4I.9 — Stage-2D Fourth Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2D statistics batch only  
**Modeling:** **NONE**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state

| Metric | Value |
|---|---|
| Initial statistics cache hits | **451** |
| Initial uncached | **643** |
| Prior I.6/I.7/I.8 successes re-requested | **0** |

## Deterministic selection

| Metric | Value |
|---|---|
| Selected | 150 |
| Range | `1126424` → `1208084` |
| Selection digest | `57186d85d8a42edf50f55d18c70e1096e79cde844d627722c459a653c6e53765` |

### By competition (natural queue order)

| Competition | Count |
|---|---|
| Premier League | 63 |
| FA Cup | 47 |
| League Cup | 14 |
| UEFA Europa League | 12 |
| UEFA Champions League | 8 |
| UEFA Europa Conference League | 6 |

### By provider season / calendar year / status

| Axis | Values |
|---|---|
| Provider season | 2023 = 87; **2024 = 63** (first natural reach) |
| Calendar year | 2023 = 11; 2024 = 139 |
| Status | FT = 139; PEN = 8; AET = 3 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **150 / 150 / 0** |
| New cache writes | 150 |
| Remaining uncached | **493** |
| Schedule attempts | 0 |

## Resume verification

Provider calls = **0**; cache hits = **150**; failures = **0**.

## Natural transition watch

| Transition | Reached? |
|---|---|
| Provider season 2024 | **YES** (`PROVIDER_SEASON_2024_TRANSITION_REACHED=true`) |
| FA Cup | **YES** |
| League Cup | **YES** (additional) |
| UCL | **YES** |
| UEL | **YES** |
| UECL | **YES** |

### Provider season 2024 coverage (batch subset)

63 fixtures (all Premier League in this batch): expected_goals / shots / SOT / possession / corners = **100%**; yellow = 98.413%; red = 11.111%; xG both-team = **63/63**.

## Field coverage

Goals remain fixture-evidence sourced (not statistics endpoint).

### Batch (150 / 300 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 178 | 122 | **59.333** |
| total_shots | 294 | 6 | **98** |
| shots_on_goal | 294 | 6 | **98** |
| ball_possession | 294 | 6 | **98** |
| corner_kicks | 294 | 6 | **98** |
| yellow_cards | 280 | 20 | **93.333** |
| red_cards | 28 | 272 | **9.333** |

### Cumulative (601 envelopes / 1202 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 1032 | 170 | **85.857** |
| total_shots / SOT / possession / corners | 1196 | 6 | **99.501** |
| yellow_cards | 1162 | 40 | **96.672** |
| red_cards | 146 | 1056 | **12.146** |

## Competition-specific coverage (this batch)

| Competition | n | xG both | expected_goals % | shots/SOT/poss/corners % | yellow % | red % |
|---|---|---|---|---|---|---|
| Premier League | 63 | 63 | 100 | 100 | 98.413 | 11.111 |
| UCL | 8 | 8 | 100 | 100 | 100 | 0 |
| UEL | 12 | 12 | 100 | 100 | 91.667 | 0 |
| UECL | 6 | 6 | 100 | 100 | 100 | 33.333 |
| League Cup | 14 | 0 | **0** | 100 | 92.857 | 0 |
| FA Cup | 47 | 0 | **0** | 93.617 | 85.106 | 10.638 |

**Do not generalize xG from PL/UEFA to domestic cups.** FA Cup and League Cup show **0/61** both-team xG in this batch.

## xG coverage

Thresholds unchanged: HIGH ≥ 0.90; PARTIAL ≥ 0.50; LOW ≥ 0.10; UNUSABLE < 0.10.

| Scope | Both | One | None | Team present | Coverage % | Class |
|---|---|---|---|---|---|---|
| Batch | 89 | 0 | 61 | 178 | 59.333 | **XG_COVERAGE_PARTIAL** |
| Cumulative | 516 | 0 | 85 | 1032 | 85.857 | **XG_COVERAGE_PARTIAL** |

Cumulative classification dropped from HIGH (post-I.8) to PARTIAL after natural cup inclusion — coverage characterization only; no model change.

## Status / AET / PEN

11 non-FT fixtures: AET=3, PEN=8. All classified **AMBIGUOUS_FOR_REGULATION_FEATURES**.

Raw statistics cached; must not silently enter regulation-90 feature datasets.

IDs: 1141104, 1141105, 1149523, 1155955, 1156181, 1168363, 1169386, 1180025, 1184780, 1184821, 1185654.

## Card semantics

Null/missing Yellow or Red Cards = **missing, not zero**. No repair in this phase.

## Holdout firewall

| Axis | Status |
|---|---|
| provider season=2025 requests | **NONE** |
| research holdout 2025 | **SEALED** |
| calendar-2025 fixtures in batch | **0** |
| PE3C_C0_RECON_ACTIVATION | false |
| production expectation | UNAVAILABLE |
| G1 k | 10 |

## Remaining queue

**493** uncached Stage-2 fixtures remain. Next bounded batch requires separate authorization (≤150). Do not auto-start PE-4I.10.

## Artifacts

`data/calibration/pe4-acquisition-v1/stage2d-i9/` (gitignored; digests in report).
