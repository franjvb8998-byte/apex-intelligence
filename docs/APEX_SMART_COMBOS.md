# APEX Smart Combos

**Route:** `/smart-combos`  
**Code:** `lib/smart-combos/`, `components/smart-combos/`  
**Date:** 2026-08-28

Flagship accumulator desk. It does **not** re-run the Probability Engine or change Decision Engine weights. Every leg is a published `ApexOpportunity` (already an `ApexDecision`). This module only prices the **fold**.

```text
Today's DE scan (getApexOpportunities)
        │
        ▼
   ComboLeg[]          ← fair odds / EV recover model p
        │
        ├─ Analyzer  → product odds, implied p, independent p,
        │              correlation penalty, health, decideVerdict, evaluateSizing
        ├─ Builder   → greedy search under risk / odds / league constraints
        ├─ Optimizer → drop weakest; swap safer / higher-EV from the same scan
        ├─ Correlation → structural ρ (same fixture / team / league / kickoff)
        ├─ Monte Carlo → Gaussian copula, seeded
        └─ Daily     → Conservative / Value / Aggressive / Jackpot
                │
                ▼
         React desk (no vendor JSON)
```

## Services

| Function | Role |
| --- | --- |
| `analyzeCombo` | Analyzer |
| `buildCombo` | Builder AI |
| `optimizeCombo` | Optimizer |
| `analyzeCorrelation` | Correlation |
| `simulateCombo` | Monte Carlo |
| `buildDailySmartCombos` | Daily desk |
| `loadSmartCombosDesk` | RSC loader (quota-aware, `react.cache`) |

## Pricing (reuse existing identities)

- Combined odds = product of published decimal prices  
- Implied combo p = `impliedProbability(combinedOdds)` (`lib/match-rating/pricing`)  
- APEX independent p = product of DE model probabilities  
- Adjusted p = independent × (1 − correlation penalty)  
- EV = `expectedValue(adjustedP, combinedOdds)`  
- Stake = `evaluateSizing` (quarter-Kelly, 5% cap, DE verdict)  
- Verdict = `decideVerdict` on combo-level score / confidence / risk / value blocks  

Model probability is recovered from `fairOdds` (1 / fair) or from EV + book odds. Missing prices → the leg cannot enter a priced combo.

## Correlation

| Kind | ρ | Effect |
| --- | --- | --- |
| Same fixture, different 1X2 | 1 | Conflict — hit probability 0, Avoid |
| Same fixture, duplicate | 1 | Invalid slip |
| Same club on two fixtures | 0.42 | Penalty |
| Same league | 0.16 | Penalty |
| Kickoffs within 3h | 0.08 | Penalty |

Independence **overstates** joint hits when pairs exist. Monte Carlo uses a Gaussian copula on that matrix.

## Health (0–100)

Weighted blend of mean / min DE scores, combo confidence, EV, and independent hit rate, minus correlation and a weak-leg penalty. This is a **combo** diagnostic, not a second 1X2 model. Daily cards also show mean DE score as “APEX score”.

## Honest empties

Daily profiles that cannot be filled from the scan are listed with a reason (typical on a one-fixture recorded catalogue). Markets other than 1X2 are not invented.

## UI

Premium assistant desk: working slip on the left, Daily / Analyzer / Builder / Optimizer / Correlation / Simulation on the right. Design tokens only (`--apex-*`). No new visual system.
