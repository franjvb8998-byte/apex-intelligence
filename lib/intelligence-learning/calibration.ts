/**
 * Confidence calibration: predicted reliability vs observed selection hits.
 */

import { round4 } from "@/lib/intelligence-learning/math";
import type {
  CalibrationBin,
  CalibrationReport,
  SettledLearningCase,
} from "@/lib/intelligence-learning/types";
import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";

const BIN_COUNT = 10;

export function evaluateCalibration(
  rows: SettledLearningCase[],
): CalibrationReport {
  const usable = rows.filter(
    (row) =>
      row.recommendation.confidence != null &&
      Number.isFinite(row.recommendation.confidence),
  );
  const bins: Array<{ sumPred: number; hits: number; count: number }> =
    Array.from({ length: BIN_COUNT }, () => ({
      sumPred: 0,
      hits: 0,
      count: 0,
    }));

  for (const row of usable) {
    const pct = Math.min(100, Math.max(0, row.recommendation.confidence ?? 0));
    const p = pct / 100;
    const index = Math.min(BIN_COUNT - 1, Math.floor(p * BIN_COUNT));
    const bin = bins[index]!;
    bin.count += 1;
    bin.sumPred += p;
    if (row.result.selectionHit) bin.hits += 1;
  }

  const resultBins: CalibrationBin[] = [];
  let ece = 0;
  const n = Math.max(usable.length, 1);

  for (let i = 0; i < BIN_COUNT; i += 1) {
    const lo = i * 10;
    const hi = i === BIN_COUNT - 1 ? 100 : (i + 1) * 10;
    const bin = bins[i]!;
    const predicted = bin.count === 0 ? (lo + hi) / 200 : bin.sumPred / bin.count;
    const observed = bin.count === 0 ? 0 : bin.hits / bin.count;
    const calibrationError = bin.count === 0 ? 0 : Math.abs(predicted - observed);
    resultBins.push({
      label: `${lo}-${hi}`,
      predicted: round4(predicted),
      observed: round4(observed),
      calibrationError: round4(calibrationError),
      count: bin.count,
    });
    if (bin.count > 0) {
      ece += (bin.count / n) * calibrationError;
    }
  }

  return {
    engineVersion: INTELLIGENCE_LEARNING_VERSION,
    sampleSize: usable.length,
    ece: round4(ece),
    bins: resultBins,
  };
}
