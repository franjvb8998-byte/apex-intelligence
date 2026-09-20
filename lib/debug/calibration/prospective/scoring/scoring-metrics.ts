/**
 * Per-observation log loss and multiclass Brier. Reuses frozen 5B metrics.ts.
 */

import {
  LOG_LOSS_EPS,
  argmaxOutcome,
  brierOneXTwo,
  logLossOneXTwo,
} from "@/lib/debug/calibration/metrics";
import type { OneXTwo } from "@/lib/debug/calibration/types";
import type { ProspectivePredictionRecord } from "@/lib/debug/calibration/prospective/candidate-types";
import {
  fromCalibrationOutcome,
  toCalibrationOutcome,
} from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import type { CandidateScoreRow, ObservedClass } from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export { LOG_LOSS_EPS };

export function frozenOneXTwo(record: ProspectivePredictionRecord): OneXTwo {
  return {
    home: record.probHome,
    draw: record.probDraw,
    away: record.probAway,
  };
}

export function scoreCandidateObservation(
  record: ProspectivePredictionRecord,
  observedClass: ObservedClass,
): CandidateScoreRow {
  const predicted = frozenOneXTwo(record);
  const actual = toCalibrationOutcome(observedClass);
  const predictedClass = fromCalibrationOutcome(argmaxOutcome(predicted));
  const yHome = actual === "home" ? 1 : 0;
  const yDraw = actual === "draw" ? 1 : 0;
  const yAway = actual === "away" ? 1 : 0;
  return {
    candidateId: record.candidateId,
    homeProbability: record.probHome,
    drawProbability: record.probDraw,
    awayProbability: record.probAway,
    predictedClass,
    confidence: record.confidence,
    observedClass,
    probabilityAssignedToObservedClass: predicted[actual],
    isCorrect: predictedClass === observedClass,
    logLossContribution: logLossOneXTwo(predicted, actual),
    brierContribution: brierOneXTwo(predicted, actual),
    brierHomeComponent: (predicted.home - yHome) ** 2,
    brierDrawComponent: (predicted.draw - yDraw) ** 2,
    brierAwayComponent: (predicted.away - yAway) ** 2,
    observedHome: yHome as 0 | 1,
    observedDraw: yDraw as 0 | 1,
    observedAway: yAway as 0 | 1,
  };
}

export function probabilitiesMatchSource(
  row: CandidateScoreRow,
  record: ProspectivePredictionRecord,
): boolean {
  return (
    row.homeProbability === record.probHome
    && row.drawProbability === record.probDraw
    && row.awayProbability === record.probAway
    && row.confidence === record.confidence
  );
}
