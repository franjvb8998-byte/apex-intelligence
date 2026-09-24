/**
 * PE-4G.4 — Multiclass 1X2 metrics (natural log).
 */

import {
  PE4_EXPECTATION_POC_PROBABILITY_FLOOR,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import type { Pe4ExpectationActualOutcome } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type OneXTwoProb = {
  HOME: number;
  DRAW: number;
  AWAY: number;
};

export function normalizeOneXTwo(
  p: OneXTwoProb,
  floor = PE4_EXPECTATION_POC_PROBABILITY_FLOOR,
): OneXTwoProb {
  const h = Math.max(floor, p.HOME);
  const d = Math.max(floor, p.DRAW);
  const a = Math.max(floor, p.AWAY);
  const s = h + d + a;
  return { HOME: h / s, DRAW: d / s, AWAY: a / s };
}

export function assertValidOneXTwo(p: OneXTwoProb): void {
  const s = p.HOME + p.DRAW + p.AWAY;
  if (
    !(
      Number.isFinite(p.HOME) &&
      Number.isFinite(p.DRAW) &&
      Number.isFinite(p.AWAY) &&
      p.HOME >= 0 &&
      p.DRAW >= 0 &&
      p.AWAY >= 0 &&
      Math.abs(s - 1) < 1e-9
    )
  ) {
    throw new Error(`Invalid 1X2 probabilities: ${JSON.stringify(p)}`);
  }
}

export function multiclassLogLoss(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) {
    throw new Error("logLoss length mismatch or empty");
  }
  let sum = 0;
  for (let i = 0; i < predictions.length; i += 1) {
    const p = normalizeOneXTwo(predictions[i]!);
    assertValidOneXTwo(p);
    const y = outcomes[i]!;
    const py = p[y];
    sum += -Math.log(py);
  }
  return sum / predictions.length;
}

export function multiclassBrier(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) {
    throw new Error("brier length mismatch or empty");
  }
  let sum = 0;
  for (let i = 0; i < predictions.length; i += 1) {
    const p = normalizeOneXTwo(predictions[i]!);
    const y = outcomes[i]!;
    for (const k of ["HOME", "DRAW", "AWAY"] as const) {
      const t = y === k ? 1 : 0;
      sum += (p[k] - t) ** 2;
    }
  }
  return sum / predictions.length;
}

export function meanProbRealized(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
): number {
  let sum = 0;
  for (let i = 0; i < predictions.length; i += 1) {
    const p = normalizeOneXTwo(predictions[i]!);
    sum += p[outcomes[i]!];
  }
  return sum / predictions.length;
}

export function descriptiveAccuracy(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
): number {
  let correct = 0;
  for (let i = 0; i < predictions.length; i += 1) {
    const p = normalizeOneXTwo(predictions[i]!);
    let arg: Pe4ExpectationActualOutcome = "HOME";
    if (p.DRAW > p[arg]) arg = "DRAW";
    if (p.AWAY > p[arg]) arg = "AWAY";
    if (arg === outcomes[i]) correct += 1;
  }
  return correct / predictions.length;
}

export function empiricalOneXTwo(
  outcomes: readonly Pe4ExpectationActualOutcome[],
): OneXTwoProb {
  const counts = { HOME: 0, DRAW: 0, AWAY: 0 };
  for (const y of outcomes) counts[y] += 1;
  const n = outcomes.length;
  if (n === 0) return normalizeOneXTwo({ HOME: 1, DRAW: 1, AWAY: 1 });
  return normalizeOneXTwo({
    HOME: counts.HOME / n,
    DRAW: counts.DRAW / n,
    AWAY: counts.AWAY / n,
  });
}

export type MetricBundle = {
  n: number;
  logLoss: number;
  brier: number;
  meanProbRealized: number;
  accuracyDescriptive: number;
  meanPredicted: OneXTwoProb;
  actualRates: OneXTwoProb;
};

export function scorePredictions(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
): MetricBundle {
  const meanPredicted = { HOME: 0, DRAW: 0, AWAY: 0 };
  for (const raw of predictions) {
    const p = normalizeOneXTwo(raw);
    meanPredicted.HOME += p.HOME;
    meanPredicted.DRAW += p.DRAW;
    meanPredicted.AWAY += p.AWAY;
  }
  const n = predictions.length;
  return {
    n,
    logLoss: multiclassLogLoss(predictions, outcomes),
    brier: multiclassBrier(predictions, outcomes),
    meanProbRealized: meanProbRealized(predictions, outcomes),
    accuracyDescriptive: descriptiveAccuracy(predictions, outcomes),
    meanPredicted: {
      HOME: meanPredicted.HOME / n,
      DRAW: meanPredicted.DRAW / n,
      AWAY: meanPredicted.AWAY / n,
    },
    actualRates: empiricalOneXTwo(outcomes),
  };
}

export type CalibrationBin = {
  label: string;
  minInclusive: number;
  maxExclusive: number;
  n: number;
  meanPredicted: number;
  empiricalRate: number;
};

/**
 * Coarse reliability bins for one outcome class (min support enforced).
 * Edges are fixed pre-registered tercile-ish bands — not tuned on validation.
 */
export function calibrationBinsForClass(
  predictions: readonly OneXTwoProb[],
  outcomes: readonly Pe4ExpectationActualOutcome[],
  outcome: Pe4ExpectationActualOutcome,
  edges: readonly number[] = [0, 0.2, 0.3, 0.4, 0.55, 1.0000001],
  minSupport = 15,
): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i]!;
    const hi = edges[i + 1]!;
    let n = 0;
    let sumP = 0;
    let sumY = 0;
    for (let j = 0; j < predictions.length; j += 1) {
      const p = normalizeOneXTwo(predictions[j]!)[outcome];
      if (p >= lo && p < hi) {
        n += 1;
        sumP += p;
        sumY += outcomes[j] === outcome ? 1 : 0;
      }
    }
    if (n < minSupport) continue;
    bins.push({
      label: `[${lo},${hi})`,
      minInclusive: lo,
      maxExclusive: hi,
      n,
      meanPredicted: sumP / n,
      empiricalRate: sumY / n,
    });
  }
  return bins;
}

export function probabilityExtrema(
  predictions: readonly OneXTwoProb[],
): {
  minHOME: number;
  maxHOME: number;
  minDRAW: number;
  maxDRAW: number;
  minAWAY: number;
  maxAWAY: number;
  nearZeroCount: number;
} {
  let minHOME = 1;
  let maxHOME = 0;
  let minDRAW = 1;
  let maxDRAW = 0;
  let minAWAY = 1;
  let maxAWAY = 0;
  let nearZeroCount = 0;
  for (const raw of predictions) {
    const p = normalizeOneXTwo(raw);
    minHOME = Math.min(minHOME, p.HOME);
    maxHOME = Math.max(maxHOME, p.HOME);
    minDRAW = Math.min(minDRAW, p.DRAW);
    maxDRAW = Math.max(maxDRAW, p.DRAW);
    minAWAY = Math.min(minAWAY, p.AWAY);
    maxAWAY = Math.max(maxAWAY, p.AWAY);
    if (p.HOME < 1e-4 || p.DRAW < 1e-4 || p.AWAY < 1e-4) nearZeroCount += 1;
  }
  return {
    minHOME,
    maxHOME,
    minDRAW,
    maxDRAW,
    minAWAY,
    maxAWAY,
    nearZeroCount,
  };
}
