# RC2 5B Calibration Findings

Durable diagnostic consolidation. This document summarizes sprints 5B.1–5B.16.

It does **not** select production parameters.
It does **not** invent a production candidate.
Historical closeness of any probe to O/E = 1 is not a winner.

Frozen date: 2026-09-19

---

## 1. Executive summary

The production Probability Engine still uses independent Poisson score matrices, Elo→xG with S = 400, catalogue Elo with home/away role bases 1580/1520, HA = 65 (Elo-1X2 only), `eloDrawBase` = 0.28, and Poisson/Elo blend weight 0.7.

5B.1–5B.16 established a causal stack, not a tune:

1. Team-ID hash fallback was invalid and was removed.
2. Current catalogue input geometry can create excessive Elo gaps (role-base asymmetry, no sample-size shrinkage, cumulative GD).
3. The Elo→xG exponential transform with S = 400 independently amplifies those gaps. The λ clamp limits extremes; it does not cause them.
4. Production draw underprediction is not explained by one draw knob.
5. Independent Poisson underallocates HIGH_EQUAL mass (k-k for k ≥ 2), especially 2-2. That residual replicated across locked temporal windows.
6. A stable positive residual goal correlation was not found. Bivariate Poisson was not established as a solution.
7. A local HIGH_EQUAL redistribution is directionally targetable on cleaner D1 inputs. Historical data do **not** justify selecting a multiplier.

PL 2023, 2024, and 2025 are now used investigation seasons. They must not be called unseen again.

---

## 2. Original failure case

Pre-5B product surfaces could emit near-certain 1X2 forecasts (including ≥95% peaks) on fixtures whose catalogue evidence was thin or missing. One documented pathology used a team-ID checksum as if it were football strength. After that invalid fallback was removed, remaining extremes were still produced by real catalogue Elo gaps fed through S = 400.

5B.2 confirmed that a current-catalogue 1460 vs 1688 pairing remains an away-heavy hybrid. That is a catalogue/transform geometry issue, not a leftover hash artifact.

---

## 3. 5B.1 ID-hash removal

`estimateEloFromTeamId` now returns the caller-supplied role base unchanged. Team / provider IDs are not football strength.

This is the only production-model change already committed in the 5B series. Home/away bases (1580 / 1520) stay with the caller. Product surfaces (PE, Match Center, Copilot) share the same missing-stat resolver.

---

## 4. 5B.2 catalogue audit

After 5B.1, remaining high-confidence errors were traced to catalogue Elo construction, not ID hashing. Sparse or one-sided evidence still produced large Elo gaps. 5B.2 did not select a replacement catalogue formula.

---

## 5. 5B.3A offline harness

Created `lib/debug/calibration/` as an offline, leakage-aware evaluation harness. It is not imported by production runtime. It defines the calibration row schema, reconstruction (`kickoff < fixture`), Elo policy placeholders, metrics (log loss, Brier, ECE), and synthetic fixtures.

---

## 6. 5B.3B leakage-safe collector

Added the fail-closed microcollector: live collection requires explicit env + CLI authorization, a logical-call ceiling, and vendor envelope checks. `live-guard.ts` and `live-transport.ts` are **debug/calibration infrastructure**, not production API transport.

HEAD of this consolidation is the 5B.3B commit.

---

## 7. 5B.4 population reconstruction

Authorized pilot reconstructed a full PL 2024 natural population (N = 380) from persisted fixtures, with a stratified diagnostic sample. Evidence buckets, HA decomposition, and catalogue-gap forensics were diagnostic only. No production Elo policy was promoted.

---

## 8. 5B.5 HA investigation

Factorial HA probes on the frozen 2024 population showed that production HA = 65 is not the sole cause of home bias. Role-base asymmetry and catalogue geometry remained after HA neutralization. No HA value was selected.

---

## 9. 5B.6 out-of-sample replication

