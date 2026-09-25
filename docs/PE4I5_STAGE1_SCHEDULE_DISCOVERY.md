# PE-4I.5 — Stage-1 Bounded Multi-Competition Schedule Discovery

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Phase:** Live Stage-1 schedule discovery only  
**Statistics endpoint:** **NOT called**  
**Provider season 2025:** **NOT requested**

## Purpose

Execute only Stage 1 of the frozen PE-4I.4 plan: acquire the 39 missing
2023/2024 club-season schedules (reusing Manchester United 2024 from PE-4I.3),
normalize/dedupe the fixture universe, classify competitions, and emit the
**exact** Stage-2 statistics queue — then stop.

## Live authorization contract

All required:

```text
--execute-live --confirm-provider-calls --stage schedule --max-calls 50
```

Hard maximum: **50** attempted provider calls. Unused budget was not consumed.

## Call accounting

| Metric | Value |
|---|---|
| `configuredMaxCalls` | 50 |
| Planned club-season units | 40 |
| Initial cache hits | 1 (MU 2024 smoke → seeded into bulk) |
| Initial missing units | 39 |
| **First-pass provider calls attempted** | **39** |
| Provider calls succeeded | 39 |
| Provider calls failed | 0 |
| Remaining budget | 11 |
| Statistics endpoint attempts | 0 |
| Second-pass provider calls | **0** |
| Second-pass cache hits | **40** |

## Cache / resume

- PE-4I.3 smoke unit `schedule::team=33::season=2024` digest
  `3c7ce9ebbd05eb2cefdbc080b37d64dec74f18e4076f0eeda8b13764657b7148` preserved
  and seeded into `data/calibration/pe4-acquisition-v1/bulk/`.
- Each successful unit persisted to bulk cache/manifest before continuing.
- Second pass: all 40 units served from cache; provider not contacted.

## Fixture universe (40 club-season units)

| Metric | Value |
|---|---|
| Raw schedule rows | 2170 |
| Unique provider fixture IDs | 1309 |
| Identical duplicates collapsed | 861 |
| Conflicting duplicates | 0 |
| Malformed fixtures | 0 |
| Kickoff range | 2023-01-23 → 2025-08-03 (UTC) |
| Statuses | FT 1254, PEN 34, AET 5, CANC 15, Canc 1 |

## Competitions observed

| ID | Name | Unique fixtures | Registry | Primary stats |
|---|---|---|---|---|
| 39 | Premier League | 760 | pinned | INCLUDE |
| 45 | FA Cup | 92 | pinned | INCLUDE |
| 48 | League Cup | 78 | pinned | INCLUDE |
| 2 | UEFA Champions League | 78 | **NEW pin (PE-4I.5)** | INCLUDE |
| 3 | UEFA Europa League | 57 | pinned | INCLUDE |
| 848 | UEFA Europa Conference League | 29 | **NEW pin (PE-4I.5)** | INCLUDE |
| 667 | Friendlies Clubs | 192 | pinned | EXCLUDE |
| 1022 | PL Summer Series | 15 | pinned | EXCLUDE |
| 528 | Community Shield | 2 | pinned | SEPARATE AUDIT |
| 15 | FIFA Club World Cup | 2 | unpinned UNKNOWN | audit |
| 531 | UEFA Super Cup | 1 | unpinned UNKNOWN | audit |
| 866 | MLS All-Star | 1 | unpinned UNKNOWN | audit |
| 937 | Emirates Cup | 2 | unpinned UNKNOWN | audit |

Cross-competition history: **CONFIRMED** in team-season schedules.

### New registry pins

Pinned only after explicit unambiguous provider identity:

- `2` → `uefa_champions_league` (name `UEFA Champions League`)
- `848` → `uefa_conference_league` (name `UEFA Europa Conference League`)

Ambiguous / rare competitions (15, 531, 866, 937) remain **UNKNOWN** (preserved).

## Calendar-2025 spill inside provider season=2024

