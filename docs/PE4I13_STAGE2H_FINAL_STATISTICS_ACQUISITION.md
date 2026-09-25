# PE-4I.13 — Stage-2H FINAL Bounded Statistics Acquisition

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2H FINAL statistics acquisition only  
**Modeling:** **NONE**  
**Status:** **ACQUISITION_COMPLETE = true**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state (post–Stage-2G)

| Metric | Value |
|---|---|
| Initial statistics cache hits | **1051** |
| Initial uncached | **43** |
| Prior I.6–I.12 successes re-requested | **0** |

## Deterministic final selection

| Metric | Value |
|---|---|
| Selected | **43** (equals remaining uncached; hard max 43) |
| Range | `1349957` → `1374899` |
| Selection digest | `20e21542411ee6eb37c71331537f5858623f754d1ab0748c36450d61abd62ae6` |

### By competition / provider season / calendar year / status

| Axis | Values |
|---|---|
| Competition | FA Cup = **10**; League Cup = **1**; UEFA Champions League = **12**; UEFA Europa Conference League = **7**; UEFA Europa League = **13** (no PL in this final slice) |
| Provider season | **2024 = 43** |
| Calendar year | **2025 = 43** (acquired under sealed holdout — no modeling) |
| Status | FT = 38; PEN = 4; AET = 1 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **43 / 43 / 0** |
| New cache writes | 43 |
| Remaining uncached | **0** |
| Schedule attempts | 0 |

## Final queue completion audit

| Metric | Value |
|---|---|
| Queue size | **1094** |
| Valid statistics cache hits | **1094** |
| Remaining uncached fixtures | **0** |
| Successful queue coverage % | **100** |
| `complete` | **true** |

**ACQUISITION_COMPLETE = true** (1094 / 1094 / 0 / 100%). Do not fabricate — this reflects actual post-acquire cache state.

## Resume verification (zero provider calls)

### Batch (selected 43)

Provider calls = **0**; cache hits = **43**; failures = **0**.

### Full queue (all 1094)

Provider calls = **0**; fullQueueCacheHits = **1094**; fullQueueUncached = **0**; fullQueueFailuresOrConflicts = **0**.

## Field coverage

Goals remain fixture-evidence sourced (not statistics endpoint). Null card fields are missing, **not** zero.

### Batch (43 fixtures / 86 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 64 | 22 | **74.419** |
| total_shots / shots_on_goal / ball_possession / corner_kicks | 86 | 0 | **100** |
| yellow_cards | 80 | 6 | **93.023** |
| red_cards | 12 | 74 | **13.953** |

### Cumulative FINAL (1094 envelopes / 2188 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 1840 | 348 | **84.095** |
| total_shots / SOT / possession / corners | 2182 | 6 | **99.726** |
| yellow_cards | 2080 | 108 | **95.064** |
| red_cards | 264 | 1924 | **12.066** |

## xG coverage

Thresholds unchanged: HIGH ≥ 0.90; PARTIAL ≥ 0.50; LOW ≥ 0.10; UNUSABLE < 0.10.

| Scope | Both | One | None | Coverage % | Class |
|---|---|---|---|---|---|
| Batch | 32 | 0 | 11 | 74.419 | `XG_COVERAGE_PARTIAL` |
| Cumulative FINAL | 920 | 0 | 174 | 84.095 | `XG_COVERAGE_PARTIAL` |

Cup `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` pattern is **preserved** (FA Cup / League Cup remain 0 both-team xG). PL / UCL / UEL remain `XG_CAPABLE_IN_OBSERVED_SAMPLE`; UECL remains `XG_PARTIAL_IN_OBSERVED_SAMPLE`.

## Competition coverage matrix (cumulative FINAL, all cached queue envelopes)

**Important:** `observedXgLabel` values are **coverage labels from the observed sample only** — they are **NOT** model branches, capability gates, or production routing decisions.

