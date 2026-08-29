/**
 * Monte Carlo hit rate for an accumulator.
 * Independent Bernoulli when rho = 0; Gaussian copula when a correlation matrix exists.
 */

import { analyzeCorrelation, correlationMatrix } from "@/lib/smart-combos/correlation";
import { independentApexProbability } from "@/lib/smart-combos/pricing";
import type { ComboLeg, ComboMonteCarlo } from "@/lib/smart-combos/types";

export const DEFAULT_COMBO_TRIALS = 6_000;
export const DEFAULT_COMBO_SEED = 20260828;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-a * a));
  return sign * y;
}

function phi(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function boxMuller(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function cholesky(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = 0;
      for (let k = 0; k < j; k += 1) sum += L[i]![k]! * L[j]![k]!;
      if (i === j) {
        const diag = matrix[i]![i]! - sum;
        if (diag <= 1e-9) return null;
        L[i]![j] = Math.sqrt(diag);
      } else {
        const denom = L[j]![j]!;
        if (denom <= 1e-12) return null;
        L[i]![j] = (matrix[i]![j]! - sum) / denom;
      }
    }
  }
  return L;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx]!;
}

export function simulateCombo(
  legs: ComboLeg[],
  options: { trials?: number; seed?: number } = {},
): ComboMonteCarlo {
  const trials = options.trials ?? DEFAULT_COMBO_TRIALS;
  const seed = options.seed ?? DEFAULT_COMBO_SEED;
  const independentHitRate = independentApexProbability(legs) ?? 0;
  const histogram = Array.from({ length: legs.length + 1 }, () => 0);
  const correlation = analyzeCorrelation(legs);

  if (legs.length === 0 || correlation.hasConflict || correlation.hasDuplicate) {
    histogram[0] = trials;
    return {
      trials,
      seed,
      hitRate: 0,
      independentHitRate: correlation.hasConflict ? 0 : independentHitRate,
      histogram,
      p05: 0,
      p50: 0,
      p95: 0,
    };
  }

  const probs = legs.map((leg) => leg.apexProbability);
  if (probs.some((p) => p == null)) {
    histogram[0] = trials;
    return {
      trials,
      seed,
      hitRate: 0,
      independentHitRate,
      histogram,
      p05: 0,
      p50: 0,
      p95: 0,
    };
  }

  const rand = mulberry32(seed);
  const L = cholesky(correlationMatrix(legs));
  const hits: number[] = [];
  let fullHits = 0;

  for (let t = 0; t < trials; t += 1) {
    const z = Array.from({ length: legs.length }, () => boxMuller(rand));
    const correlated = z.map((_, i) => {
      if (!L) return z[i]!;
      let sum = 0;
      for (let k = 0; k <= i; k += 1) sum += L[i]![k]! * z[k]!;
      return sum;
    });
    let count = 0;
    for (let i = 0; i < legs.length; i += 1) {
      if (phi(correlated[i]!) < probs[i]!) count += 1;
    }
    histogram[count] = (histogram[count] ?? 0) + 1;
    hits.push(count);
    if (count === legs.length) fullHits += 1;
  }

  hits.sort((a, b) => a - b);
  return {
    trials,
    seed,
    hitRate: fullHits / trials,
    independentHitRate,
    histogram,
    p05: percentile(hits, 0.05),
    p50: percentile(hits, 0.5),
    p95: percentile(hits, 0.95),
  };
}
