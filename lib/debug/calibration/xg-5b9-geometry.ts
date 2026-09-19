/**
 * Deterministic lambda-ratio / Elo-gap geometry helpers.
 * Analytic table uses frozen production config. Not fitted.
 */

import { blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { eloToOneXTwo } from "@/lib/intelligence/modules/probability/math/elo";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import { isValidOneXTwo } from "@/lib/debug/calibration/metrics";
import type { OneXTwo } from "@/lib/debug/calibration/types";
import {
  eloToExpectedGoalsMirrored,
  productionEloXgInputs,
  type EloXgInputs,
} from "@/lib/debug/calibration/xg-5b9-formula";
import {
  DECLARED_ELO_DIFF_GRID,
  DECLARED_EXPONENT_GAPS,
  LAMBDA_RATIO_BUCKETS,
  type LambdaRatioBucket,
} from "@/lib/debug/calibration/xg-5b9-shape";

export function lambdaRatio(lambdaHome: number, lambdaAway: number): number {
  const min = Math.min(lambdaHome, lambdaAway);
  const max = Math.max(lambdaHome, lambdaAway);
  if (!(min > 0) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error(`Invalid lambdas for ratio: ${lambdaHome}, ${lambdaAway}`);
  }
  return max / min;
}

export function totalXg(lambdaHome: number, lambdaAway: number): number {
  const total = lambdaHome + lambdaAway;
  if (!Number.isFinite(total)) {
    throw new Error(`Invalid total xG from ${lambdaHome}, ${lambdaAway}`);
  }
  return total;
}

export function lambdaRatioBucket(ratio: number): LambdaRatioBucket {
  if (!Number.isFinite(ratio) || ratio < 1) {
    throw new Error(`Invalid lambda ratio ${ratio}`);
  }
  if (ratio < 1.5) return "1.00-1.49";
  if (ratio < 2) return "1.50-1.99";
  if (ratio < 3) return "2.00-2.99";
  if (ratio < 5) return "3.00-4.99";
  if (ratio < 8) return "5.00-7.99";
  if (ratio < 12) return "8.00-11.99";
  return "12.00+";
}

export function exponentMultiplier(gap: number, eloGoalScale: number): {
  gap: number;
  multiplier: number;
  reciprocal: number;
} {
  const multiplier = 10 ** (gap / eloGoalScale);
  return { gap, multiplier, reciprocal: 1 / multiplier };
}

export function productionExponentMultipliers(): ReturnType<typeof exponentMultiplier>[] {
  return DECLARED_EXPONENT_GAPS.map((gap) =>
    exponentMultiplier(gap, DEFAULT_HYBRID_CONFIG.eloGoalScale),
  );
}

const ANALYTIC_AWAY_ELO = 1500;

export type AnalyticGeometryRow = {
  rawEloDiff: number;
  homeElo: number;
  awayElo: number;
  unclampedLambdaHome: number;
  unclampedLambdaAway: number;
  clampedLambdaHome: number;
  clampedLambdaAway: number;
  lambdaRatioClamped: number;
  totalXgClamped: number;
  clampHit: boolean;
  clampHomeMax: boolean;
  clampAwayMax: boolean;
  clampHomeMin: boolean;
  clampAwayMin: boolean;
  poisson: OneXTwo;
  elo: OneXTwo;
  hybrid: OneXTwo;
};

export function analyticEloGapGeometry(
  inputs: Omit<EloXgInputs, "homeElo" | "awayElo"> = productionEloXgInputs(),
): AnalyticGeometryRow[] {
  return DECLARED_ELO_DIFF_GRID.map((rawEloDiff) => {
    const homeElo = ANALYTIC_AWAY_ELO + rawEloDiff;
    const awayElo = ANALYTIC_AWAY_ELO;
    const mapped = eloToExpectedGoalsMirrored({ ...inputs, homeElo, awayElo });
    const poisson = marginalizePoissonScoreGrid({
      lambdaHome: mapped.lambdaHomeClamped,
      lambdaAway: mapped.lambdaAwayClamped,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    }).oneXTwo;
    const elo = eloToOneXTwo({
      homeElo,
      awayElo,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      drawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      drawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
      scale: DEFAULT_HYBRID_CONFIG.eloScale,
    });
    const hybrid = blendOneXTwo(
      poisson,
      elo,
      DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
    );
    if (!isValidOneXTwo(poisson) || !isValidOneXTwo(elo) || !isValidOneXTwo(hybrid)) {
      throw new Error(`Analytic geometry produced invalid 1X2 at diff ${rawEloDiff}`);
    }
    return {
      rawEloDiff,
      homeElo,
      awayElo,
      unclampedLambdaHome: mapped.lambdaHomeUnclamped,
      unclampedLambdaAway: mapped.lambdaAwayUnclamped,
      clampedLambdaHome: mapped.lambdaHomeClamped,
      clampedLambdaAway: mapped.lambdaAwayClamped,
      lambdaRatioClamped: lambdaRatio(mapped.lambdaHomeClamped, mapped.lambdaAwayClamped),
      totalXgClamped: mapped.totalXgClamped,
      clampHit:
        mapped.clampHomeMax ||
        mapped.clampAwayMax ||
        mapped.clampHomeMin ||
        mapped.clampAwayMin,
      clampHomeMax: mapped.clampHomeMax,
      clampAwayMax: mapped.clampAwayMax,
      clampHomeMin: mapped.clampHomeMin,
      clampAwayMin: mapped.clampAwayMin,
      poisson,
      elo,
      hybrid,
    };
  });
}

export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const weight = idx - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

export function distributionSummary(values: readonly number[]): {
  n: number;
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
} {
  const n = values.length;
  const mean = n === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / n;
  return {
    n,
    mean,
    median: quantile(values, 0.5),
    p10: quantile(values, 0.1),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    p95: quantile(values, 0.95),
    p99: quantile(values, 0.99),
    min: n === 0 ? 0 : Math.min(...values),
    max: n === 0 ? 0 : Math.max(...values),
  };
}

export { LAMBDA_RATIO_BUCKETS };
