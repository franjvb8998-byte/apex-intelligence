/**
 * Offline 1X2 metrics. Log loss clips at eps to avoid log(0).
 */

import type {
  CalibrationOutcome,
  EvidenceBucket,
  OneXTwo,
} from "@/lib/debug/calibration/types";

export const LOG_LOSS_EPS = 1e-15;
export const CALIBRATION_BIN_COUNT = 10;
export const PROBABILITY_SUM_TOLERANCE = 1e-6;

export type MetricRow = {
  predicted: OneXTwo;
  actual: CalibrationOutcome;
  bucket: EvidenceBucket;
  policyId: string;
  competitionId?: string;
  category?: string;
};

export type ReliabilityBin = {
  index: number;
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number;
  empiricalFrequency: number;
};

export type MetricSummary = {
  n: number;
  logLoss: number;
  brier: number;
  ece: number;
  accuracy: number;
  meanPredictedOnActual: number;
  reliability: ReliabilityBin[];
};

function actualVector(actual: CalibrationOutcome): OneXTwo {
  return {
    home: actual === "home" ? 1 : 0,
    draw: actual === "draw" ? 1 : 0,
    away: actual === "away" ? 1 : 0,
  };
}

export function probabilityOnActual(
  predicted: OneXTwo,
  actual: CalibrationOutcome,
): number {
  return predicted[actual];
}

export function isValidOneXTwo(predicted: OneXTwo): boolean {
  const values = [predicted.home, predicted.draw, predicted.away];
  if (!values.every((value) => Number.isFinite(value) && value >= 0)) {
    return false;
  }
  const sum = predicted.home + predicted.draw + predicted.away;
  return Math.abs(sum - 1) <= PROBABILITY_SUM_TOLERANCE;
}

export function assertFiniteMetricSummary(summary: MetricSummary): MetricSummary {
  const scalars = [
    summary.n,
    summary.logLoss,
    summary.brier,
    summary.ece,
    summary.accuracy,
    summary.meanPredictedOnActual,
  ];
  if (!scalars.every((value) => Number.isFinite(value))) {
    throw new Error("Calibration metrics contained a non-finite value");
  }
  return summary;
}

export function logLossOneXTwo(
  predicted: OneXTwo,
  actual: CalibrationOutcome,
  eps = LOG_LOSS_EPS,
): number {
  const p = Math.min(1, Math.max(eps, probabilityOnActual(predicted, actual)));
  return -Math.log(p);
}

export function brierOneXTwo(
  predicted: OneXTwo,
  actual: CalibrationOutcome,
): number {
  const y = actualVector(actual);
  return (
    (predicted.home - y.home) ** 2 +
    (predicted.draw - y.draw) ** 2 +
    (predicted.away - y.away) ** 2
  );
}

export function argmaxOutcome(predicted: OneXTwo): CalibrationOutcome {
  if (predicted.home >= predicted.draw && predicted.home >= predicted.away) {
    return "home";
  }
  if (predicted.away >= predicted.draw) return "away";
  return "draw";
}

/**
 * Confidence reliability: bin the argmax predicted probability, then compare
 * mean confidence in the bin to empirical accuracy (argmax == actual).
 */
export function reliabilityBins(
  rows: readonly MetricRow[],
  binCount = CALIBRATION_BIN_COUNT,
): ReliabilityBin[] {
  const bins: ReliabilityBin[] = Array.from({ length: binCount }, (_, index) => ({
    index,
    lower: index / binCount,
    upper: (index + 1) / binCount,
    count: 0,
    meanPredicted: 0,
    empiricalFrequency: 0,
  }));
  const sums = bins.map(() => ({ p: 0, hits: 0 }));
  for (const row of rows) {
    const predictedLabel = argmaxOutcome(row.predicted);
    const confidence = row.predicted[predictedLabel];
    const last = binCount - 1;
    const index =
      confidence >= 1
        ? last
        : Math.max(0, Math.min(last, Math.floor(confidence * binCount)));
    const bin = bins[index]!;
    const acc = sums[index]!;
    bin.count += 1;
    acc.p += confidence;
    if (predictedLabel === row.actual) acc.hits += 1;
  }
  for (let i = 0; i < binCount; i += 1) {
    const bin = bins[i]!;
    if (bin.count === 0) continue;
    bin.meanPredicted = sums[i]!.p / bin.count;
    bin.empiricalFrequency = sums[i]!.hits / bin.count;
  }
  return bins;
}

export function expectedCalibrationError(bins: readonly ReliabilityBin[], n: number): number {
  if (n <= 0) return 0;
  let ece = 0;
  for (const bin of bins) {
    if (bin.count === 0) continue;
    ece += (bin.count / n) * Math.abs(bin.empiricalFrequency - bin.meanPredicted);
  }
  return ece;
}

export function summarizeMetrics(rows: readonly MetricRow[]): MetricSummary {
  const usable = rows.filter((row) => isValidOneXTwo(row.predicted));
  const n = usable.length;
  if (n === 0) {
    return assertFiniteMetricSummary({
      n: 0,
      logLoss: 0,
      brier: 0,
      ece: 0,
      accuracy: 0,
      meanPredictedOnActual: 0,
      reliability: reliabilityBins([]),
    });
  }
  let logLoss = 0;
  let brier = 0;
  let correct = 0;
  let meanP = 0;
  for (const row of usable) {
    logLoss += logLossOneXTwo(row.predicted, row.actual);
    brier += brierOneXTwo(row.predicted, row.actual);
    meanP += probabilityOnActual(row.predicted, row.actual);
    if (argmaxOutcome(row.predicted) === row.actual) correct += 1;
  }
  const reliability = reliabilityBins(usable);
  return assertFiniteMetricSummary({
    n,
    logLoss: logLoss / n,
    brier: brier / n,
    ece: expectedCalibrationError(reliability, n),
    accuracy: correct / n,
    meanPredictedOnActual: meanP / n,
    reliability,
  });
}

export function stratifyMetrics(
  rows: readonly MetricRow[],
): Record<string, MetricSummary> {
  const groups = new Map<string, MetricRow[]>();
  const push = (key: string, row: MetricRow) => {
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  };
  for (const row of rows) {
    push("all", row);
    push(`bucket:${row.bucket}`, row);
    push(`policy:${row.policyId}`, row);
    push(`policy:${row.policyId}|bucket:${row.bucket}`, row);
    if (row.competitionId) push(`competition:${row.competitionId}`, row);
    if (row.category) push(`category:${row.category}`, row);
  }
  const out: Record<string, MetricSummary> = {};
  for (const [key, list] of groups) {
    out[key] = summarizeMetrics(list);
  }
  return out;
}
