/**
 * Production draw-formula audit for 5B.7.
 * Values are read from frozen PE source, not inferred from data.
 */

import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

export const PRODUCTION_ELO_DRAW_BASE = DEFAULT_HYBRID_CONFIG.eloDrawBase;
export const PRODUCTION_ELO_DRAW_DECAY = DEFAULT_HYBRID_CONFIG.eloDrawDecay;
export const PRODUCTION_POISSON_BLEND_WEIGHT =
  DEFAULT_HYBRID_CONFIG.poissonBlendWeight;

/**
 * Exact production draw pipeline, cited from source.
 * Do not treat this object as a tunable config.
 */
export const PRODUCTION_DRAW_FORMULA_AUDIT = {
  eloDrawBase: {
    value: DEFAULT_HYBRID_CONFIG.eloDrawBase,
    definedIn: "lib/intelligence/modules/probability/hybrid/config.ts",
    symbol: "DEFAULT_HYBRID_CONFIG.eloDrawBase",
    consumedIn: [
      "EloPoissonHybridEngine.predict",
      "eloToOneXTwo (drawBase argument)",
    ],
  },
  eloDrawDecay: {
    value: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
    definedIn: "lib/intelligence/modules/probability/hybrid/config.ts",
    consumedIn: "eloToOneXTwo",
  },
  eloOneXTwo: {
    function: "eloToOneXTwo",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    drawMassChangesWithEloGap: true,
    formula:
      "P_draw_raw = eloDrawBase * exp(-|R_home + homeAdvantageElo - R_away| / eloDrawDecay); remaining mass split by eloWinExpectancy; then normalizeOutcomeProbability",
  },
  eloWinExpectancy: {
    function: "eloWinExpectancy",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    formula:
      "E_home = 1 / (1 + 10^((R_away - (R_home + homeAdvantageElo)) / eloScale))",
  },
  expectedGoals: {
    function: "eloToExpectedGoals",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    formula:
      "λ_home = μ_home * 10^((R_home - R_away) / eloGoalScale) * γ; λ_away = μ_away / 10^((R_home - R_away) / eloGoalScale); clamp [0.05, 6]",
    homeAdvantageEloEnters: false,
    goalBaselinesEnter: true,
    note: "PE homeAdvantageElo does not enter Elo→λ. Role priors enter only via the Elo ratings supplied to predict().",
  },
  poissonDraw: {
    function: "marginalizePoissonScoreGrid",
    file: "lib/intelligence/modules/probability/hybrid/score-matrix.ts",
    pmf: "poissonPmf / scorelineProbability in lib/intelligence/modules/probability/math/poisson.ts",
    formula:
      "P_draw = Σ_{i=j} Pois(i; λ_h) * Pois(j; λ_a) over i,j ∈ 0..maxGoals; divide by coveredMass; then normalizeOutcomeProbability",
  },
  blend: {
    function: "blendOneXTwo",
    file: "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
    formula:
      "P = w * P_poisson + (1 - w) * P_elo with w = poissonBlendWeight, then normalizeOutcomeProbability",
    poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
    postBlendNormalization: true,
  },
  homeAdvantageElo: {
    value: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    enters: [
      "eloWinExpectancy (adjustedHome = homeElo + homeAdvantageElo)",
      "eloToOneXTwo draw-decay delta (R_home + homeAdvantageElo - R_away)",
    ],
    doesNotEnter: ["eloToExpectedGoals"],
  },
  rolePriors: {
    productionHome: 1580,
    productionAway: 1520,
    enterVia: "offline catalogue Elo resolver (not inside PE.predict)",
  },
  goalBaselines: {
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    enterVia: "eloToExpectedGoals",
  },
  confidence: {
    function: "confidenceFromHybrid",
    file: "lib/intelligence/modules/probability/confidence-from-hybrid.ts",
    changesProbabilities: false,
    formula: "value = 1 - normalizedEntropy(final 1X2); band high≥0.75, medium≥0.45, else low",
  },
} as const;
