# PE-4I.16 — Offline Ledger Materialization + As-of-T Feature Vectors

**Base HEAD (preflight):** `624f56740368c59ad873fed050da478c9d10c232` (main)
**Phase:** Offline research/calibration builders — **ZERO** provider / HTTP / Supabase
**Modeling / fitting / weights / odds-EV / 2025 unsealing:** **NONE**
**Production lifecycle / scanner / scheduler / PE activation:** **NOT WIRED**
**Parent contracts:** PE-4I.15 (law)

## Preflight

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `624f56740368c59ad873fed050da478c9d10c232` |
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Cache | 1094/1094 when local corpus present |
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| Production expectation | **UNAVAILABLE** |
| G1 selectedShrinkageK | **10** |
| Holdout | Sealed |

## Purpose

Materialize presence-aware historical match ledger rows from the PE-4I acquisition corpus and build as-of-T feature vectors under PE-4I.15 contracts — still **no fitting**.

Module: `lib/debug/calibration/pe4-as-of-t-features/`
CLI: `npm run calibration:pe4i16-offline-ledger-features`
Artifacts (gitignored): `data/calibration/pe4-acquisition-v1/stage2i16-ledger/`

## Modules

| File | Role |
|---|---|
| `ledger-materialize.ts` | Stage-1 universe + smoke/bulk statistics → Pe4I15 ledger rows; fail-closed conflicts; holdout + regulationAmbiguity classification; deterministic artifacts |
| `team-perspective.ts` | Fixture ledger → both-side team-perspective history |
| `history-selector.ts` | `history(team, target, window)` with `kickoff(M)<kickoff(T)`; N∈{3,5,8,10}, days∈{30,60,90}; venue `all\|home\|away`; DEV holdout rejection |
| `universal-vector.ts` | Path A aggregates with obs/missing counts; **no** score/weights/multiplier |
| `xg-vector.ts` | Path B additive optional xG; **no** zero-fill / imputation / population shrink |
| `schedule-rest-features.ts` | Days since previous; trailing 7/14/28 match counts from past kickoffs only |
| `opponent-strength-join.ts` | Join only if offline as-of-M strength catalogue exists; otherwise **UNAVAILABLE** |
| `feature-vector.ts` | Path A + Path B + splits + rest + provenance (PE-4I.15 digests) |
| `demo.ts` + `run-pe4i16-offline-ledger-features.ts` | Small deterministic demo on NON-holdout targets; print vectors+provenance; no metrics |

## Opponent strength

**UNAVAILABLE** by default:

`no_offline_as_of_kickoff_m_strength_catalogue_in_pe4_acquisition_corpus`

`pe4-acquisition-v1` holds schedule/statistics envelopes only. `pe4-form-schedule` reconstruction requires an injected `PrematchStrengthUniverseFixture[]` that is **not** materialized in this corpus. No future ratings / fitted expectation map.

## Holdout / AET-PEN

- Calendar-2025 rows may remain in **ledger storage**.
- DEV / feature-selection history selection **excludes** calendar-2025 outcomes.
- AET/PEN marked `regulationAmbiguity`; excluded from results/performance aggregates.

## Production boundary

- `PE4I16_PRODUCTION_WIRING = false`
- No imports into production lifecycle / scanner / scheduler / PE activation
- Expectation remains UNAVAILABLE; G1 untouched; C0 off
- `PROVIDER_CALLS_MADE = 0`

## Validation

```bash
npx vitest run lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/pe4-acquisition lib/prematch-decision/pe4-form-schedule lib/debug/calibration/goals/g1 lib/prematch-lifecycle/pe3f.production-wiring.test.ts lib/prematch-lifecycle/pe3c.integration.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/run-pe4i16-offline-ledger-features.ts
```

## Ready for next phase

**READY_FOR_OFFLINE_FEATURE_DATASET** after builders land — batch feature-dataset emission across DEV-eligible targets (still no fitting), optionally after an offline as-of-M strength catalogue is materialised for opponent-strength joins.

**Recommended next:** PE-4I.17 offline feature dataset emission + coverage accounting (still research-only).
