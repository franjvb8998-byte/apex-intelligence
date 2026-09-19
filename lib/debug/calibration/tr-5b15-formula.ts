/**
 * Debug-only HIGH_EQUAL temporal compose. Isolated. Does not mutate production PE.
 * Bootstrap seed 5152026. Exactly 2000 resamples. No fitting.
 */

import { mulberry32, pearsonCorrelation } from "@/lib/debug/calibration/hs-5b14-formula";
import { isHighEqual, isLowEqual } from "@/lib/debug/calibration/hs-5b14-shape";
import type { HsMatchTrace } from "@/lib/debug/calibration/hs-5b14-evaluate";
import {
  TR_BOOTSTRAP_RESAMPLES,
  TR_BOOTSTRAP_SEED,
} from "@/lib/debug/calibration/tr-5b15-shape";

export function highEqualExpected(trace: HsMatchTrace): number {
  return (
    trace.independentEqual["2-2"] +
    trace.independentEqual["3-3"] +
    trace.independentEqual["4-4"] +
    trace.independentEqual["5-5+"]
  );
}

export function lowEqualExpected(trace: HsMatchTrace): number {
  return trace.independentEqual["0-0"] + trace.independentEqual["1-1"];
}

export function twoTwoExpected(trace: HsMatchTrace): number {
  return trace.independentEqual["2-2"];
}

export function threeThreeExpected(trace: HsMatchTrace): number {
  return trace.independentEqual["3-3"];
}

export function fourPlusExpected(trace: HsMatchTrace): number {
  return trace.independentEqual["4-4"] + trace.independentEqual["5-5+"];
}

export function isTwoTwo(trace: HsMatchTrace): boolean {
  return trace.actualHomeGoals === 2 && trace.actualAwayGoals === 2;
}

export function isThreeThree(trace: HsMatchTrace): boolean {
  return trace.actualHomeGoals === 3 && trace.actualAwayGoals === 3;
}

export function isFourPlusEqual(trace: HsMatchTrace): boolean {
  return isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals) && trace.actualHomeGoals >= 4;
}

export function isLowEqualTrace(trace: HsMatchTrace): boolean {
  return isLowEqual(trace.actualHomeGoals, trace.actualAwayGoals);
}

export function isHighEqualTrace(trace: HsMatchTrace): boolean {
  return isHighEqual(trace.actualHomeGoals, trace.actualAwayGoals);
}

export type IntervalEstimate = {
  estimate: number;
  lo: number;
  hi: number;
};

export type BootstrapPair = {
  seed: number;
  resamples: number;
  rate: IntervalEstimate;
  oe: IntervalEstimate;
};

function requireTrBootstrap(seed: number, resamples: number): void {
  if (seed !== TR_BOOTSTRAP_SEED) {
    throw new Error(`Bootstrap seed must be exactly ${TR_BOOTSTRAP_SEED}`);
  }
  if (resamples !== TR_BOOTSTRAP_RESAMPLES) {
    throw new Error(`Bootstrap resamples must be exactly ${TR_BOOTSTRAP_RESAMPLES}`);
  }
}

function percentile(sorted: readonly number[], tail: "lo" | "hi"): number {
  const index =
    tail === "lo"
      ? Math.floor(0.025 * (sorted.length - 1))
      : Math.ceil(0.975 * (sorted.length - 1));
  return sorted[index]!;
}

export function bootstrapHighEqual(input: {
  traces: readonly HsMatchTrace[];
  seed?: number;
  resamples?: number;
}): BootstrapPair {
  const seed = input.seed ?? TR_BOOTSTRAP_SEED;
  const resamples = input.resamples ?? TR_BOOTSTRAP_RESAMPLES;
  requireTrBootstrap(seed, resamples);
  const n = input.traces.length;
  const observedCount = input.traces.filter(isHighEqualTrace).length;
  const expectedCount = input.traces.reduce((sum, trace) => sum + highEqualExpected(trace), 0);
  const rateEstimate = n === 0 ? 0 : observedCount / n;
  const oeEstimate = expectedCount > 0 ? observedCount / expectedCount : 0;
  const rng = mulberry32(seed);
  const rates: number[] = [];
  const oes: number[] = [];
  for (let r = 0; r < resamples; r += 1) {
    let obs = 0;
    let exp = 0;
    for (let i = 0; i < n; i += 1) {
      const trace = input.traces[Math.floor(rng() * n)]!;
      if (isHighEqualTrace(trace)) obs += 1;
      exp += highEqualExpected(trace);
    }
    rates.push(n === 0 ? 0 : obs / n);
    oes.push(exp > 0 ? obs / exp : 0);
  }
  rates.sort((left, right) => left - right);
  oes.sort((left, right) => left - right);
  return {
    seed,
    resamples,
    rate: { estimate: rateEstimate, lo: percentile(rates, "lo"), hi: percentile(rates, "hi") },
    oe: { estimate: oeEstimate, lo: percentile(oes, "lo"), hi: percentile(oes, "hi") },
  };
}

export function bootstrapResidual(input: {
  traces: readonly HsMatchTrace[];
  seed?: number;
  resamples?: number;
}): IntervalEstimate & { seed: number; resamples: number } {
  const seed = input.seed ?? TR_BOOTSTRAP_SEED;
  const resamples = input.resamples ?? TR_BOOTSTRAP_RESAMPLES;
  requireTrBootstrap(seed, resamples);
  const xs = input.traces.map((trace) => trace.homeResidual);
  const ys = input.traces.map((trace) => trace.awayResidual);
  const estimate = pearsonCorrelation(xs, ys);
  const rng = mulberry32(seed);
  const n = input.traces.length;
  const samples: number[] = [];
  for (let r = 0; r < resamples; r += 1) {
    const bx: number[] = [];
    const by: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const index = Math.floor(rng() * n);
      bx.push(xs[index]!);
      by.push(ys[index]!);
    }
    samples.push(pearsonCorrelation(bx, by));
  }
  samples.sort((left, right) => left - right);
  return {
    estimate,
    lo: percentile(samples, "lo"),
    hi: percentile(samples, "hi"),
    seed,
    resamples,
  };
}
