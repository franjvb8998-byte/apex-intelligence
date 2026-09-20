/**
 * Validate a scored artifact for evaluation. Rejects rather than repairing.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import {
  brierOneXTwo,
  isValidOneXTwo,
  logLossOneXTwo,
  argmaxOutcome,
} from "@/lib/debug/calibration/metrics";
import { assertScoredArtifactIntegrity } from "@/lib/debug/calibration/prospective/scoring/scoring-integrity";
import { deriveObservedClass, fromCalibrationOutcome, toCalibrationOutcome } from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { EvaluationRejectionReason } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

export function inspectScoredArtifact(
  artifact: ProspectiveScoredArtifact,
): EvaluationRejectionReason | null {
  if (!artifact.fixtureId?.trim() || !artifact.competitionId?.trim() || !artifact.kickoffUtc?.trim()) {
    return "INVALID_FIXTURE_IDENTITY";
  }
  if (artifact.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    return "WRONG_FINGERPRINT";
  }

  const scores = artifact.candidateScores ?? [];
  const ids = scores.map((row) => row.candidateId);
  if (new Set(ids).size !== ids.length) {
    return "DUPLICATE_ARM";
  }
  for (const id of ids) {
    if (!(PROSPECTIVE_CANDIDATE_IDS as readonly string[]).includes(id)) {
      return "UNKNOWN_ARM";
    }
  }
  for (const expected of PROSPECTIVE_CANDIDATE_IDS) {
    if (!ids.includes(expected)) {
      return "MISSING_ARM";
    }
  }
  if (scores.length !== PROSPECTIVE_CANDIDATE_IDS.length) {
    return "INCOMPLETE_SCORE_ROWS";
  }

  try {
    assertScoredArtifactIntegrity(artifact);
  } catch {
    return "TAMPERED_ARTIFACT";
  }

  const derived = deriveObservedClass(artifact.homeGoals, artifact.awayGoals);
  if (derived !== artifact.observedClass) {
    return "INCONSISTENT_OBSERVED_CLASS";
  }

  for (const row of scores) {
    if (row.observedClass !== artifact.observedClass) {
      return "INCONSISTENT_OBSERVED_CLASS";
    }
    const predicted = {
      home: row.homeProbability,
      draw: row.drawProbability,
      away: row.awayProbability,
    };
    if (!isValidOneXTwo(predicted)) {
      return "INVALID_PROBABILITY";
    }
    const finite = [
      row.logLossContribution,
      row.brierContribution,
      row.confidence,
      row.probabilityAssignedToObservedClass,
    ];
    if (!finite.every((value) => Number.isFinite(value))) {
      return "NON_FINITE_METRIC";
    }
    const actual = toCalibrationOutcome(row.observedClass);
    const predictedClass = fromCalibrationOutcome(argmaxOutcome(predicted));
    if (row.predictedClass !== predictedClass || row.isCorrect !== (predictedClass === row.observedClass)) {
      return "SCORE_RESULT_MISMATCH";
    }
    if (row.logLossContribution !== logLossOneXTwo(predicted, actual)) {
      return "SCORE_RESULT_MISMATCH";
    }
    if (row.brierContribution !== brierOneXTwo(predicted, actual)) {
      return "SCORE_RESULT_MISMATCH";
    }
  }
  return null;
}
