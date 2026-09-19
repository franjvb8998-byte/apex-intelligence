/**
 * Production Poisson / Dixon-Coles source audit for 5B.8.
 * Values are read from frozen PE source. No dependence currently exists.
 */

import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  PRODUCTION_LAMBDA_CLAMP_MAX,
  PRODUCTION_LAMBDA_CLAMP_MIN,
} from "@/lib/debug/calibration/dc-5b8-shape";

export const PRODUCTION_POISSON_AUDIT = {
  poissonPmf: {
    function: "poissonPmf",
    file: "lib/intelligence/modules/probability/math/poisson.ts",
    formula: "P(K=k|λ) = e^{-λ} * λ^k / k!",
    independence: true,
  },
  scorelineProbability: {
    function: "scorelineProbability",
    file: "lib/intelligence/modules/probability/math/poisson.ts",
    formula: "P(H=i, A=j) = Pois(i; λ_h) * Pois(j; λ_a)",
    dependenceAdjustment: false,
  },
  scoreGrid: {
    function: "marginalizePoissonScoreGrid",
    file: "lib/intelligence/modules/probability/hybrid/score-matrix.ts",
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    coveredMassNormalization: true,
    draw: "Σ_{i=j} P(i,j) / coveredMass, then normalizeOutcomeProbability",
  },
  expectedGoals: {
    function: "eloToExpectedGoals",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    clampFunction: "clampLambda (file-private)",
    clampMin: PRODUCTION_LAMBDA_CLAMP_MIN,
    clampMax: PRODUCTION_LAMBDA_CLAMP_MAX,
    formula: "Math.min(Math.max(lambda, 0.05), 6)",
  },
  blend: {
    function: "blendOneXTwo",
    file: "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
    formula: "P = w * P_poisson + (1-w) * P_elo, then normalizeOutcomeProbability",
    poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
  },
  dixonColes: {
    productionImplementation: false,
    todoComment:
      "TODO(dixon-coles): add low-score dependence correction τ for 0-0 / 1-0 / 0-1.",
    todoFile: "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
    docsNote: "docs/PROBABILITY_ENGINE.md table row TODO(dixon-coles)",
  },
  dependenceCurrentlyExists: false,
} as const;
