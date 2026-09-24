/**
 * GOALS-1G.2 — Metrics on raw vs calibrated probabilities.
 */

import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import type { CalibratedObservation } from "@/lib/debug/calibration/goals/market-calibration-poc/apply";
import {
  GOALS_MCAL_POC_MIN_BIN_SUPPORT,
  GOALS_MCAL_POC_RELIABILITY_BINS,
  type GoalsMcalPocCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export type ReliabilityBin = {
  lo: number;
  hi: number;
  n: number;
  meanPredicted: number;
  actualFrequency: number;
  calibrationGap: number;
  lowSupport: boolean;
};

function reliabilityFromProbs(
  pairs: { p: number; y: 0 | 1 }[],
): ReliabilityBin[] {
  const edges = GOALS_MCAL_POC_RELIABILITY_BINS;
  const bins: ReliabilityBin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    const subset = pairs.filter((x) => x.p >= lo && x.p < hi);
    const n = subset.length;
    const meanPredicted = n
      ? subset.reduce((s, x) => s + x.p, 0) / n
      : NaN;
    const actualFrequency = n
      ? subset.reduce((s, x) => s + x.y, 0) / n
      : NaN;
    bins.push({
      lo,
      hi,
      n,
      meanPredicted,
      actualFrequency,
      calibrationGap: n ? meanPredicted - actualFrequency : NaN,
      lowSupport: n < GOALS_MCAL_POC_MIN_BIN_SUPPORT,
    });
  }
  return bins;
}

function ece(bins: readonly ReliabilityBin[], nTotal: number): number {
  if (nTotal <= 0) return NaN;
  let s = 0;
  for (const b of bins) {
    if (b.n === 0) continue;
    s += (b.n / nTotal) * Math.abs(b.calibrationGap);
  }
  return s;
}

export type ProbMetrics = {
  market: string;
  n: number;
  logLoss: number;
  brier: number;
  meanPredicted: number;
  actualRate: number;
  calibrationInTheLarge: number;
  ece: number;
};

export function metricsFromPairs(
  market: string,
  pairs: { p: number; y: 0 | 1 }[],
): ProbMetrics {
  const n = pairs.length;
  if (!n) {
    return {
      market,
      n: 0,
      logLoss: NaN,
      brier: NaN,
      meanPredicted: NaN,
      actualRate: NaN,
      calibrationInTheLarge: NaN,
      ece: NaN,
    };
  }
  let ll = 0;
  let br = 0;
  let sumP = 0;
  let sumY = 0;
  for (const x of pairs) {
    ll += binaryLogLoss(x.p, x.y);
    br += binaryBrier(x.p, x.y);
    sumP += x.p;
    sumY += x.y;
  }
  const reliability = reliabilityFromProbs(pairs);
  const meanPredicted = sumP / n;
  const actualRate = sumY / n;
  return {
    market,
    n,
    logLoss: ll / n,
    brier: br / n,
    meanPredicted,
    actualRate,
    calibrationInTheLarge: actualRate - meanPredicted,
    ece: ece(reliability, n),
  };
}

export function rawMarketMetrics(
  market: GoalsMcalPocCanonicalMarket,
  obs: readonly GoalsMcalObservation[],
): ProbMetrics {
  const rows = obs.filter((o) => o.market === market);
  return metricsFromPairs(
    market,
    rows.map((o) => ({ p: o.rawProbability, y: o.actualBinaryOutcome })),
  );
}

export function calMarketMetrics(
  market: GoalsMcalPocCanonicalMarket,
  obs: readonly CalibratedObservation[],
): ProbMetrics {
  const rows = obs.filter((o) => o.market === market);
  return metricsFromPairs(
    market,
    rows.map((o) => ({
      p: o.calibratedProbability,
      y: o.actualBinaryOutcome,
    })),
  );
}

export function aggregateGroupMetrics(
  markets: readonly GoalsMcalPocCanonicalMarket[],
  obs: readonly GoalsMcalObservation[],
  pOf: (o: GoalsMcalObservation) => number,
): ProbMetrics {
  const set = new Set<string>(markets);
  const rows = obs.filter((o) => set.has(o.market));
  return metricsFromPairs(
    markets.join("+"),
    rows.map((o) => ({ p: pOf(o), y: o.actualBinaryOutcome })),
  );
}
