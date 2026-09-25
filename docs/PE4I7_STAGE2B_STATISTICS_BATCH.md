# PE-4I.7 — Stage-2B Second Bounded Statistics Batch

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2B statistics batch only  
**Schedule endpoint:** **NOT called**  
**Modeling:** **NONE**

## Frozen queue identity

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |

Verified unchanged from PE-4I.5 / PE-4I.6 before HTTP.

## Cache state before batch

| Metric | Value |
|---|---|
| Initial statistics cache hits | **151** (1 PE-4I.3 smoke + 150 PE-4I.6) |
| Initial uncached | **943** |
| PE-4I.6 successful IDs re-requested | **0** (all cache hits skipped) |

## Batch selection

| Metric | Value |
|---|---|
| Selected batch size | 150 |
| First selected | `1035324` |
| Last selected | `1035473` |
| Batch selection digest | `23d633b38a9e7ec0addde1a0201c5bcae61139b955c08ea6ab4543760acb91a5` |
| By competition | Premier League = 150 |
| By provider season | 2023 = 150 |

Canonical queue order unchanged — no competition targeting.

## Call accounting

| Metric | Value |
|---|---|
| Provider calls attempted | **150** |
| Succeeded | **150** |
| Failed | **0** |
| New cache writes | **150** |
| Remaining budget | 0 |
| Remaining uncached after batch | **793** |
| Schedule endpoint attempts | 0 |

## Resume verification (offline)

| Metric | Value |
|---|---|
| Provider calls | **0** |
| Cache hits | **150** |
| Failures | **0** |

## Field coverage

Goals remain **fixture-evidence sourced** (schedule `homeGoals`/`awayGoals`).
Absence of a statistics `goals` field is **not** treated as label loss.

### This batch (150 fixtures / 300 team-sides)

| Field | Present | Missing | Parseable | Coverage % |
|---|---|---|---|---|
| expected_goals | 300 | 0 | 300 | **100** |
| total_shots | 300 | 0 | 300 | **100** |
| shots_on_goal | 300 | 0 | 300 | **100** |
| ball_possession | 300 | 0 | 300 | **100** |
| corner_kicks | 300 | 0 | 300 | **100** |
| yellow_cards | 298 | 2 | 298 | **99.333** |
| red_cards | 38 | 262 | 38 | **12.667** |

### Cumulative Stage-2 acquired evidence (301 envelopes)

| Field | Present | Missing | Parseable | Coverage % |
|---|---|---|---|---|
| expected_goals | 602 | 0 | 602 | **100** |
| total_shots | 602 | 0 | 602 | **100** |
| shots_on_goal | 602 | 0 | 602 | **100** |
| ball_possession | 602 | 0 | 602 | **100** |
| corner_kicks | 602 | 0 | 602 | **100** |
| yellow_cards | 594 | 8 | 594 | **98.671** |
| red_cards | 96 | 506 | 96 | **15.947** |

missing ≠ zero for cards.

### Raw fields observed (batch)

Ball Possession, Blocked Shots, Corner Kicks, expected_goals, Fouls,
Goalkeeper Saves, Offsides, Passes %, Passes accurate, Red Cards,
Shots insidebox, Shots off Goal, Shots on Goal, Shots outsidebox,
Total passes, Total Shots, Yellow Cards.

## xG audit

**Same predeclared thresholds as PE-4I.6** (unchanged after results):

| Class | both-team share |
|---|---|
| HIGH | ≥ 0.90 |
| PARTIAL | ≥ 0.50 |
| LOW | ≥ 0.10 |
| UNUSABLE | < 0.10 |

### Batch

| Metric | Value |
|---|---|
| Both teams | **150** |
| One team only | 0 |
| Neither | 0 |
| Team-side present | 300 |
| Team-side missing | 0 |
| Parseable numeric | 300 |
| Coverage % | **100** |
| Classification | **XG_COVERAGE_HIGH** |

By competition: Premier League 150/150 both.  
By provider season: 2023 150/150 both.

### Cumulative (301 envelopes)

| Metric | Value |
|---|---|
| Both teams | **301** |
| One / neither | 0 / 0 |
| Team-side present | 602 |
| Coverage % | **100** |
| Classification | **XG_COVERAGE_HIGH** |

By competition: Premier League 301/301.  
By provider season: 2023 = 300; 2024 = 1 (PE-4I.3 smoke fixture).

Cups/Europe still **not reached** by canonical queue order.

## AET / PEN

None in this batch. Policy unchanged: AET/PEN →
`AMBIGUOUS_FOR_REGULATION_FEATURES` if encountered later.

## 2025 firewall

- Calendar-2025 fixtures in batch: **0**
- Provider season=2025 requests: **0**
- Holdout-2025: **SEALED**

## Artifacts (gitignored)

Under `data/calibration/pe4-acquisition-v1/stage2b-i7/` — see report
`artifactDigests` for full sha256 list.

## Safety / unchanged

- PE3 activation false; expectation UNAVAILABLE; G1 k=10
- No Supabase / lifecycle / scanner / modeling
- No commit / push of generated data

## Limitations

- Still Premier League 2023-dominant (canonical ID order)
- Cups/Europe coverage unknown until queue reaches those IDs
- Red-card nulls remain missing, not zero
- Remaining uncached: **793**

## Recommended next phase

**PE-4I.8 — Stage-2C statistics batch** (next ≤150 uncached), still no modeling.
