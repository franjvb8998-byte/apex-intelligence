/**
 * Multiclass ECE using the frozen 5B/5C.6 10-bin equal-width convention.
 *
 * Bins (CALIBRATION_BIN_COUNT = 10):
 *   [0.0, 0.1), [0.1, 0.2), ..., [0.8, 0.9), [0.9, 1.0]
 * Confidence 1.0 enters the final bin (reliabilityBins: confidence >= 1 ? last : floor(c * 10)).
 * ECE = sum over nonempty bins of (n_bin / N) * |bin_accuracy - bin_mean_confidence|.
 */

import {
  CALIBRATION_BIN_COUNT,
  expectedCalibrationError,
  reliabilityBins,
} from "@/lib/debug/calibration/metrics";
import type { MetricRow } from "@/lib/debug/calibration/metrics";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { sortCandidateScores } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import { toCalibrationOutcome } from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { CandidateEceReport, EceBinReport } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

export const EVALUATION_ECE_BIN_COUNT = CALIBRATION_BIN_COUNT;

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function metricRowsForCandidate(
  artifacts: readonly ProspectiveScoredArtifact[],
  candidateId: (typeof PROSPECTIVE_CANDIDATE_IDS)[number],
): MetricRow[] {
  return artifacts.map((artifact) => {
    const row = sortCandidateScores(artifact.candidateScores).find(
      (item) => item.candidateId === candidateId,
    );
    if (!row) {
      throw new Error(`missing candidate row ${candidateId} after integrity`);
    }
    return {
      predicted: {
        home: row.homeProbability,
        draw: row.drawProbability,
        away: row.awayProbability,
      },
      actual: toCalibrationOutcome(artifact.observedClass),
      bucket: "10+",
      policyId: candidateId,
    };
  });
}

export function eceReportsForCandidates(
  artifacts: readonly ProspectiveScoredArtifact[],
): CandidateEceReport[] {
  const n = artifacts.length;
  return PROSPECTIVE_CANDIDATE_IDS.map((candidateId) => {
    const rows = metricRowsForCandidate(artifacts, candidateId);
    const bins = reliabilityBins(rows, EVALUATION_ECE_BIN_COUNT);
    const ece = expectedCalibrationError(bins, n);
    const binReports: EceBinReport[] = bins.map((bin) => ({
      index: bin.index,
      lower: bin.lower,
      upper: bin.upper,
      count: bin.count,
      meanConfidence: finiteOrZero(bin.meanPredicted),
      accuracy: finiteOrZero(bin.empiricalFrequency),
      absoluteGap: finiteOrZero(Math.abs(bin.empiricalFrequency - bin.meanPredicted)),
    }));
    return {
      candidateId,
      ece: finiteOrZero(ece),
      bins: binReports,
    };
  });
}
