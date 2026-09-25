# PE-4I.6 — Stage-2A Bounded Fixture Statistics Acquisition (First Batch)

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-2A statistics batch only  
**Schedule endpoint:** **NOT called**  
**Provider season 2025:** **NOT requested**  
**Modeling:** **NONE**

## Purpose

Acquire fixture statistics for **only the first deterministic batch** of the
frozen PE-4I.5 Stage-2 queue (max **150** new provider calls), then stop for
integrity / coverage validation.

## Frozen queue identity

| Metric | Value |
|---|---|
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Queue size | 1094 |
| Artifact | `data/calibration/pe4-acquisition-v1/stage1-i5/stage2-statistics-queue.json` |

Digest verified against PE-4I.5 frozen artifact before HTTP.

## Live authorization

```text
--execute-live --confirm-provider-calls --stage statistics --max-calls 150
```

## Batch selection

| Metric | Value |
|---|---|
| Initial statistics cache hits | 1 (PE-4I.3 fixture `1208021`) |
| Initial uncached | 1093 |
| Selected batch size | 150 |
| First selected fixture ID | `1035037` |
| Last selected fixture ID | `1035323` |
| Batch selection digest | `f3feb720864a4c89d3f57a275642425f25e000c0d5f3ad8c61cc44be85a7468c` |

Selection walks the frozen sorted queue, skips valid cache hits, takes the next
150 uncached IDs. No reshuffle by competition/season.

## Call accounting

| Metric | Value |
|---|---|
| Provider calls attempted | **150** |
| Provider calls succeeded | **150** |
| Provider calls failed | **0** |
| New statistics cache writes | **150** |
| Remaining call budget | 0 |
| Remaining uncached queue | **943** |
| Schedule endpoint attempts | 0 |

## Resume verification (offline)

| Metric | Value |
|---|---|
| Provider calls | **0** |
| Cache hits (successful batch fixtures) | **150** |
| Failures | **0** |

## Field coverage (150 successful envelopes; 300 expected team-sides)

| Field | Present | Missing | Parseable | Coverage % |
|---|---|---|---|---|
| goals | 0 | 300 | 0 | **0** (not in provider statistics payload) |
| expected_goals | 300 | 0 | 300 | **100** |
| total_shots | 300 | 0 | 300 | **100** |
| shots_on_goal | 300 | 0 | 300 | **100** |
| ball_possession | 300 | 0 | 300 | **100** |
| corner_kicks | 300 | 0 | 300 | **100** |
| yellow_cards | 294 | 6 | 294 | **98** |
| red_cards | 58 | 242 | 58 | **19.333** |

**Important:** missing ≠ zero. Provider often returns `null` for red/yellow
when the side has zero cards; those remain `missing`, not numeric 0.

Goals for/against remain on schedule fixture rows (homeGoals/awayGoals), not
in `/fixtures/statistics`.

### Raw provider fields observed (preserved)

Ball Possession, Blocked Shots, Corner Kicks, expected_goals, Fouls,
Goalkeeper Saves, Offsides, Passes %, Passes accurate, Red Cards,
Shots insidebox, Shots off Goal, Shots on Goal, Shots outsidebox,
Total passes, Total Shots, Yellow Cards.

## xG audit

**Thresholds declared before inspecting results:**

| Class | both-team share of successful fixtures |
|---|---|
| XG_COVERAGE_HIGH | ≥ 0.90 |
| XG_COVERAGE_PARTIAL | ≥ 0.50 and < 0.90 |
| XG_COVERAGE_LOW | ≥ 0.10 and < 0.50 |
| XG_COVERAGE_UNUSABLE | < 0.10 |

| Metric | Value |
|---|---|
| XG_FIXTURES_WITH_BOTH_TEAMS | **150** |
| XG_FIXTURES_ONE_TEAM_ONLY | 0 |
| XG_FIXTURES_WITHOUT_XG | 0 |
| XG_TEAM_SIDE_PRESENT | 300 |
| XG_TEAM_SIDE_MISSING | 0 |
| XG_PARSEABLE_NUMERIC | 300 |
| XG_COVERAGE_PERCENT | **100** |
| XG_CLASSIFICATION | **XG_COVERAGE_HIGH** |

By competition (this batch): Premier League only — 150/150 both-team xG.  
By provider season: 2023 only — 150/150 both-team xG.

Global xG status remaining claim:
`OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE` expanded to this PL-2023 batch sample;
still **not** a claim of coverage for cups/Europe/later seasons until acquired.

No xG imputation. No EloPoisson substitution. No fitting.

## Competition coverage

This first batch (canonical ID order) is entirely **Premier League / provider season 2023**:

| Competition | Selected | Succeeded | Failed | xG both | Shots % | SOT % | Poss % | Corners % | Cards % (Y+R avg) |
|---|---|---|---|---|---|---|---|---|---|
| Premier League | 150 | 150 | 0 | 150 | 100 | 100 | 100 | 100 | 58.667 |

Cards average is pulled down by frequent missing red-card nulls.

## AET / PEN audit

No AET/PEN fixtures in this batch (`aetPenAudit` empty). Policy remains:
if AET/PEN appear later, flag for audit — do not invent regulation-only stats.

## 2025 firewall

- Calendar-2025 fixtures in this batch: **0**
- Provider season=2025 requests: **0**
- Research holdout-2025: **SEALED**
- Axes remain distinct: providerSeason / calendarKickoffYear / researchSeasonRole

## Artifacts (gitignored)

Under `data/calibration/pe4-acquisition-v1/stage2a-i6/`:

| File | Digest |
|---|---|
| batch-manifest.json | `299c0b35…837767` |
| attempted-fixture-ids.json | `5b1ff953…794d5d` |
| successful-fixture-ids.json | `ecf83479…7e771d` |
| failed-fixture-ids.json | `1d24fe76…c3625b` |
| field-coverage.json | `b9ccfc41…0016e5` |
| xg-coverage.json | `032c14c6…8e103f` |
| competition-coverage.json | `41a86c9f…5df50d` |
| raw-field-inventory.json | `68ac1da8…2516a4` |
| aet-pen-audit.json | `4ac0c4ef…63f336` |
| call-accounting.json | `5c4c28bf…aab1c2` |
| resume-verification.json | `06a72d76…0b0791d` |

## Safety / unchanged

- `PE3C_C0_RECON_ACTIVATION = false`
- Production expectation = `UNAVAILABLE`
- G1 k=10 unchanged
- No Supabase / lifecycle / scanner / scheduler / workflow changes
- No MODEL_C / form / xG fitting / odds / tickets
- No commit / push of generated data

## Limitations

- Batch is PL 2023 only (canonical fixture-id order); cups/Europe not yet sampled.
- Goals absent from statistics endpoint — use schedule goals separately.
- Red/yellow card nulls are missing, not zero.
- Remaining queue: **943** uncached fixtures.
- Do not extrapolate this batch’s 100% xG to the full 1094 queue.

## Recommended next phase

**PE-4I.7 — Stage-2B statistics batch** (next ≤150 uncached queue fixtures),
still no modeling, until queue is exhausted or separately authorized for
feature construction.
