# PE-4I.10 — Stage-2E Fifth Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2E statistics batch only  
**Modeling:** **NONE**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state

| Metric | Value |
|---|---|
| Initial statistics cache hits | **601** |
| Initial uncached | **493** |
| Prior I.6–I.9 successes re-requested | **0** |

## Deterministic selection

| Metric | Value |
|---|---|
| Selected | 150 |
| Range | `1208085` → `1208236` |
| Selection digest | `55e59b6f87472f088f36efa6d44161f061794f8922eaa0ead583376b0e0d4776` |

### By competition / provider season / calendar year / status

| Axis | Values |
|---|---|
| Competition | Premier League = **150** |
| Provider season | **2024 = 150** |
| Calendar year | 2024 = 124; **2025 = 26** (acquired under sealed holdout — no modeling) |
| Status | FT = 150 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **150 / 150 / 0** |
| New cache writes | 150 |
| Remaining uncached | **343** |
| Schedule attempts | 0 |

## Resume verification

Provider calls = **0**; cache hits = **150**; failures = **0**.

## Field coverage

Goals remain fixture-evidence sourced (not statistics endpoint).

### Batch (150 / 300 team-sides)

| Field | Coverage % |
|---|---|
| expected_goals | **100** |
| total_shots / shots_on_goal / ball_possession / corner_kicks | **100** |
| yellow_cards | **96.667** |
| red_cards | **14** |

### Cumulative (751 envelopes / 1502 team-sides)

| Field | Coverage % |
|---|---|
| expected_goals | **88.682** |
| total_shots / SOT / possession / corners | **99.601** |
| yellow_cards | **96.671** |
| red_cards | **12.517** |

## xG coverage

Thresholds unchanged: HIGH ≥ 0.90; PARTIAL ≥ 0.50; LOW ≥ 0.10; UNUSABLE < 0.10.

| Scope | Both | One | None | Coverage % | Class |
|---|---|---|---|---|---|
| Batch | 150 | 0 | 0 | 100 | `XG_COVERAGE_HIGH` |
| Cumulative | 666 | 0 | 85 | 88.682 | `XG_COVERAGE_PARTIAL` |

## Competition coverage matrix (cumulative, all cached queue envelopes)

**Important:** `observedXgLabel` values are **coverage labels from the observed sample only** — they are **NOT** model branches, capability gates, or production routing decisions.

| Competition | n | xG both/one/none | both share % | Label | eg % | shots/SOT/poss/corners % | yel % | red % |
|---|---|---|---|---|---|---|---|---|
| Premier League | 594 | 594/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 97.811 | 13.805 |
| UEFA Champions League | 32 | 32/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.875 | 9.375 |
| UEFA Europa League | 28 | 28/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 92.857 | 3.571 |
| UEFA Europa Conference League | 14 | 12/0/2 | 85.714 | `XG_PARTIAL_IN_OBSERVED_SAMPLE` | 85.714 | 100 | 92.857 | 14.286 |
| FA Cup | 47 | 0/0/47 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 93.617 | 85.106 | 10.638 |
| League Cup | 36 | 0/0/36 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 100 | 97.222 | 2.778 |

Label rules (observed sample only): bothShare ≥ 0.90 → `XG_CAPABLE_IN_OBSERVED_SAMPLE`; ≥ 0.50 → `XG_PARTIAL_IN_OBSERVED_SAMPLE`; else → `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE`.

## Provider season 2024 cumulative audit

Across **all** acquired Stage-2 evidence (not this batch only):

| Metric | Value |
|---|---|
| Fixture count | **214** |
| Competitions represented | Premier League only |
| xG both / one / none | **214 / 0 / 0** (both share 100%; coverage 100%) |
| expected_goals / shots / SOT / possession / corners | **100%** |
| yellow_cards | **97.196%** |
| red_cards | **13.084%** |

## AET / PEN audit

This batch: **0** AET/PEN fixtures (all FT). Prior AET/PEN remain `AMBIGUOUS_FOR_REGULATION_FEATURES` where previously audited.

## Calendar 2025 / holdout

| Metric | Value |
|---|---|
| Calendar-2025 fixtures in batch | **26** (IDs under sealed holdout) |
| Holdout status | **SEALED** |
| Modeling on 2025 | **NONE** |

## Remaining queue

| Metric | Value |
|---|---|
| Remaining uncached after Stage-2E | **343** |
| Cumulative cached envelopes | **751** |

## Artifacts

Directory: `data/calibration/pe4-acquisition-v1/stage2e-i10/`

Includes: `batch-manifest.json`, fixture ID lists, batch/cumulative field + xG coverage, competition coverage (+ cumulative), **competition-coverage-matrix.json**, provider-season coverage, **provider-season-2024-coverage.json**, calendar-year, status, AET/PEN, raw-fields, call-accounting, resume, `stage2e-report.json`.

## Script

```bash
npm run calibration:pe4i10-stage2e-stats -- --execute-live --confirm-provider-calls --stage statistics --max-calls 150
```
