# PE-4I.11 — Stage-2F Sixth Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2F statistics batch only  
**Modeling:** **NONE**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state

| Metric | Value |
|---|---|
| Initial statistics cache hits | **751** |
| Initial uncached | **343** |
| Prior I.6–I.10 successes re-requested | **0** |

## Deterministic selection

| Metric | Value |
|---|---|
| Selected | 150 |
| Range | `1208237` → `1208386` |
| Selection digest | `df128911a44732b03fde999e812b69988f0e4d9c49978972b372f03cef9c89f9` |

### By competition / provider season / calendar year / status

| Axis | Values |
|---|---|
| Competition | Premier League = **150** |
| Provider season | **2024 = 150** |
| Calendar year | **2025 = 150** (acquired under sealed holdout — no modeling) |
| Status | FT = 150 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **150 / 150 / 0** |
| New cache writes | 150 |
| Remaining uncached | **193** |
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
| yellow_cards | **94** |
| red_cards | **10** |

### Cumulative (901 envelopes / 1802 team-sides)

| Field | Coverage % |
|---|---|
| expected_goals | **90.566** |
| total_shots / SOT / possession / corners | **99.667** |
| yellow_cards | **96.226** |
| red_cards | **12.098** |

## xG coverage

Thresholds unchanged: HIGH ≥ 0.90; PARTIAL ≥ 0.50; LOW ≥ 0.10; UNUSABLE < 0.10.

| Scope | Both | One | None | Coverage % | Class |
|---|---|---|---|---|---|
| Batch | 150 | 0 | 0 | 100 | `XG_COVERAGE_HIGH` |
| Cumulative | 816 | 0 | 85 | 90.566 | `XG_COVERAGE_HIGH` |

## Competition coverage matrix (cumulative, all cached queue envelopes)

**Important:** `observedXgLabel` values are **coverage labels from the observed sample only** — they are **NOT** model branches, capability gates, or production routing decisions.

| Competition | n | xG both/one/none | both share % | Label | eg % | shots/SOT/poss/corners % | yel % | red % |
|---|---|---|---|---|---|---|---|---|
| Premier League | 744 | 744/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 97.043 | 13.038 |
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
| Fixture count | **364** |
| Competitions represented | Premier League only |
| xG both / one / none | **364 / 0 / 0** (both share 100%; coverage 100%) |
| expected_goals / shots / SOT / possession / corners | **100%** |
| yellow_cards | **95.879%** |
| red_cards | **11.813%** |

## AET / PEN audit

This batch: **0** AET/PEN fixtures (all FT). Prior AET/PEN remain `AMBIGUOUS_FOR_REGULATION_FEATURES` where previously audited.

## Calendar 2025 / holdout firewall

| Metric | Value |
|---|---|
| `CALENDAR_2025_FIXTURES_IN_BATCH` | **150** (IDs `1208237`–`1208386`) |
| `CUMULATIVE_CALENDAR_2025_RAW_FIXTURES` | **176** among all successfully cached Stage-2 queue envelopes |
| Holdout status | **SEALED** |
| Modeling / fitting / selection / calibration / eval on 2025 | **NONE** — raw-only |

Cumulative 2025 IDs are recorded in `calendar-2025-cumulative-audit.json` with an explicit sealed-holdout note.

## Remaining queue

| Metric | Value |
|---|---|
| Remaining uncached after Stage-2F | **193** |
| Cumulative cached envelopes | **901** |

## Artifacts

Directory: `data/calibration/pe4-acquisition-v1/stage2f-i11/`

Includes: `batch-manifest.json`, fixture ID lists, batch/cumulative field + xG coverage, competition coverage (+ cumulative), **competition-coverage-matrix.json**, provider-season coverage, **provider-season-2024-coverage.json**, calendar-year, **calendar-2025-audit.json**, **calendar-2025-cumulative-audit.json**, status, AET/PEN, raw-fields, call-accounting, resume, `stage2f-report.json`.

## Script

```bash
npm run calibration:pe4i11-stage2f-stats -- --execute-live --confirm-provider-calls --stage statistics --max-calls 150
```
