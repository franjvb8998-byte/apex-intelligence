# PE-4I.21 — Offline Feature Eligibility Contract

PE-4I.21 freezes a label-free eligibility contract over the PE-4I.20 DEV numeric allowlist. It does not fit a model, rank windows, read outcome labels, or rewrite PE-4I.15–PE-4I.20 artifacts.

**Base HEAD:** `e124b37ae0deab62ce740d26c42063dab10cd9f8` (`main`)
**Parent audit digest:** `376ab14acd498eb6601c960fa8ca7edcf1e2086f67e184887e260cc3a39fd2b9`
**Status:** research-complete. Independent final audit: **PASS WITH LIMITATIONS**.
**Contract digest:** `f204eca3f3851af8d0c276fb09c81e7d99c39bc7873d1cd8963cad9a74dcd76c`
**PE-4:** closed as an offline research foundation. Production expectation stays unavailable. C0 stays off. G1 stays at k=10. PE-5 is not started.

## Frozen boundaries

- No provider, HTTP, database, Supabase, or Cloudflare calls.
- No fitting, calibration, weights, odds, EV, or outcome-driven selection.
- Calendar-2025 and provider-season-2025 targets stay excluded.
- `PE4I21_PRODUCTION_WIRING = false`. C0 activation and G1 k=10 stay untouched.
- The completed writer run created only `data/calibration/pe4-acquisition-v1/stage2i21-feature-contract-v1/` and refuses a non-empty directory or an existing planned file.
- Dataset JSONL and `target-labels-separated.json` are refused as inputs.

## Classification

Every one of the 117 PE-4I.20 numeric candidates receives exactly one class. Field order does not change the contract digest.

| Class | Count | Rule |
|---|---:|---|
| `INELIGIBLE_CONSTANT` | 18 | Constant zero: every `*.ambiguousCount`, `pathB.coverage.xgAmbiguousSides`, and `opponentStrength.selectedHistoryRegulationAmbiguityCount` |
| `ALIAS` | 19 | Non-canonical member of an exact, complement, unit, or code-assignment identity |
| `DERIVED_REPRESENTATION` | 20 | `derived.*` rates and every `.sum` |
| `COVERAGE_METADATA` | 30 | Missingness, xG presence, strength missingness, ambiguity rejections, catalogue prior ambiguity, corpus prior-match count |
| `PRIMARY_NUMERIC` | 30 | Retained means, result counts, canonical observation counts, strength mean and matched count, rest days and 7/14/28 match counts |

`pathB.anyXgPresent` stays coverage metadata. Its low-variance label is a binary-flag threshold, not a constant.

## Alias policy

Retained canonicals:

- `observationCount`
- `opponentStrength.matchedCount`
- `pathA.shotsFor.obsCount` for the shared shots / shots-on-target / corners / possession observation count
- `pathA.results.resultObsCount` for goals observation counts
- `pathA.yellowCardsFor.obsCount` and `pathA.redCardsFor.obsCount`
- `pathB.expectedGoalsFor.obsCount`
- `pathA.possessionFor.mean` (`possessionAgainst.mean = 100 - possessionFor.mean`)
- `scheduleRest.daysSincePreviousMatch` (`hours = 24 * days`)
- The three code-assigned missing-count canonicals under `pathA`

Slope-zero affine pairs against a constant-zero field are not alias groups.

Derived fields stay in the dataset contract as representations. They are not co-eligible with their parents. Sums block the canonical mean and the canonical observation count of that aggregate.

## Population strata

The DEV grid stays 969 targets and 40,698 rows per path, with 7 windows and 3 venue modes (`42` rows per target). Placement uses the frozen PE-4I.4 competition policy:

| Placement | Targets | Rows |
|---|---:|---:|
| Primary (`39`, `48`, `2`, `45`, `3`, `848`) | 786 | 33,012 |
| Separate audit, known (`667`, `1022`) | 179 | 7,518 |
| Separate audit, registry-unknown (`15`, `866`, `937`) | 4 | 168 |
| Separate audit combined | 183 | 7,686 |

Rows are not deleted. A later primary matrix uses the 786-target stratum. Synthetic calendar-2025 kickoffs and provider-season-2025 targets classify as `EXCLUDED_HOLDOUT` before competition placement. Unknown kickoffs, blank seasons, duplicate competition ids, and row counts that are not multiples of 42 fail closed.

## Design-matrix rules