| Competition | n | xG both/one/none | both share % | Label | eg % | shots % | yel % | red % |
|---|---|---|---|---|---|---|---|---|
| Premier League | 760 | 760/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.842 | 13.158 |
| UEFA Champions League | 78 | 78/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 92.308 | 8.974 |
| UEFA Europa League | 57 | 57/0/0 | 100 | `XG_CAPABLE_IN_OBSERVED_SAMPLE` | 100 | 100 | 96.491 | 14.035 |
| UEFA Europa Conference League | 29 | 25/0/4 | 86.207 | `XG_PARTIAL_IN_OBSERVED_SAMPLE` | 86.207 | 100 | 93.103 | 10.345 |
| FA Cup | 92 | 0/0/92 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 96.739 | 81.522 | 10.87 |
| League Cup | 78 | 0/0/78 | 0 | `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE` | 0 | 100 | 96.154 | 5.128 |

Label rules (observed sample only): bothShare ≥ 0.90 → `XG_CAPABLE_IN_OBSERVED_SAMPLE`; ≥ 0.50 → `XG_PARTIAL_IN_OBSERVED_SAMPLE`; else → `XG_UNAVAILABLE_IN_OBSERVED_SAMPLE`.

**PL / UEFA vs FA Cup / League Cup distinction is preserved.**

## Provider season 2024 cumulative audit

Across **all** acquired Stage-2 evidence (not this batch only):

| Metric | Value |
|---|---|
| Fixture count | **557** |
| Competitions represented | FA Cup, League Cup, Premier League, UCL, UECL, UEL |
| xG both / one / none | **468 / 0 / 89** (both share 84.022%; coverage 84.022%) |
| expected_goals | **84.022%** |
| shots / SOT / possession / corners | **100%** |
| yellow_cards | **93.716%** |
| red_cards | **11.849%** |

## AET / PEN audit

This batch: **5** AET/PEN fixtures (4 PEN + 1 AET) — all classified `AMBIGUOUS_FOR_REGULATION_FEATURES` (provider statistics cannot be proven regulation-only; do not use as regulation-90 features). Statuses: FA Cup PEN ×3; UCL PEN ×1; UEL AET ×1.

## Calendar 2025 / holdout firewall

| Metric | Value |
|---|---|
| `CALENDAR_2025_FIXTURES_IN_BATCH` | **43** |
| `CUMULATIVE_CALENDAR_2025_RAW_FIXTURES` (FINAL) | **288** among all successfully cached Stage-2 queue envelopes |
| Holdout status | **SEALED** |
| Modeling / fitting / selection / calibration / eval on 2025 | **NONE** — raw-only |

FINAL cumulative 2025 IDs are recorded in `calendar-2025-cumulative-audit.json` with `finalCumulative: true` and an explicit sealed-holdout note.

## Remaining queue

| Metric | Value |
|---|---|
| Remaining uncached after Stage-2H | **0** |
| Cumulative cached envelopes | **1094** |
| ACQUISITION_COMPLETE | **true** |

## Next phase (NOT modeling)

**SEPARATE** full acquisition / dataset integrity audit. **NO modeling yet.** Do not open another acquisition batch; do not start PE-4 goals / form / strength modeling from this phase.

## Artifacts

Directory: `data/calibration/pe4-acquisition-v1/stage2h-i13/`

Includes: `batch-manifest.json`, fixture ID lists, batch/cumulative field + xG coverage, competition coverage (+ cumulative), **competition-coverage-matrix.json**, provider-season coverage, **provider-season-2024-coverage.json**, calendar-year, **calendar-2025-audit.json**, **calendar-2025-cumulative-audit.json** (FINAL), **final-queue-completion-audit.json**, status, AET/PEN, raw-fields, call-accounting, resume + **final-resume-verification.json**, `stage2h-report.json`.

## Script

```bash
npm run calibration:pe4i13-stage2h-final-stats -- --execute-live --confirm-provider-calls --stage statistics --max-calls 43
```
