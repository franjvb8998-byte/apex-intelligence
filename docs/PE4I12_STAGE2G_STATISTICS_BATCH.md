# PE-4I.12 — Stage-2G Seventh Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2G statistics batch only  
**Modeling:** **NONE**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state

| Metric | Value |
|---|---|
| Initial statistics cache hits | **901** |
| Initial uncached | **193** |
| Prior I.6–I.11 successes re-requested | **0** |

## Deterministic selection

| Metric | Value |
|---|---|
| Selected | 150 |
| Range | `1208387` → `1349956` |
| Selection digest | `af8cece4d49919e65ac9614dabd870d3f694b66f52b2890d64d06c345b5d7dfa` |

### By competition / provider season / calendar year / status

| Axis | Values |
|---|---|
| Competition | FA Cup = **35**; League Cup = **41**; Premier League = **16**; UEFA Champions League = **34**; UEFA Europa Conference League = **8**; UEFA Europa League = **16** |
| Provider season | **2024 = 150** |
| Calendar year | **2024 = 81**; **2025 = 69** (2025 acquired under sealed holdout — no modeling) |
| Status | FT = 140; PEN = 9; AET = 1 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **150 / 150 / 0** |
| New cache writes | 150 |
| Remaining uncached | **43** |
| Schedule attempts | 0 |

## Resume verification

Provider calls = **0**; cache hits = **150**; failures = **0**.

## Field coverage

Goals remain fixture-evidence sourced (not statistics endpoint). Null card fields are missing, **not** zero.

### Batch (150 fixtures / 300 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 144 | 156 | **48** |
| total_shots / shots_on_goal / ball_possession / corner_kicks | 300 | 0 | **100** |
| yellow_cards | 266 | 34 | **88.667** |
| red_cards | 34 | 266 | **11.333** |

### Cumulative (1051 envelopes / 2102 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 1776 | 326 | **84.491** |
| total_shots / SOT / possession / corners | 2096 | 6 | **99.715** |
| yellow_cards | 2000 | 102 | **95.147** |
| red_cards | 252 | 1850 | **11.989** |

## xG coverage

Thresholds unchanged: HIGH ≥ 0.90; PARTIAL ≥ 0.50; LOW ≥ 0.10; UNUSABLE < 0.10.

| Scope | Both | One | None | Coverage % | Class |
|---|---|---|---|---|---|
| Batch | 72 | 0 | 78 | 48 | `XG_COVERAGE_LOW` |
| Cumulative | 888 | 0 | 163 | 84.491 | `XG_COVERAGE_PARTIAL` |

**Emphasize:** Any previously HIGH cumulative xG was **PL-volume-driven** — **not** universal cross-competition capability. This batch’s cup-heavy mix drops batch xG to LOW and cumulative to PARTIAL. Cup `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` pattern is **preserved** (no new cup xG evidence appeared).

## Competition coverage matrix (cumulative, all cached queue envelopes)

**Important:** `observedXgLabel` values are **coverage labels from the observed sample only** — they are **NOT** model branches, capability gates, or production routing decisions.

| Competition | n | xG both/one/none | both share % | Label | eg % | shots/SOT/poss/corners % | yel % | red % |
|---|---|---|---|---|---|---|---|---|
| Premier League | 760 | 760/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.842 | 13.158 |
| UEFA Champions League | 66 | 66/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 92.424 | 7.576 |
| UEFA Europa League | 44 | 44/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 95.455 | 11.364 |
| UEFA Europa Conference League | 22 | 18/0/4 | 81.818 | `XG_PARTIAL_IN_OBSERVED_SAMPLE` | 81.818 | 100 | 95.455 | 13.636 |
| FA Cup | 82 | 0/0/82 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 96.341 | 80.488 | 10.976 |
| League Cup | 77 | 0/0/77 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 100 | 96.104 | 5.195 |

Label rules (observed sample only): bothShare ≥ 0.90 → `XG_CAPABLE_IN_OBSERVED_SAMPLE`; ≥ 0.50 → `XG_PARTIAL_IN_OBSERVED_SAMPLE`; else → `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE`.

## Provider season 2024 cumulative audit

Across **all** acquired Stage-2 evidence (not this batch only):

| Metric | Value |
|---|---|
| Fixture count | **514** |
| Competitions represented | FA Cup, League Cup, Premier League, UCL, UECL, UEL |
| xG both / one / none | **436 / 0 / 78** (both share 84.825%; coverage 84.825%) |
| expected_goals | **84.825%** |
| shots / SOT / possession / corners | **100%** |
| yellow_cards | **93.774%** |
| red_cards | **11.673%** |

## AET / PEN audit

This batch: **10** AET/PEN fixtures (9 PEN + 1 AET) — all classified `AMBIGUOUS_FOR_REGULATION_FEATURES` (provider statistics cannot be proven regulation-only; do not use as regulation-90 features). Statuses: League Cup PEN ×6; FA Cup PEN ×3; FA Cup AET ×1.

## Calendar 2025 / holdout firewall

| Metric | Value |
|---|---|
| `CALENDAR_2025_FIXTURES_IN_BATCH` | **69** |
| `CUMULATIVE_CALENDAR_2025_RAW_FIXTURES` | **245** among all successfully cached Stage-2 queue envelopes |
| Holdout status | **SEALED** |
| Modeling / fitting / selection / calibration / eval on 2025 | **NONE** — raw-only |

Cumulative 2025 IDs are recorded in `calendar-2025-cumulative-audit.json` with an explicit sealed-holdout note.

## Remaining queue

| Metric | Value |
|---|---|
| Remaining uncached after Stage-2G | **43** |
| Cumulative cached envelopes | **1051** |

**Final statistics batch** for the remaining ~43 fixtures requires **separate authorization** — do not start PE-4I.13 / final batch without it. Field: `READY_FOR_FINAL_STATISTICS_BATCH = true` (remaining > 0; authorize separately).

## Artifacts

Directory: `data/calibration/pe4-acquisition-v1/stage2g-i12/`

Includes: `batch-manifest.json`, fixture ID lists, batch/cumulative field + xG coverage, competition coverage (+ cumulative), **competition-coverage-matrix.json**, provider-season coverage, **provider-season-2024-coverage.json**, calendar-year, **calendar-2025-audit.json**, **calendar-2025-cumulative-audit.json**, status, AET/PEN, raw-fields, call-accounting, resume, `stage2g-report.json`.

## Script

```bash
npm run calibration:pe4i12-stage2g-stats -- --execute-live --confirm-provider-calls --stage statistics --max-calls 150
```
