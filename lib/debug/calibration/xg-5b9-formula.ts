/**
 * Production Elo→xG source audit + debug-only unclamped mirror.
 * Does not mutate PE. Unclamped values are never silently re-clamped.
 */

import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { eloToExpectedGoals } from "@/lib/intelligence/modules/probability/math/elo";
import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
} from "@/lib/debug/calibration/types";
import {
  PRODUCTION_LAMBDA_CLAMP_MAX,
  PRODUCTION_LAMBDA_CLAMP_MIN,
} from "@/lib/debug/calibration/dc-5b8-shape";
import { VALIDATION_NEUTRAL_GOAL_BASELINE } from "@/lib/debug/calibration/validation-5b6-configs";

export const PRODUCTION_ELO_XG_AUDIT = {
  eloToExpectedGoals: {
    function: "eloToExpectedGoals",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    formula:
      "diff = R_home - R_away; ratio = 10^(diff / S); λh = μh * ratio * γ; λa = μa / ratio; then clampLambda",
    usesHomeAdvantageElo: false,
    usesRolePriorsDirectly: false,
  },
  baseHomeGoals: {
    field: "DEFAULT_HYBRID_CONFIG.baseHomeGoals",
    file: "lib/intelligence/modules/probability/hybrid/config.ts",
    value: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
  },
  baseAwayGoals: {
    field: "DEFAULT_HYBRID_CONFIG.baseAwayGoals",
    file: "lib/intelligence/modules/probability/hybrid/config.ts",
    value: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  },
  eloGoalScale: {
    field: "DEFAULT_HYBRID_CONFIG.eloGoalScale",
    file: "lib/intelligence/modules/probability/hybrid/config.ts",
    value: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    role: "S in 10^(ΔR / S)",
  },
  homeGoalsAdvantage: {
    field: "DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage",
    file: "lib/intelligence/modules/probability/hybrid/config.ts",
    value: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    symbol: "γ",
    note: "Production γ = 1.0, so it currently adds no extra λ_home multiplier.",
  },
  clampLambda: {
    function: "clampLambda (file-private)",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    formula: "Math.min(Math.max(lambda, 0.05), 6)",
    min: PRODUCTION_LAMBDA_CLAMP_MIN,
    max: PRODUCTION_LAMBDA_CLAMP_MAX,
  },
  rolePriors: {
    home: CALIBRATION_HOME_BASE,
    away: CALIBRATION_AWAY_BASE,
    file: "lib/debug/calibration/types.ts",
    affectsLambda:
      "YES, indirectly: catalogue Elo includes 1580/1520 role bases, which enter R_home - R_away. eloToExpectedGoals itself does not add role priors.",
  },
  homeAdvantageElo: {
    field: "DEFAULT_HYBRID_CONFIG.homeAdvantageElo",
    value: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    affectsLambda: false,
    usedBy: ["eloWinExpectancy", "eloToOneXTwo"],
    notUsedBy: ["eloToExpectedGoals"],
  },
  engineCall: {
    file: "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
    note: "predict() passes homeElo/awayElo into eloToExpectedGoals without adding homeAdvantageElo.",
  },
} as const;

export type EloXgInputs = {
  homeElo: number;
  awayElo: number;
  baseHomeGoals: number;
  baseAwayGoals: number;
  eloGoalScale: number;
  homeGoalsAdvantage: number;
};

export type UnclampedLambdaPair = {
  rawEloDiff: number;
  multiplier: number;
  lambdaHomeUnclamped: number;
  lambdaAwayUnclamped: number;
  totalXgUnclamped: number;
};

export type ClampedLambdaPair = UnclampedLambdaPair & {
  lambdaHomeClamped: number;
  lambdaAwayClamped: number;
  totalXgClamped: number;
  clampHomeMax: boolean;
  clampAwayMax: boolean;
  clampHomeMin: boolean;
  clampAwayMin: boolean;
};

export function productionEloXgInputs(): EloXgInputs {
  return {
    homeElo: 0,
    awayElo: 0,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
  };
}

export function g1NeutralGoalInputs(): Pick<
  EloXgInputs,
  "baseHomeGoals" | "baseAwayGoals"
> {
  return {
    baseHomeGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
    baseAwayGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
  };
}

