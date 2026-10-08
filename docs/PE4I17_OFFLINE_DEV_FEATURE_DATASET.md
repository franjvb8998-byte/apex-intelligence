# PE-4I.17 — Offline DEV Feature Dataset Emission + Coverage Audit

**Base HEAD (preflight):** `624f56740368c59ad873fed050da478c9d10c232` (main)
**Phase:** Offline research/calibration builders — **ZERO** provider / HTTP / Supabase
**Modeling / fitting / weights / odds-EV / 2025 unsealing:** **NONE**
**Production lifecycle / scanner / scheduler / PE activation:** **NOT WIRED**
**Parent contracts:** PE-4I.15 (law), PE-4I.16 (ledger + vectors)

## Preflight

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `624f56740368c59ad873fed050da478c9d10c232` |
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| Production expectation | **UNAVAILABLE** |
| G1 selectedShrinkageK | **10** |
| Holdout | Sealed |
| stage2i16-ledger | Required (re-materialize offline if missing) |

## Purpose

Emit a deterministic offline **DEV** as-of-T feature dataset for every eligible regulation-outcome target, with Path A + Path B (xG) rows, separated outcome labels, coverage audits, and reproducibility checks — still **no fitting**.

Module: `lib/debug/calibration/pe4-as-of-t-features/`
CLI: `npm run calibration:pe4i17-offline-dev-feature-dataset`
Artifacts (gitignored): `data/calibration/pe4-acquisition-v1/stage2i17-dev-dataset/`

## Modules

| File | Role |
|---|---|
| `pe4i17-protocol.ts` | Protocol pins; emit window IDs; venue modes |
| `target-eligibility.ts` | Deterministic DEV-target eligibility + exclusion reason enum/counts |
| `outcome-labels.ts` | **Separated** labels keyed by fixtureId — never read during feature construction |
| `dataset-emit.ts` | Emit Path A/B records; load/rematerialize ledger; reproducibility; artifacts |
| `coverage-audit.ts` | Competition / window / team / depth / xG / AET-PEN / holdout auditors |

## DEV target eligibility

Eligible iff:

1. Valid fixture identity, kickoff, distinct teams
2. **Not** calendar-2025 holdout / provider-season-2025
3. Completed regulation status supported: **FT** only
4. **AET/PEN default EXCLUDE** (ambiguous regulation; not proven safe)
5. **CANC / Canc** excluded
6. Both-side goals present

Exclusion reasons are explicit enums with counts in `dev-target-manifest.json`.

## Emit grid

For every DEV-eligible target, emit **both** team rows for each:

**Windows (emit IDs):**

- `last_3`, `last_5`, `last_8`, `last_10`
- `trailing_30d`, `trailing_60d`, `trailing_90d`
  (aliases → PE-4I.15 `days_30` / `days_60` / `days_90` specs)

**Venue modes (PE-4I.16 `Pe4I16VenueFilter`):**

- `all` — unfiltered venue history
- `home` — home-only contextual history
- `away` — away-only contextual history

Rows per target = `2 teams × 7 windows × 3 venues = 42`.

## Record contents

Each Path A record includes: `targetFixtureId`, `kickoffUtc`, `competition`, `providerSeason`, `teamId`, `opponentId`, `targetVenueRole`, `windowId`, `venueMode`, Path A vector, schedule/rest, availability, obs/missing, ambiguity exclusions, `historyFixtureIds`, `provenanceDigest`.

Path B file: same population keys + additive xG block (`zeroFillUsed=false`, `populationShifted=false`). **Path B must not shrink Path A population** (fail-closed).

## History rules

- `kickoff(M) < kickoff(T)`
- Reject calendar-2025 history for DEV
- Exclude AET/PEN from results/performance families (PE-4I.16 `rejectRegulationAmbiguous`)
- Labels never consulted during emit

## Outcome separation

`target-labels-separated.json` is written **after** features and is never an input to vector construction. Mutating/removing labels must not change feature digests.

## Artifacts

Under `stage2i17-dev-dataset/`:

- `dev-target-manifest.json`
- `feature-dataset-path-a.jsonl`
- `feature-dataset-path-b-xg.jsonl`
- `target-labels-separated.json`
- `coverage-by-competition.json`
- `coverage-by-window.json`
- `coverage-by-team.json`
- `history-depth-audit.json`
- `xg-coverage-audit.json`
- `aet-pen-audit.json`
- `holdout-firewall-audit.json`
- `reproducibility-audit.json`
- `dataset-manifest.json` (SHA-256 digests)

## Reproducibility

Emit twice + shuffle ledger input → identical canonical dataset digest / ordering. Fail-closed on mismatch.

## Production boundary

- `PE4I17_PRODUCTION_WIRING = false`
- No imports into production lifecycle / scanner / scheduler / PE activation
- Expectation remains UNAVAILABLE; G1 untouched; C0 off
- `PROVIDER_CALLS_MADE = 0`

## Validation

```bash
npx vitest run lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/pe4-acquisition lib/prematch-decision/pe4-form-schedule lib/debug/calibration/goals/g1 lib/prematch-lifecycle/pe3f.production-wiring.test.ts lib/prematch-lifecycle/pe3c.integration.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/run-pe4i17-offline-dev-feature-dataset.ts
npm run calibration:pe4i17-offline-dev-feature-dataset
```

## Ready for next phase

**READY_FOR_NEXT_RESEARCH_PHASE** after dataset + audits land — still research-only.
**Recommended next:** offline feature presence / collinearity / DEV-only exploratory analysis (still no fitting / no 2025 unsealing), or offline as-of-M strength catalogue for opponent-strength joins.
