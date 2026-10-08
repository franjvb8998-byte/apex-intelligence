# PE-4I.18 — Offline Feature Presence, Redundancy & Collinearity Audit

**Base HEAD (preflight):** `624f56740368c59ad873fed050da478c9d10c232` (main)
**Phase:** Offline research/calibration structural audit — **ZERO** provider / HTTP / Supabase
**Modeling / fitting / weights / odds-EV / feature-vs-outcome / 2025 unsealing:** **NONE**
**Production lifecycle / scanner / scheduler / PE activation:** **NOT WIRED**
**Parent contracts:** PE-4I.15 (law), PE-4I.16 (vectors), PE-4I.17 (DEV dataset)

## Preflight

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `624f56740368c59ad873fed050da478c9d10c232` |
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Path A digest | `3cb8788d77cc226d223a5b91e6bd26b09d9377a4ef71302ea18da79fe2bf4590` |
| Path B digest | `f3ca72c6c6ab29842d97d6ddac2d5f810eefa6814cfb8248e307e8365e231154` |
| Path A/B rows | 40698 / 40698 |
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| Production expectation | **UNAVAILABLE** |
| G1 selectedShrinkageK | **10** (pinned in safety tests via `goalsG1Protocol(10)`) |
| Holdout | Sealed (calendar-2025 rows must be 0 in DEV dataset) |

## Purpose

Structural audit of the PE-4I.17 offline DEV feature dataset: presence, constant/near-constant flags, exact/deterministic redundancy, Pearson collinearity bands, cross-window and venue-mode overlap, family matrix, sparse-history depth. **Not** predictive validation.

Module: `lib/debug/calibration/pe4-as-of-t-features/`
CLI: `npm run calibration:pe4i18-feature-structure-audit`
Artifacts (gitignored): `data/calibration/pe4-acquisition-v1/stage2i18-structure-audit/`

## Predeclared thresholds

**Variance class**

| Class | Rule |
|---|---|
| CONSTANT | unique finite values ≤ 1 |
| NEAR_CONSTANT | mostCommonShare ≥ 0.99 **or** unique ≤ 2 with range ≈ 0 |
| LOW_VARIANCE | stdev / max(\|mean\|, 1e-9) < 0.01 **or** unique ≤ 3 |
| VARIABLE | else |

**Correlation bands** (min pairwise n = 200; else `INSUFFICIENT_PAIRWISE_N`)

| Band | \|r\| |
|---|---|
| EXTREME | ≥ 0.995 |
| VERY_HIGH | [0.98, 0.995) |
| HIGH | [0.90, 0.98) |
| MODERATE_OR_BELOW | < 0.90 |

Structural status labels: `AVAILABLE` / `PARTIAL` / `SPARSE` / `REDUNDANT` / `HIGHLY_CORRELATED` / `UNAVAILABLE` / `REQUIRES_LATER_RESEARCH`.
**Never** BEST / WORST / predictor / edge language.

## Modules

| File | Role |
|---|---|
| `pe4i18-protocol.ts` | Pins, thresholds, schema/status enums |
| `schema-inventory.ts` | Flatten + classify; numeric allowlist; derived fields |
| `presence-audit.ts` | Presence/missing by field + competition/season/year/window/venue |
| `descriptive-stats.ts` | unique/min/max/mean/median/stdev/zeroShare/modeShare + variance class |
| `exact-redundancy.ts` | Exact equal, sign inverse, known derivations, optional affine |
| `correlation-audit.ts` | Pearson on pairwise allowlist (Spearman off by default) |
| `window-redundancy.ts` | Align target/team/venue across windows — overlap only |
| `venue-mode-audit.ts` | all / home / away depth + cross-venue correlation |
| `feature-family-audit.ts` | Family matrix; `opponent_strength=UNAVAILABLE` |
| `sparse-history-audit.ts` | NO_HISTORY / ONE / TWO / SUFFICIENT_3_PLUS |
| `structure-audit-run.ts` | Orchestrate, dual-run + shuffle, artifacts |

## Label firewall

`target-labels-separated.json` may be checked for **existence only**. Contents are **never** read for structural stats. Mutating labels must not change the audit digest.

## What this does NOT prove

- Does **not** prove any field predicts outcomes (no Brier / log-loss / AUC / ROI).
- Does **not** select a “best” window, venue mode, or feature set by outcomes.
- Does **not** fit coefficients, weights, or models.
- Does **not** unseal calendar-2025 holdout or perform predictive inspection of 2025.
- Does **not** compute odds / EV / market edges.
- Does **not** wire production PE activation (`PE4I18_PRODUCTION_WIRING = false`).
- High collinearity / redundancy is **structural overlap**, not a ranking of predictive quality.
- `opponent_strength_join` remains **UNAVAILABLE** until an offline as-of-M strength catalogue exists.

## Artifacts

Under `stage2i18-structure-audit/`:

- `protocol.json`, `schema-inventory.json`, `presence-audit.json`
- `descriptive-stats.json`, `exact-redundancy.json`, `correlation-audit.json`
- `window-redundancy.json`, `venue-mode-audit.json`, `feature-family-matrix.json`
- `sparse-history-audit.json`, `xg-heterogeneity.json`
- `target-label-firewall.json`, `holdout-2025-firewall.json`
- `reproducibility-audit.json`, `audit-manifest.json`

## Reproducibility

Dual-run on the same rows + deterministic shuffle of row order → identical structural digest (order-independent aggregates). Fail-closed on mismatch. Fail-closed if any calendar-2025 kickoff appears in the DEV feature rows.

## Production boundary

- `PE4I18_PRODUCTION_WIRING = false`
- No imports into production lifecycle / scanner / scheduler / PE activation
- Expectation remains UNAVAILABLE; G1 untouched; C0 off
- `PROVIDER_CALLS_MADE = 0`

## Validation

```bash
npx vitest run lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/pe4-acquisition lib/prematch-decision/pe4-form-schedule lib/debug/calibration/goals/g1 lib/prematch-lifecycle/pe3f.production-wiring.test.ts lib/prematch-lifecycle/pe3c.integration.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe4-as-of-t-features lib/debug/calibration/run-pe4i18-feature-structure-audit.ts
npm run calibration:pe4i18-feature-structure-audit
```

## Ready for next phase

**READY_FOR_NEXT_RESEARCH_PHASE** after structure audit artifacts land — still research-only.
**Recommended next:** offline as-of-M strength catalogue for opponent-strength joins, **or** DEV-only exploratory analysis that remains firewall-bound (still no fitting / no 2025 unsealing / no window optimization by outcomes).