Locked 2024 as DEVELOPMENT and 2023 / 2025 as HOLDOUT. Holdout-only aggregates must exclude 2024. The home-bias / extreme-confidence pattern replicated out of sample on D0 (current production chain). No candidate was promoted.

---

## 10. 5B.7 draw forensics

Production underpredicts draws. Sensitivity on `eloDrawBase` moved class draw mass but did not isolate a single sufficient knob. Extreme draw misses concentrated where Poisson draw was already low and Elo gaps were large. No `drawBase` was selected.

---

## 11. 5B.8 Dixon-Coles findings

A predeclared ρ grid on the independent-Poisson matrix did not establish Dixon-Coles as the production correction. Residual 2-2+ structure remained. No ρ was selected.

---

## 12. 5B.9 Elo→xG geometry

Production `λ ∝ exp(±gap / S)` with S = 400 materially amplifies Elo gaps. Analytic clamp thresholds limit λ; they do not create the extreme ratio. Declared S / gap probes were sensitivity only. No production S was selected.

---

## 13. 5B.10 catalogue-input forensics

Decomposed catalogue Elo into role base, win-rate, and GD terms.

Established on the locked seasons:

- sparse / early-sample instability (no shrinkage)
- cumulative GD amplification as played increases
- role-base prior (1580 vs 1520) contributes a structural home offset
- mature-sample extremes still exist (not only n = 0/1 artifacts)

No catalogue coefficient was selected.

---

## 14. 5B.11 input counterfactuals

Frozen non-candidate input arms (equal role bases, shrinkage k probes, GD-rate form) showed that cleaner input geometry reduces D0-style extremes and home bias. **C7 / later D1 is a forensic cleaner panel, not a production candidate.** No shrinkage k, role-base pair, or GD formula was selected.

---

## 15. 5B.12 transform counterfactuals

Holding input panels fixed (P0 = current catalogue, P7 = cleaner non-candidate) and varying only Elo→xG geometry showed that S and gap-cap probes move λ ratios and class calibration independently of catalogue cleanup. Both input and transform contribute. Cleaner input does not remove all draw / HIGH_EQUAL residual. No S or cap was selected.

---

## 16. 5B.13 draw-channel decomposition

On frozen D0 (production) and D1 (cleaner input + production G0), declared probes of drawBase, blend, HA, and Dixon-Coles ρ did not absorb the remaining draw residual. 2025 extra draws were already visible as a season-level leftover after those knobs. No draw-channel parameter was selected.

---

## 17. 5B.14 higher-score dependence

D1 pooled holdout 1-1 O/E ≈ 1.00. HIGH_EQUAL (2-2+) O/E ≈ 1.47, primarily 2-2. Residual goal correlation was not positively stable. Declared λ3 bivariate-Poisson probes were not sufficient. 2025 extra draw rate is a separate LOW_EQUAL phenomenon. No λ3 was selected.

---

## 18. 5B.15 temporal robustness

Exact chronological splits (H1/H2 = 190, Q1–Q4 = 95) on D1:

- HIGH_EQUAL excess replicated in all 6 season-halves
- 9/12 season quartiles exceeded O/E 1.10; all pooled quartiles exceeded 1.10
- leave-one-season-out HIGH_EQUAL O/E remained 1.44–1.54

The residual is not a one-window accident. No correction was designed.

---

## 19. 5B.16 local HIGH_EQUAL diagnostic

Debug-only score-matrix probes on frozen D0/D1:

- M0 = independent Poisson control (reproduced prior D0/D1)
- M1/M2/M3 = HIGH_EQUAL cell multipliers 1.10 / 1.25 / 1.50, then full-matrix renormalize
- T1 = +10% relative HIGH_EQUAL mass taken only from non-draw cells; 0-0 and 1-1 untouched

On D1 holdout (N = 760, 2023+2025):

