/**
 * Descriptive HOME/DRAW/AWAY calibration. Not a winner rule.
 */

import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { sortCandidateScores } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import { OBSERVED_CLASSES } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { ClasswiseAggregate } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function predictedForClass(row: {
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
}, observedClass: (typeof OBSERVED_CLASSES)[number]): number {
  if (observedClass === "HOME") return row.homeProbability;
  if (observedClass === "AWAY") return row.awayProbability;
  return row.drawProbability;
}

export function classwiseCalibration(
  artifacts: readonly ProspectiveScoredArtifact[],
): ClasswiseAggregate[] {
  const n = artifacts.length;
  return PROSPECTIVE_CANDIDATE_IDS.flatMap((candidateId) =>
    OBSERVED_CLASSES.map((observedClass) => {
      const rows = artifacts.map((artifact) => {
        const row = sortCandidateScores(artifact.candidateScores).find(
          (item) => item.candidateId === candidateId,
        );
        if (!row) {
          throw new Error(`missing candidate row ${candidateId} after integrity`);
        }
        return { row, observed: artifact.observedClass };
      });
      const observationCount = rows.filter((item) => item.observed === observedClass).length;
      const observedFrequency = n === 0 ? 0 : observationCount / n;
      const meanPredictedProbability =
        n === 0
          ? 0
          : rows.reduce((sum, item) => sum + predictedForClass(item.row, observedClass), 0) / n;
      return {
        candidateId,
        observedClass,
        observationCount,
        observedFrequency: finiteOrZero(observedFrequency),
        meanPredictedProbability: finiteOrZero(meanPredictedProbability),
        absoluteCalibrationGap: finiteOrZero(Math.abs(meanPredictedProbability - observedFrequency)),
      };
    }),
  );
}