/** Debug clamp mirror. Same arithmetic as production clampLambda. */
export function debugClampLambda(lambda: number): number {
  return Math.min(Math.max(lambda, PRODUCTION_LAMBDA_CLAMP_MIN), PRODUCTION_LAMBDA_CLAMP_MAX);
}

/**
 * Unclamped production mapping:
 *   Δ = R_home - R_away
 *   r = 10^(Δ / S)
 *   λh = μh * r * γ
 *   λa = μa / r
 * Never clamps.
 */
export function eloToExpectedGoalsUnclamped(input: EloXgInputs): UnclampedLambdaPair {
  const rawEloDiff = input.homeElo - input.awayElo;
  const multiplier = 10 ** (rawEloDiff / input.eloGoalScale);
  const lambdaHomeUnclamped =
    input.baseHomeGoals * multiplier * input.homeGoalsAdvantage;
  const lambdaAwayUnclamped = input.baseAwayGoals / multiplier;
  return {
    rawEloDiff,
    multiplier,
    lambdaHomeUnclamped,
    lambdaAwayUnclamped,
    totalXgUnclamped: lambdaHomeUnclamped + lambdaAwayUnclamped,
  };
}

export function eloToExpectedGoalsMirrored(input: EloXgInputs): ClampedLambdaPair {
  const unclamped = eloToExpectedGoalsUnclamped(input);
  const lambdaHomeClamped = debugClampLambda(unclamped.lambdaHomeUnclamped);
  const lambdaAwayClamped = debugClampLambda(unclamped.lambdaAwayUnclamped);
  return {
    ...unclamped,
    lambdaHomeClamped,
    lambdaAwayClamped,
    totalXgClamped: lambdaHomeClamped + lambdaAwayClamped,
    clampHomeMax: lambdaHomeClamped === PRODUCTION_LAMBDA_CLAMP_MAX,
    clampAwayMax: lambdaAwayClamped === PRODUCTION_LAMBDA_CLAMP_MAX,
    clampHomeMin: lambdaHomeClamped === PRODUCTION_LAMBDA_CLAMP_MIN,
    clampAwayMin: lambdaAwayClamped === PRODUCTION_LAMBDA_CLAMP_MIN,
  };
}

export function assertMirrorsProductionEloToExpectedGoals(input: {
  homeElo: number;
  awayElo: number;
}): void {
  const mirrored = eloToExpectedGoalsMirrored({
    ...productionEloXgInputs(),
    homeElo: input.homeElo,
    awayElo: input.awayElo,
  });
  const production = eloToExpectedGoals({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
  });
  if (mirrored.lambdaHomeClamped !== production.lambdaHome) {
    throw new Error("Debug λ_home clamp does not match production eloToExpectedGoals");
  }
  if (mirrored.lambdaAwayClamped !== production.lambdaAway) {
    throw new Error("Debug λ_away clamp does not match production eloToExpectedGoals");
  }
}

/**
 * Raw Elo difference at which unclamped λ first equals a clamp bound.
 *   λh = μh * 10^(Δ/S) * γ = bound  ⇒  Δ = S * log10(bound / (μh γ))
 *   λa = μa / 10^(Δ/S) = bound      ⇒  Δ = S * log10(μa / bound)
 */
export function analyticClampThresholds(input: {
  baseHomeGoals: number;
  baseAwayGoals: number;
  eloGoalScale: number;
  homeGoalsAdvantage: number;
}): {
  homeMax: number;
  awayMax: number;
  homeMin: number;
  awayMin: number;
} {
  const muH = input.baseHomeGoals * input.homeGoalsAdvantage;
  const scale = input.eloGoalScale;
  return {
    homeMax: scale * Math.log10(PRODUCTION_LAMBDA_CLAMP_MAX / muH),
    awayMax: scale * Math.log10(input.baseAwayGoals / PRODUCTION_LAMBDA_CLAMP_MAX),
    homeMin: scale * Math.log10(PRODUCTION_LAMBDA_CLAMP_MIN / muH),
    awayMin: scale * Math.log10(input.baseAwayGoals / PRODUCTION_LAMBDA_CLAMP_MIN),
  };
}

export function productionAnalyticClampThresholds(): ReturnType<typeof analyticClampThresholds> {
  return analyticClampThresholds({
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
  });
}
