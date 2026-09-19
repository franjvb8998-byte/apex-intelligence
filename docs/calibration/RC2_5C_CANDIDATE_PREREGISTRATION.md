# RC2 5C.1 Candidate Pre-Registration

Pre-registration only. Frozen **before** unseen outcome access.

This document assigns the 5B.17 candidate slots. It does **not** score PL 2023/2024/2025. It does **not** claim historical winners. It does **not** promote production.

---

## 1. Purpose

Convert UNASSIGNED prospective slots into five exact, immutable architectures. Minimize degrees of freedom. Freeze formulas and promotion rules before any unseen scoring.

## 2. Base commit

`967b541f3947a4f9cfe0d1fe5eea57f3de880f62`

Branch: `develop`. CONTROL is the production Probability Engine at this commit.

## 3. Historical firewall

USED investigation seasons — must not be called unseen and must not be used to choose or rank these candidates:

- PL 2023
- PL 2024
- PL 2025

5C.1 does not load their persisted outcome datasets and does not compute historical log loss / Brier / ECE for selection.

## 4. CONTROL exact definition

**ID:** `CONTROL_PRODUCTION`

Exact production model at the base commit:

| Item | Value |
|---|---|
| Catalogue Elo | `round(base − 80 + winRate×220 + clamp(GD, −30, 30)×2.5)`; played = 0 → role base only |
| Role bases | home 1580 / away 1520 |
| Sample-size | none (no shrinkage) |
| GD | cumulative, clamp 30, coefficient 2.5 |
| Elo→xG | `λh = 1.45 × 10^(ΔR/S) × γ`; `λa = 1.15 / 10^(ΔR/S)`; γ = 1.0 |
| S | 400 |
| Lambda clamp | [0.05, 6] |
| homeAdvantageElo | 65 (Elo 1X2 only; not added to λ) |
| eloDrawBase / decay | 0.28 / 220 |
| Poisson | independent, maxGoals = 15 |
| Blend | `P = 0.7 P_poisson + 0.3 P_elo`, then normalize |
| HIGH_EQUAL | none |

CONTROL must not change.

## 5. Candidate A exact definition

**ID:** `CANDIDATE_A_INPUT`

Input-only. Exact previously implemented **C7** mechanics (5B.11). Not re-optimized.

- Role bases 1550 / 1550
- Shrinkage k = 8: `round(base + (n/(n+8))×(raw − base))`
- GD-rate: `clamp((GF−GA)/max(n,1), −3, 3) × 25`
- Same −80 offset and win-rate ×220 as production catalogue
- Downstream production unchanged: S=400, μ, clamp, HA, drawBase, blend, independent Poisson

## 6. Candidate B exact definition

**ID:** `CANDIDATE_B_TRANSFORM`

Transform-only. Exact production catalogue input (C0).

- S = 600 (predeclared 5B.9/5B.12 diagnostic scale; **not** a historical winner)
- Everything else production

## 7. Candidate C exact definition

**ID:** `CANDIDATE_C_COMBINED`

Exact A input + exact B transform (S=600). No HIGH_EQUAL operator.

Purpose: test whether both independently established causal layers generalize prospectively.

## 8. Candidate D exact definition

**ID:** `CANDIDATE_D_COMBINED_HIGH_EQUAL`

Exact C plus exact 5B.16 **T1**:

- HIGH_EQUAL = k-k for k ≥ 2
- Increase HIGH_EQUAL total mass by +10% of its original HIGH_EQUAL mass
- Allocate the increment in original HIGH_EQUAL proportions
- Remove the same mass from non-draw cells only, preserving donor proportions
- Do not directly modify 0-0, 1-1, or HIGH_EQUAL donor cells
- Normalize only for floating-point tolerance

M1/M2/M3 are **not** registered. T1 is not claimed historically optimal.

## 9. Candidate manifest

Exactly five arms. No sixth. No grid. No adaptive creation after prospective results begin.

See `lib/debug/calibration/prospective/candidate-config.ts`.

## 10. Fingerprint

Deterministic SHA-256 of the canonical JSON manifest:

Stored on every prediction record as `candidateFingerprint`.

SHA-256: `7adf4ab6324074c8d9ada7f6f8eb43d02847ab317949c952b559162faaaf402c`

Runtime constant: `CANDIDATE_MANIFEST_FINGERPRINT`.

## 11. Record schema

Matches `RC2_PROSPECTIVE_VALIDATION_FREEZE.md`, plus `candidateVersion` and `candidateFingerprint`.

At capture: `resultStatus = PENDING`, `finalHomeGoals = null`, `finalAwayGoals = null`, `scoredAt = null`.

## 12. Leakage guards

- kickoff > capturedAt
- evidenceAsOf < kickoff
- outcome fields null at capture
- manifest fingerprint immutable within a run
- one record per fixture/candidate
- same-kickoff order: kickoff, then fixtureId
- prediction input type has no result fields
- scoring is a separate function

## 13. Odds policy

Odds are optional. Missing odds → `odds = null`, `marketImpliedProbabilities = null`. Predictions are kept. Probability evaluation does not require odds. No API-Football odds call in 5C.1.

## 14. Primary metrics

1. Log loss
2. Brier
3. ECE

No combined score.

## 15. Secondary metrics

Accuracy; predicted vs observed H/D/A; home/draw/away bias; mean confidence; ≥80/≥90/≥95 rates; HIGH_EQUAL O/E; LOW_EQUAL O/E.

Descriptive only.

## 16. Reporting checkpoints

N = 100, 250, 500 per candidate if available. Descriptive. Not adaptive stopping. Do not modify candidates at intermediate N.

## 17. Promotion rules

Never promote on accuracy alone.

At N ≥ 500, all of:

1. no material leakage/integrity violation
2. log loss not worse than CONTROL
3. Brier not worse than CONTROL
4. ECE not materially worse than CONTROL
5. no new pathological ≥90/≥95 behavior
6. class biases inspected individually
7. temporal stability inspected
8. no candidate modification during the window

If metrics conflict: **INCONCLUSIVE / REQUIRES REVIEW**. No automatic numeric promotion. No single winner score.

## 18. HIGH_EQUAL special rule

D vs C only: HIGH_EQUAL O/E must move in a useful direction **without** material LOW_EQUAL degradation, material proper-score degradation, or a new class-calibration pathology. No historical-fit thresholds.

## 19. No-adaptive-tuning rule

After this freeze, do not add arms, interpolate S, change k, or switch T1 for a multiplier because prospective checkpoints look good or bad.

## 20. Prospective protocol

1. Capture immutable pre-match records for all five arms.
2. Store fingerprint + version on each record.
3. Score only after finals, as a separate step, on seasons **not** in {2023, 2024, 2025} unless a later season was unused in 5B **and** this freeze predates its outcome access.
4. Report primary and secondary metrics at N=100/250/500 without changing candidates.

## 21. What is still prohibited

New ML models, injuries, lineups, new data providers, new xG sources, new HA systems, odds blending, Dixon-Coles production correction, bivariate Poisson, bookmaker weighting, new confidence formulas, historical retuning, live collection in 5C.1, production edits, commit/push in 5C.1.

Calibration does not establish betting profitability.

## 22. Sign-off

Pre-registered: 2026-09-19  
Base commit: `967b541f3947a4f9cfe0d1fe5eea57f3de880f62`  
Status: **FROZEN FOR REVIEW — no unseen outcomes scored**