- **294** fixtures with calendar kickoff year 2025 appear inside
  provider-season **2024** schedules.
- Preserved in raw evidence.
- **Not** treated as research holdout-2025 outcomes.
- Provider season=2025 was never requested.

Axes remain distinct: `providerSeason` ≠ `calendarKickoffYear` ≠ `researchSeasonRole`.

## Exact Stage-2 statistics queue

| Metric | Value |
|---|---|
| **EXACT_STAGE2_UNIQUE_FIXTURES** | **1094** |
| EXISTING_STATISTICS_CACHE_HITS | 1 (PE-4I.3 fixture `1208021`) |
| **EXACT_STAGE2_NEW_CALLS_REQUIRED** | **1093** |
| Naive team-fixture statistics requests | 1926 |
| Calls avoided by fixture-id dedupe | 832 |

### Primary queue by competition

| Competition | Unique eligible fixtures |
|---|---|
| Premier League | 760 |
| FA Cup | 92 |
| League Cup | 78 |
| UEFA Champions League | 78 |
| UEFA Europa League | 57 |
| UEFA Europa Conference League | 29 |

### Excluded / audit counts (unique fixtures)

| Bucket | Count |
|---|---|
| Community Shield | 2 |
| Unknown competition | 6 |
| Friendlies / preseason / summer series | 191 |
| Incomplete / cancelled / other | 16 |

## xG status

`OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE` (PE-4I.3 single fixture only).  
Does **not** imply Stage-2 coverage. Coverage unknown until Stage-2 measures it.

## Artifacts (gitignored)

Under `data/calibration/pe4-acquisition-v1/stage1-i5/`:

| File | Digest (sha256) |
|---|---|
| schedule-acquisition-manifest.json | `a36a17ed0616945f07454d56f88a1aa71b88a2021f6f4f9be72e20c0ee84ad3c` |
| normalized-fixture-universe.json | `997f52edf3448b2991c1363a472e609853a478d89dc38f34795cc1be88b43ddc` |
| competition-inventory.json | `48c6fb1d03c00666e6faa4209c9e572457a248b6be0f5b1d02609a328ac9d087` |
| stage2-statistics-queue.json | `b6aad7a28d9c7c15693a88b688a503fd61acbb6e17d85547b650ab0b4661af2a` |
| excluded-audit-inventory.json | `29cbe046254e4576ee309911d9045e2d8b41fcbf5fc4784e60d1cac31d229fab` |
| call-accounting.json | `50f0a1eadff5223e933867b67aa524b3e016f92d56f909be578a39ef4a34d751` |
| cache-resume-verification.json | `770cae55029bb585cdc4e62e5658f2d665b06211a7dd47f913c8303aa38e18e3` |
| calendar-2025-spill.json | `3e5e129df82dca1b6bcc4aa2bc1c5bf34b72de0aee2193c5c69cecc32138f203` |

Queue digest: `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f`

## Safety / unchanged

- `PE3C_C0_RECON_ACTIVATION = false`
- Production PE expectation = `UNAVAILABLE`
- G1 `selectedShrinkageK = 10` unchanged
- Holdout 2025 **SEALED**
- No Supabase, lifecycle, scanner, scheduler, or workflow changes
- No MODEL_C / form / xG fitting / odds / tickets
- No commit / push of generated data

## Limitations

- Provider status casing inconsistency (`CANC` vs `Canc`) preserved as observed.
- xG coverage across 1094 queue fixtures is unknown until Stage-2.
- Rare competitions (Club World Cup, Super Cup, MLS All-Star, Emirates Cup)
  remain unpinned UNKNOWN.
- Stage-2 not authorized by this phase.

## Recommended next phase

**PE-4I.6 — Stage-2 statistics acquisition** under bounded `maxCalls` batches
(PE-4I.4 suggested 150/run), resume-safe, using the exact 1094-fixture queue
(1093 new calls if cache empty aside from the one PE-4I.3 hit).
