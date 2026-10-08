# PE-4I.15 — As-of-T Historical Feature Construction Planning

**Base HEAD (preflight):** `624f56740368c59ad873fed050da478c9d10c232` (main)
**Phase:** Offline research/calibration planning only — **ZERO** provider / HTTP / Supabase
**Modeling / fitting / weights / odds-EV / 2025 unsealing:** **NONE**
**Production lifecycle / scanner / scheduler / PE activation:** **NOT WIRED**

## Preflight

| Check | Result |
|---|---|
| Branch | `main` |
| HEAD | `624f56740368c59ad873fed050da478c9d10c232` |
| Working tree | CLEAN at start |
| Queue digest | `876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f` (PE-4I.5 / PE-4I.14) |
| `PE3C_C0_RECON_ACTIVATION` | **false** |
| Production expectation | **UNAVAILABLE** |
| G1 selectedShrinkageK | **10** |
| Holdout | Sealed (`isResearchHoldoutOutcomeEvidence` always `false`) |

## Purpose

Declare fail-closed contracts for building **as-of-T historical features** from the PE-4I acquisition corpus **without fitting**. This phase produces types, validators, window policy, provenance digests, and docs/tests only.

Module: `lib/debug/calibration/pe4-as-of-t-features/`
Reuses: `pe4-acquisition/temporal.ts`, `as-of-t.ts`, `holdout.ts`.

## Contracts (summary)

### Temporal / target-time

- Every history **M** must satisfy `kickoffUtc(M) < kickoffUtc(T)`.
- Forbid: self, same-kickoff, future / post-T, missing/malformed kickoff.
- Fail-closed: duplicate IDs, conflicting identity, malformed teams, incomplete stats, AET/PEN ambiguity (when family requires).
- Explicit guard excludes **calendar-2025** outcomes from DEV / feature-selection / calibration / comparison pools.

### Historical match ledger

Presence-aware row: fixtureId, competition, providerSeason, kickoffUtc, status, home/away IDs, goals+source, xG/shots/SoT/poss/corners/cards with `present|missing|ambiguous`, provenance refs, `regulationAmbiguity`, `holdoutClassification`.
**Missing ≠ 0.** No invented values.

### Feature families (declarative, no weights)

| Family | Scope | Min obs | AET/PEN |
|---|---|---|---|
| recent_results | universal | 3 | exclude ambiguous |
| recent_performance | conditional on presence | 3 | exclude ambiguous |
| home_away_splits | universal | 3 | exclude ambiguous |
| opponent_strength_join | conditional on join | 3 | allow + flag |
| schedule_rest | conditional on corpus | 1 | allow + flag |
| competition_context | universal | 1 | allow + flag |

### Window contract (predeclared, not optimized)

- **N** = {3, 5, 8, 10} — all proceed (continuity with GOALS-RAD + upper bound).
- **Days** = {30, 60, 90} — all proceed (month / two-month / quarter).
- Ordering: kickoff asc, fixtureId asc; last-N takes most recent after desc sort with fixtureId tie-break.
- Cross-comp allowed when tagged in counts; home/away windows are separate filters.
- Below `minObservations` → PARTIAL / UNAVAILABLE — no imputation.

### xG heterogeneity

- Optional evidence; **no zero-fill / imputation / EloPoisson substitution**.
- **Path A:** universal non-xG population.
- **Path B:** additive xG without shrinking Path A population.
- Coverage counts required.

### AET/PEN

- `FT` → regulation usable.
- `AET`/`PEN` → ambiguous (provider stats not proven regulation-only).
- Results/performance families exclude ambiguous; schedule/rest & competition context may keep with flag.

### Schedule / rest

- Past kickoffs only; future anticipation remains `UNAVAILABLE_NO_AS_OF_T_SCHEDULE_SNAPSHOT`.
- Rolling 7/14/28d counts declared; no fatigue multiplier / G1 mutation.

### Opponent strength

- Cutoff = `kickoff(M)`, never `kickoff(T)`.
- Common-baseline semantics (PE-4C/G.1 style); not venue-specific C0 Elo.
- Missing join → fail-closed UNAVAILABLE. No fitted expectation map.

### Holdout 2025 firewall

Reusable guards for DEV_FITTING / FEATURE_SELECTION / CALIBRATION / COMPARISON.
Ledger storage may retain raw calendar-2025 acquisition rows; outcomes stay sealed.

### Provenance

Feature-vector provenance: target id/kickoff, cutoff, sorted history IDs, window, counts, competitions, availability, holdout class, version, sha256 digest (order-independent history IDs).

## Unsupported (explicit)

Manager-change series, travel distance, as-of-T lineups/injuries, market odds form, fitted form coefficients, EloPoisson-as-xG substitution.

## Production boundary

- No imports into production lifecycle / scanner / scheduler / PE activation.
- `PE4I15_PRODUCTION_WIRING = false`.
- Expectation remains UNAVAILABLE; G1 untouched; C0 off.

## Validation

```bash
npx vitest run lib/debug/calibration/pe4-as-of-t-features
npx tsc --noEmit
```

## Ready for next phase

**READY_FOR_FEATURE_IMPLEMENTATION** after this plan — implement builders that materialize ledger rows + family vectors under these contracts (still no fitting).

**Recommended next:** PE-4I.16 offline ledger materialization + as-of-T feature vector builders (presence-aware, digests attached), still research-only.
