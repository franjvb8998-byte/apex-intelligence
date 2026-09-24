/**
 * GOALS-1G.1 — Calibration metrics and reliability (no calibrator fit).
 */

import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  GOALS_MCAL_LOGIT_EPSILON,
  GOALS_MCAL_MIN_BIN_SUPPORT,
  GOALS_MCAL_RARE_EVENT_RATE,
  GOALS_MCAL_RELIABILITY_BINS,
  type GoalsMcalCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";

export function clipLogitP(
  p: number,
  eps: number = GOALS_MCAL_LOGIT_EPSILON,
): number {
  return Math.min(1 - eps, Math.max(eps, p));
}

export function logit(p: number, eps: number = GOALS_MCAL_LOGIT_EPSILON): number {
  const pp = clipLogitP(p, eps);
  return Math.log(pp / (1 - pp));
}

export type ReliabilityBin = {
  lo: number;
  hi: number;
  n: number;
  meanPredicted: number;
  actualFrequency: number;
  calibrationGap: number;
  lowSupport: boolean;
};

export function reliabilityDiagram(
  obs: readonly GoalsMcalObservation[],
): ReliabilityBin[] {
  const edges = GOALS_MCAL_RELIABILITY_BINS;
  const bins: ReliabilityBin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const subset = obs.filter(
      (o) => o.rawProbability >= lo && o.rawProbability < hi,
    );
    const n = subset.length;
    const meanPredicted = n
      ? subset.reduce((s, o) => s + o.rawProbability, 0) / n
      : NaN;
    const actualFrequency = n
      ? subset.reduce((s, o) => s + o.actualBinaryOutcome, 0) / n
      : NaN;
    bins.push({
      lo,
      hi,
      n,
      meanPredicted,
      actualFrequency,
      calibrationGap: n ? meanPredicted - actualFrequency : NaN,
      lowSupport: n < GOALS_MCAL_MIN_BIN_SUPPORT,
    });
  }
  return bins;
}

export function ece(bins: readonly ReliabilityBin[], nTotal: number): number {
  if (nTotal <= 0) return NaN;
  let s = 0;
  for (const b of bins) {
    if (b.n === 0) continue;
    s += (b.n / nTotal) * Math.abs(b.calibrationGap);
  }
  return s;
}

export type MarketSupport = {
  market: GoalsMcalCanonicalMarket;
  n: number;
  positives: number;
  negatives: number;
  positiveRate: number;
  meanPredicted: number;
  minPredicted: number;
  maxPredicted: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  uniqueProbabilityCount: number;
  rareEvent: boolean;
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx]!;
}

export function marketSupport(
  market: GoalsMcalCanonicalMarket,
  obs: readonly GoalsMcalObservation[],
): MarketSupport {
  const rows = obs.filter((o) => o.market === market);
  const n = rows.length;
  const positives = rows.filter((o) => o.actualBinaryOutcome === 1).length;
  const negatives = n - positives;
  const probs = rows.map((o) => o.rawProbability).sort((a, b) => a - b);
  const unique = new Set(probs.map((p) => p.toFixed(12))).size;
  const positiveRate = n ? positives / n : NaN;
  return {
    market,
    n,
    positives,
    negatives,
    positiveRate,
    meanPredicted: n ? probs.reduce((a, b) => a + b, 0) / n : NaN,
    minPredicted: n ? probs[0]! : NaN,
    maxPredicted: n ? probs[n - 1]! : NaN,
    p05: percentile(probs, 5),
    p25: percentile(probs, 25),
    p50: percentile(probs, 50),
    p75: percentile(probs, 75),
    p95: percentile(probs, 95),
    uniqueProbabilityCount: unique,
    rareEvent:
      n > 0 &&
      (positiveRate < GOALS_MCAL_RARE_EVENT_RATE ||
        positiveRate > 1 - GOALS_MCAL_RARE_EVENT_RATE),
  };
}

export type MarketCalibrationMetrics = {
  market: GoalsMcalCanonicalMarket;
  n: number;
  logLoss: number;
  brier: number;
  meanPredicted: number;
  actualRate: number;
  calibrationInTheLarge: number;
  ece: number;
  maxAbsBinGap: number;
  maxAbsBinGapN: number;
  reliability: ReliabilityBin[];
};

export function marketCalibrationMetrics(
  market: GoalsMcalCanonicalMarket,
  obs: readonly GoalsMcalObservation[],
): MarketCalibrationMetrics {
  const rows = obs.filter((o) => o.market === market);
  const n = rows.length;
  let ll = 0;
  let br = 0;
  let sumP = 0;
  let sumY = 0;
  for (const o of rows) {
    ll += binaryLogLoss(o.rawProbability, o.actualBinaryOutcome);
    br += binaryBrier(o.rawProbability, o.actualBinaryOutcome);
    sumP += o.rawProbability;
    sumY += o.actualBinaryOutcome;
  }
  const reliability = reliabilityDiagram(rows);
  let maxAbsBinGap = 0;
  let maxAbsBinGapN = 0;
  for (const b of reliability) {
    if (b.n === 0) continue;
    const g = Math.abs(b.calibrationGap);
    if (g >= maxAbsBinGap) {
      maxAbsBinGap = g;
      maxAbsBinGapN = b.n;
    }
  }
  const meanPredicted = n ? sumP / n : NaN;
  const actualRate = n ? sumY / n : NaN;
  return {
    market,
    n,
    logLoss: n ? ll / n : NaN,
    brier: n ? br / n : NaN,
    meanPredicted,
    actualRate,
    calibrationInTheLarge: actualRate - meanPredicted,
    ece: ece(reliability, n),
    maxAbsBinGap,
    maxAbsBinGapN,
    reliability,
  };
}

/**
 * Diagnostic logistic recalibration: logit(y) ~ a + b * logit(p).
 * Solved via IRLS Newton for 2-parameter logistic regression.
 * NOT a production calibrator.
 */
export function logisticCalibrationDiagnostic(
  obs: readonly GoalsMcalObservation[],
  eps: number = GOALS_MCAL_LOGIT_EPSILON,
): {
  intercept: number;
  slope: number;
  n: number;
  converged: boolean;
  note: string;
} {
  const n = obs.length;
  if (n < 10) {
    return {
      intercept: NaN,
      slope: NaN,
      n,
      converged: false,
      note: "insufficient_n",
    };
  }
  const xs = obs.map((o) => logit(o.rawProbability, eps));
  const ys = obs.map((o) => o.actualBinaryOutcome);

  let a = 0;
  let b = 1;
  let converged = false;
  for (let iter = 0; iter < 40; iter += 1) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < n; i += 1) {
      const eta = a + b * xs[i]!;
      const p = 1 / (1 + Math.exp(-eta));
      const w = p * (1 - p);
      const r = ys[i]! - p;
      g0 += r;
      g1 += r * xs[i]!;
      h00 += w;
      h01 += w * xs[i]!;
      h11 += w * xs[i]! * xs[i]!;
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-18) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (-h01 * g0 + h00 * g1) / det;
    a += da;
    b += db;
    if (Math.abs(da) < 1e-10 && Math.abs(db) < 1e-10) {
      converged = true;
      break;
    }
  }
  return {
    intercept: a,
    slope: b,
    n,
    converged,
    note: "diagnostic_only_not_production_calibrator",
  };
}