- At most one `windowId` in a later matrix. All seven windows remain in the dataset.
- `all`, `home`, and `away` stay. They are not collapsed.
- Schedule/rest is target-team scoped and repeated across windows. Enter it once.
- Nested 7/14/28 rest counts stay eligible, with nesting recorded.
- Strength null stays null. Path B is not zero-filled and does not shrink Path A.

## Pinned inputs

| Pin | Digest |
|---|---|
| Queue | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` |
| Ledger | `713bc19be6411229a3c5aea1f846a55ccb1fb5121fd419c00e9c9a42fd21b962` |
| Catalogue | `c1bb17e049ee6a14cbbed110bb136370a363cfb5286de1d6df6561a339fce8ed` |
| PE-4I.17 Path A / base | `3cb8788d77cc226d223a5b91e6bd26b09d9377a4ef71302ea18da79fe2bf4590` |
| Path B, unchanged | `f3ca72c6c6ab29842d97d6ddac2d5f810eefa6814cfb8248e307e8365e231154` |
| PE-4I.20 strength Path A | `116fb078020056a4c5ee888c466b2262d0148dc7edf2da28f1e8c10b57781dfe` |
| PE-4I.20 audit | `376ab14acd498eb6601c960fa8ca7edcf1e2086f67e184887e260cc3a39fd2b9` |

## Modules

| File | Role |
|---|---|
| `pe4i21-protocol.ts` | Version, pins, forbidden directories, planned artifact names |
| `pe4i21-eligibility.ts` | Classifier, strata, variance reconciliation, write-refusal decision |
| `pe4i21.eligibility.test.ts` | In-memory contract tests and read-only audit reconciliation |
| `run-pe4i21-feature-contract.ts` | Separately authorized writer |

## Validation

Focused tests do not invoke the writer:

```bash
npx vitest run lib/debug/calibration/pe4-as-of-t-features/pe4i21.eligibility.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe4-as-of-t-features/pe4i21-protocol.ts lib/debug/calibration/pe4-as-of-t-features/pe4i21-eligibility.ts lib/debug/calibration/pe4-as-of-t-features/pe4i21.eligibility.test.ts lib/debug/calibration/run-pe4i21-feature-contract.ts
```

Artifact generation has completed. Seven gitignored artifacts were written under `stage2i21-feature-contract-v1` and independently audited. The logical contract digest is `f204eca3f3851af8d0c276fb09c81e7d99c39bc7873d1cd8963cad9a74dcd76c`.

- `protocol.json`
- `eligibility-manifest.json`
- `alias-groups.json`
- `stratum-manifest.json`
- `design-matrix-rules.json`
- `reproducibility-audit.json`
- `contract-manifest.json`

The reproducibility file records the same digest for both passes. `labelsRead` is false, `providerCallsMade` is 0, and `productionWiring` is false. PE-4I.15–PE-4I.20 artifacts were not rewritten. The completed command was `npm run calibration:pe4i21-feature-contract`.

## Closure

PE-4 closes here as an offline form-and-schedule research foundation, with audit verdict **PASS WITH LIMITATIONS**. The close freezes this eligibility contract. It does not activate production, change the scheduler, or start PE-5.

## Deferred limitations

- `pathA.goalsFor.missingCount` and `pathA.goalsAgainst.missingCount` match the distribution of `goalsMissingOrAmbiguous` in the audit, but that pairwise identity was not proven. They stay coverage metadata and are not an alias group.
- `scheduleRest.ambiguityFlaggedPriorCount` matches the distribution of `ambiguityExclusions.regulationAmbiguousRejectedFromHistory`. Same treatment: both stay coverage metadata.
- Provider-season 2025 still has no corpus example. The synthetic holdout classification covers that branch.
- Cross-window correlation and nested rest counts are recorded. Windows are not dropped. A later matrix uses at most one window id, and schedule/rest is entered once.
- Opponent strength is null on 11,844 of 40,698 rows. Null stays null. The common-baseline value 1580 is not venue-specific C0 Elo.
- Optional xG is absent on 25.22% of rows. Path B is not zero-filled and does not shrink Path A.
- 183 targets stay outside the primary stratum: friendlies `667`, Summer Series `1022`, and registry-unknown `15`, `866`, and `937`.
- Calendar-2025 ledger rows stay sealed. DEV rows contain none of those outcomes.
- These limitations travel forward. PE-5 is not started. Production lifecycle, scheduler, C0, and G1 behavior stay unchanged.
