# PE-4I.8 — Stage-2C Third Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2C statistics batch only  
**Modeling:** **NONE**

## Frozen queue

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

## Starting cache state

| Metric | Value |
|---|---|
| Initial statistics cache hits | **301** |
| Initial uncached | **793** |
| Prior I.6/I.7 successes re-requested | **0** |

## Batch selection

| Metric | Value |
|---|---|
| Selected | 150 |
| Range | `1035474` → `1126416` |
| Selection digest | `ec23eb7698b1e10e13ea0fd5c1bf579af16ce146deed975b256451f3c596e2c3` |

### By competition (natural queue order)

| Competition | Count |
|---|---|
| Premier League | 80 |
| UEFA Champions League | 24 |
| League Cup | 22 |
| UEFA Europa League | 16 |
| UEFA Europa Conference League | 8 |

### By provider season / calendar year

| Axis | Values |
|---|---|
| Provider season | 2023 = 150 (2024 **not** reached) |
| Calendar year | 2023 = 70; 2024 = 80 |

## Call accounting

| Metric | Value |
|---|---|
| Attempted / succeeded / failed | **150 / 150 / 0** |
| New cache writes | 150 |
| Remaining uncached | **643** |
| Schedule attempts | 0 |

## Resume verification

Provider calls = **0**; cache hits = **150**; failures = **0**.

## Cross-competition / season transition

| Transition | Reached? |
|---|---|
| Provider season 2024 | **NO** |
| FA Cup | **NO** |
| League Cup | **YES** |
| UCL | **YES** |
| UEL | **YES** |
| UECL | **YES** |

## Field coverage

Goals remain fixture-evidence sourced (not statistics endpoint).

### Batch (150 / 300 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 252 | 48 | **84** |
| total_shots | 300 | 0 | **100** |
| shots_on_goal | 300 | 0 | **100** |
| ball_possession | 300 | 0 | **100** |
| corner_kicks | 300 | 0 | **100** |
| yellow_cards | 288 | 12 | **96** |
| red_cards | 22 | 278 | **7.333** |

### Cumulative (451 envelopes / 902 team-sides)

| Field | Present | Missing | Coverage % |
|---|---|---|---|
| expected_goals | 854 | 48 | **94.678** |
| total_shots / SOT / possession / corners | 902 | 0 | **100** |
| yellow_cards | 882 | 20 | **97.783** |
| red_cards | 118 | 784 | **13.082** |

## xG audit (thresholds unchanged)

HIGH ≥0.90 / PARTIAL ≥0.50 / LOW ≥0.10 / UNUSABLE <0.10

### Batch

| Metric | Value |
|---|---|
| Both teams | **126** |
| One team | 0 |
| Neither | **24** |
| Team-side present / missing | 252 / 48 |
| Coverage % | **84** |
| Classification | **XG_COVERAGE_PARTIAL** |

### Batch xG by competition

| Competition | Both | None |
|---|---|---|
| Premier League | 80/80 | 0 |
| UCL | 24/24 | 0 |
| UEL | 16/16 | 0 |
| UECL | 6/8 | 2 |
| **League Cup** | **0/22** | **22** |

League Cup early-round fixtures in this sample have **no** provider `expected_goals`.

### Cumulative

| Metric | Value |
|---|---|
| Both teams | **427 / 451** |
| Neither | 24 |
| Coverage % | **94.678** |
| Classification | **XG_COVERAGE_HIGH** |

## AET / PEN audit

3 League Cup PEN fixtures flagged `AMBIGUOUS_FOR_REGULATION_FEATURES`
(`1115636`, `1115642`, `1115646`). Raw evidence preserved; not regulation-90 features.

## Card semantics

Null card fields = **missing**, not zero.

## Holdout firewall

Calendar-2025 in batch: **0**. Provider season=2025 requests: **0**. Holdout **SEALED**.

## Artifacts

`data/calibration/pe4-acquisition-v1/stage2c-i8/` (gitignored; digests in report).

## Limitations

- Provider season 2024 and FA Cup still not reached by canonical queue order
- League Cup xG coverage is **0%** in this sample — do not extrapolate PL xG rates to cups
- Remaining uncached: **643**

## Recommended next phase

**PE-4I.9 — Stage-2D statistics batch** (next ≤150), still no modeling.