- HIGH_EQUAL moved toward 1 under every probe
- T1 left 1-1 O/E exactly 1.000 and LOW_EQUAL exactly 0.905
- 82.9% of added HIGH mass landed in 2-2
- no LOW_EQUAL expected-rate change exceeded 1.0pp
- pooled proper-score damage was not material
- M3 historically brought holdout HIGH O/E to ≈ 1.01 and then overshot 2025, every H1, and pooled Q1

The same operator on D0 left HIGH_EQUAL at 1.43 and left named traces pathologically collapsed.

**No multiplier was selected. Historical metrics are not a production value.**

---

## 20. Established findings

- Team-ID hash fallback was invalid and was removed in 5B.1.
- Current catalogue input geometry can create excessive Elo gaps.
- Role-base asymmetry contributes materially to home bias.
- Lack of sample-size shrinkage creates early-sample instability.
- Cumulative GD contributes to gap geometry.
- Elo→xG exponential transform with S = 400 materially amplifies gaps.
- Lambda clamp limits rather than causes the extreme geometry.
- Both catalogue input and Elo→xG transform independently contribute.
- Production draw underprediction is not explained by one draw knob.
- Independent Poisson underallocates HIGH_EQUAL, especially 2-2.
- The HIGH_EQUAL residual replicated temporally.
- Stable positive residual goal correlation was **not** found.
- Bivariate Poisson was **not** established as a solution.
- Local HIGH_EQUAL redistribution is directionally targetable on D1.
- Historical data do **not** justify selecting a HIGH_EQUAL multiplier.

---

## 21. Findings NOT established

- No production S selected.
- No production shrinkage k selected.
- No production role-base configuration selected.
- No production GD formula selected.
- No Dixon-Coles ρ selected.
- No drawBase selected.
- No blend selected.
- No HA selected.
- No λ3 selected.
- No HIGH_EQUAL multiplier selected.
- No production candidate has yet passed unseen prospective validation.

---

## 22. Known residuals

After the forensic stack, these remain open and must not be collapsed into one knob:

1. **D1 0-0 underprediction** (holdout O/E ≈ 0.75). T1 does not touch it; M-family only nicks it via renormalization.
2. **2025 LOW_EQUAL excess** (0-0 + 1-1). Separate from HIGH_EQUAL.
3. **D0 collapsed λ geometry** on current-catalogue + S = 400. Local HIGH_EQUAL cannot repair it.
4. **3-3+ is not a supported development hole** (2024 observed 1 vs expected ~3.6). A 2-2-targeted operator still spends ~17% of added HIGH mass there.
5. **2023 class draw bias** can worsen if HIGH_EQUAL expected mass is raised on an already slightly over-drawn season.

---

## 23. Anti-overfitting decisions

- 2024 is DEVELOPMENT only. It never enters holdout aggregates.
- Declared grids only. No interpolation, no winner helper, no combined score.
- D1 / C7 / P7 / T1 are forensic panels and probes, not candidates.
- Temporal splits were locked in 5B.15 and reused, not redefined to fit.
- PRODUCTION_CORRECTION_READY remained NO at 5B.16 because no unseen window exists.

---

## 24. Production changes already committed

Only 5B.1: missing-stat Elo prior returns the role base; ID hash removed.

Confirmed production constants at freeze (unchanged by 5B.4–5B.16):

- `eloGoalScale` = 400
- `homeAdvantageElo` = 65
- `eloDrawBase` = 0.28
- `poissonBlendWeight` = 0.7
- `maxGoals` = 15
- catalogue home/away bases 1580 / 1520

---

## 25. Production changes explicitly NOT made

5B.4–5B.16 did not edit production Elo, catalogue resolver, Elo→xG, Poisson, hybrid blend, draw, HA, Decision Engine, EV, or Opportunity Scanner.

Debug `live-guard.ts` / `live-transport.ts` are calibration collection infrastructure only.

---

## 26. Prospective validation requirement

Any later candidate architecture must be pre-registered on unused data before outcomes are scored. See `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md`.

PL 2023, 2024, and 2025 are used. They are not unseen.
