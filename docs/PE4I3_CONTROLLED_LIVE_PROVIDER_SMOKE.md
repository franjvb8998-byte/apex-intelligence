# PE-4I.3 — Controlled Live Provider Smoke

**Base HEAD:** `bb5d9d0decf87cca49a5e79b47442fc8534733c7`  
**Date:** 2026-09-24  
**Max provider calls:** 3 (used: 2 first pass + 0 second pass)

## Sample

| Field | Value |
|---|---|
| Team | Manchester United |
| providerTeamId | 33 (lowest id in frozen 2024 PL roster) |
| Season | 2024 |
| Schedule call | `GET /fixtures?team=33&season=2024` |
| Statistics fixture | 1208021 (PL FT, kickoff 2024-08-16T19:00:00.000Z) |

## Provider call budget

| Pass | Attempted | Succeeded | Failed | Cache hits | Remaining |
|---|---|---|---|---|---|
| First | 2 | 2 | 0 | 0 | 1 |
| Second | 0 | 0 | 0 | 2 | 3 |

**Call 3 unused** (reserved; not spent).

## Competitions observed (team=33, season=2024)

| ID | Provider name | Fixtures | Registry pin |
|---|---|---|---|
| 39 | Premier League | 38 | `target_domestic_league` (pre-existing) |
| 3 | UEFA Europa League | 15 | `uefa_europa_league` (**new I.3**) |
| 45 | FA Cup | 3 | `domestic_cup` (**new I.3**) |
| 48 | League Cup | 3 | `domestic_league_cup` (**new I.3**) |
| 528 | Community Shield | 1 | `other_known_competition` (**new I.3**) |
| 667 | Friendlies Clubs | 5 | `other_known_competition` (**new I.3**) |
| 1022 | Premier League - Summer Series | 3 | `other_known_competition` (**new I.3**) |

**Cross-competition history confirmed:** YES

Not observed for this club/season (remain unpinned): UEFA Champions League (2), UEFA Conference League (848).

## Schedule summary

- Fixtures returned: 68 (unique)
- Statuses: FT=63, PEN=4, AET=1
- Kickoff range: 2024-07-15 → 2025-08-03 (provider season window can spill past calendar year; feature builds must still enforce kickoff(M)<kickoff(T))

## Statistics fields (fixture 1208021)

Present (both sides, parseable unless noted): Total Shots, Shots on Goal, Ball Possession, Corner Kicks, Yellow Cards, expected_goals, plus blocked/offsides/passes/saves/etc.

Red Cards: field present with null values → treated as **missing** (not zero).

### xG

**XG_STATUS = OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE**

- Raw field: `expected_goals`
- Values: team 33 → `"2.43"`; team 36 → `"0.44"`
- Does **not** prove global coverage
- Not EloPoisson expectedGoals

## Cache proof

Second orchestration pass: **0** provider attempts, **2** cache hits.

## Holdout / safety

- 2025 outcome evaluation: SEALED
- No form/fatigue/G1/MODEL_C changes
- No lifecycle/scanner/scheduler wiring
- API key never logged

## Bulk acquisition estimate (next phase)

Rough: ~40 team-season schedule calls (20 clubs × 2 seasons) + ~2k–3k statistics calls after unique fixture discovery. Requires separate authorization and higher `--max-calls`.

## Limitations

- Single-club smoke
- Season response includes friendlies / summer series / post-May fixtures
- UCL/UECL ids not evidenced in this sample
- Cards: yellow present; red null-as-missing on this fixture
