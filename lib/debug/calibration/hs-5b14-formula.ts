/**
 * Debug-only higher-score draw compose. Isolated. Does not mutate production PE.
 * λ3=0 must reproduce independent Poisson. No λ3 fitting.
 */

import { blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { poissonPmf, scorelineProbability } from "@/lib/intelligence/modules/probability/math/poisson";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";
import { predictProductionDrawChain } from "@/lib/debug/calibration/draw-5b13-formula";
import type { OneXTwo } from "@/lib/debug/calibration/types";
import {
  BIVARIATE_EPSILON,
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  DECLARED_LAMBDA3,
  EQUAL_SCORE_KEYS,
  equalScoreKey,
  type DeclaredLambda3,
  type EqualScoreKey,
} from "@/lib/debug/calibration/hs-5b14-shape";

export const BIVARIATE_POISSON_EQUATIONS = {
  construction: "X = U1 + U3, Y = U2 + U3 with U1~Pois(λ1), U2~Pois(λ2), U3~Pois(λ3)",
  covariance: "Cov(X,Y) = λ3",
  pmf: "P(X=x,Y=y) = Σ_{k=0}^{min(x,y)} Pois(x-k;λ1) Pois(y-k;λ2) Pois(k;λ3)",
  diagnosticMeans: [
    "λ1 = max(λ_home - λ3, ε)",
    "λ2 = max(λ_away - λ3, ε)",
    "ε = 1e-9",
    "λ3=0 ⇒ λ1=λ_home, λ2=λ_away ⇒ independent Poisson",
  ],
  notFitted: true,
  declaredLambda3: DECLARED_LAMBDA3,
} as const;

export type EqualScoreMasses = Record<EqualScoreKey, number>;

export type ScoreCellAggregate = {
  homeGoals: number;
  awayGoals: number;
  expectedCount: number;
  observedCount: number;
  meanProbability: number;
  oeRatio: number | null;
};

export type ScoreGridResult = {
  oneXTwo: OneXTwo;
  coveredMass: number;
  equal: EqualScoreMasses;
  cells: number[][];
  p22: number;
  p00: number;
  p11: number;
  p33: number;
  p44: number;
  p55plus: number;
  draw: number;
};

export function emptyEqualMasses(): EqualScoreMasses {
  return { "0-0": 0, "1-1": 0, "2-2": 0, "3-3": 0, "4-4": 0, "5-5+": 0 };
}

export function bivariateScorelineProbability(
  homeGoals: number,
  awayGoals: number,
  lambda1: number,
  lambda2: number,
  lambda3: number,
): number {
  const kMax = Math.min(homeGoals, awayGoals);
  let mass = 0;
  for (let k = 0; k <= kMax; k += 1) {
    mass +=
      poissonPmf(homeGoals - k, lambda1) *
      poissonPmf(awayGoals - k, lambda2) *
      poissonPmf(k, lambda3);
  }
  return mass;
}

export function diagnosticLambdas(lambdaHome: number, lambdaAway: number, lambda3: number): {
  lambda1: number;
  lambda2: number;
  lambda3: number;
} {
  return {
    lambda1: Math.max(lambdaHome - lambda3, BIVARIATE_EPSILON),
    lambda2: Math.max(lambdaAway - lambda3, BIVARIATE_EPSILON),
    lambda3,
  };
}

export function buildBivariateScoreGrid(input: {
  lambdaHome: number;
  lambdaAway: number;
  lambda3: DeclaredLambda3;
  maxGoals?: number;
}): ScoreGridResult {
  const maxGoals = input.maxGoals ?? DEFAULT_HYBRID_CONFIG.maxGoals;
  const { lambda1, lambda2, lambda3 } = diagnosticLambdas(
    input.lambdaHome,
    input.lambdaAway,
    input.lambda3,
  );
  let home = 0;
  let draw = 0;
  let away = 0;
  let coveredMass = 0;
  const equal = emptyEqualMasses();
  const raw: number[][] = [];
  for (let i = 0; i <= maxGoals; i += 1) {
    raw[i] = [];
    for (let j = 0; j <= maxGoals; j += 1) {
      const p =
        lambda3 === 0
          ? scorelineProbability(i, j, input.lambdaHome, input.lambdaAway)
          : bivariateScorelineProbability(i, j, lambda1, lambda2, lambda3);
      if (!Number.isFinite(p) || p < 0) {
        throw new Error(`Non-finite or negative score mass at ${i}-${j}`);
      }
      raw[i]![j] = p;
      coveredMass += p;
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
      const key = equalScoreKey(i, j);
      if (key) equal[key] += p;
    }
  }
  if (!(coveredMass > 0)) {
    throw new Error("Bivariate score grid produced zero mass");
  }
  const oneXTwo = normalizeOutcomeProbability({
    home: home / coveredMass,
    draw: draw / coveredMass,
    away: away / coveredMass,
  });
  const normEqual = emptyEqualMasses();
  for (const key of EQUAL_SCORE_KEYS) {
    normEqual[key] = equal[key] / coveredMass;
  }
  const cells = raw.map((row) => row.map((value) => value / coveredMass));
  return {
    oneXTwo,
    coveredMass,
    equal: normEqual,
    cells,
    p00: normEqual["0-0"],
    p11: normEqual["1-1"],
    p22: normEqual["2-2"],
    p33: normEqual["3-3"],
    p44: normEqual["4-4"],
    p55plus: normEqual["5-5+"],
    draw: oneXTwo.draw,
  };
}

export function buildIndependentScoreGrid(input: {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals?: number;
}): ScoreGridResult {
  return buildBivariateScoreGrid({ ...input, lambda3: 0 });
}

export function assertLambda3ZeroMirrorsIndependent(input: {
  lambdaHome: number;
  lambdaAway: number;
}): void {
  const independent = buildIndependentScoreGrid(input);
  const bivariate = buildBivariateScoreGrid({ ...input, lambda3: 0 });
  if (Math.abs(independent.draw - bivariate.draw) > 1e-12) {
    throw new Error("λ3=0 must reproduce independent Poisson draw");
  }
  if (Math.abs(independent.p22 - bivariate.p22) > 1e-12) {
    throw new Error("λ3=0 must reproduce independent P(2-2)");
  }
  const production = predictProductionDrawChain({ homeElo: 1500, awayElo: 1500 });
  const replay = buildIndependentScoreGrid({
    lambdaHome: production.lambdaHome,
    lambdaAway: production.lambdaAway,
  });
  if (Math.abs(replay.draw - production.poisson.draw) > 1e-12) {
    throw new Error("Independent grid must match production Poisson draw at equal Elos");
  }
}

export function predictBivariateHybrid(input: {
  elo: OneXTwo;
  lambdaHome: number;
  lambdaAway: number;
  lambda3: DeclaredLambda3;
}): { poisson: OneXTwo; hybrid: OneXTwo; grid: ScoreGridResult } {
  const grid = buildBivariateScoreGrid({
    lambdaHome: input.lambdaHome,
    lambdaAway: input.lambdaAway,
    lambda3: input.lambda3,
  });
  return {
    poisson: grid.oneXTwo,
    hybrid: blendOneXTwo(grid.oneXTwo, input.elo, DEFAULT_HYBRID_CONFIG.poissonBlendWeight),
    grid,
  };
}

export function pearsonCorrelation(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const n = xs.length;
  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < n; i += 1) {
    meanX += xs[i]!;
    meanY += ys[i]!;
  }
  meanX /= n;
  meanY /= n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (!(denX > 0) || !(denY > 0)) return 0;
  return num / Math.sqrt(denX * denY);
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BootstrapCorrelation = {
  estimate: number;
  lo: number;
  hi: number;
  seed: number;
  resamples: number;
};

export function bootstrapPearson(input: {
  xs: readonly number[];
  ys: readonly number[];
  seed?: number;
  resamples?: number;
}): BootstrapCorrelation {
  const seed = input.seed ?? BOOTSTRAP_SEED;
  const resamples = input.resamples ?? BOOTSTRAP_RESAMPLES;
  if (resamples !== BOOTSTRAP_RESAMPLES) {
    throw new Error(`Bootstrap resamples must be exactly ${BOOTSTRAP_RESAMPLES}`);
  }
  if (seed !== BOOTSTRAP_SEED) {
    throw new Error(`Bootstrap seed must be exactly ${BOOTSTRAP_SEED}`);
  }
  const estimate = pearsonCorrelation(input.xs, input.ys);
  const rng = mulberry32(seed);
  const n = input.xs.length;
  const samples: number[] = [];
  for (let r = 0; r < resamples; r += 1) {
    const bx: number[] = [];
    const by: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const index = Math.floor(rng() * n);
      bx.push(input.xs[index]!);
      by.push(input.ys[index]!);
    }
    samples.push(pearsonCorrelation(bx, by));
  }
  samples.sort((left, right) => left - right);
  const loIndex = Math.floor(0.025 * (resamples - 1));
  const hiIndex = Math.ceil(0.975 * (resamples - 1));
  return {
    estimate,
    lo: samples[loIndex]!,
    hi: samples[hiIndex]!,
    seed,
    resamples,
  };
}

export function cellKey(homeGoals: number, awayGoals: number): string {
  return `${homeGoals}-${awayGoals}`;
}
