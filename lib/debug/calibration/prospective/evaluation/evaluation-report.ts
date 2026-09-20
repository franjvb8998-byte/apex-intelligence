/**
 * Neutral evaluation report. Frozen candidate order. No winner/ranking/promotion.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { LIVE_PROTOCOL_FINGERPRINT } from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";
import { sortCandidateScores } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import { aggregateCandidates } from "@/lib/debug/calibration/prospective/evaluation/evaluation-aggregate";
import {
  evaluationCheckpointState,
  formalReviewAvailable,
} from "@/lib/debug/calibration/prospective/evaluation/evaluation-checkpoint";
import { classwiseCalibration } from "@/lib/debug/calibration/prospective/evaluation/evaluation-classwise";
import { eceReportsForCandidates } from "@/lib/debug/calibration/prospective/evaluation/evaluation-ece";
import { hashEvaluationReport } from "@/lib/debug/calibration/prospective/evaluation/evaluation-hash";
import {
  PROSPECTIVE_EVALUATION_PHASE,
  PROSPECTIVE_EVALUATION_VERSION,
  ZERO_EVALUATION_PROVIDER_CALLS,
  emptyEvaluationReport,
  type CandidateFixtureObservation,
  type EvaluationMode,
  type EvaluationRejection,
  type ProspectiveEvaluationReport,
} from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

function sortArtifacts(artifacts: readonly ProspectiveScoredArtifact[]): ProspectiveScoredArtifact[] {
  return [...artifacts].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
}

function extrema(values: readonly string[]): { first: string; last: string } {
  if (values.length === 0) return { first: "", last: "" };
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  return { first: sorted[0] ?? "", last: sorted[sorted.length - 1] ?? "" };
}

export function observationsFromArtifacts(
  artifacts: readonly ProspectiveScoredArtifact[],
): CandidateFixtureObservation[] {
  return sortArtifacts(artifacts).flatMap((artifact) =>
    sortCandidateScores(artifact.candidateScores).map((row) => ({
      fixtureId: artifact.fixtureId,
      candidateId: row.candidateId,
      logLoss: row.logLossContribution,
      brier: row.brierContribution,
      isCorrect: row.isCorrect,
      confidence: row.confidence,
      observedClass: row.observedClass,
    })),
  );
}

export function buildEvaluationReport(input: {
  artifacts: readonly ProspectiveScoredArtifact[];
  mode: EvaluationMode;
  rejections: readonly EvaluationRejection[];
  integrityStatus: ProspectiveEvaluationReport["integrityStatus"];
}): ProspectiveEvaluationReport {
  const artifacts = sortArtifacts(input.artifacts);
  const evaluatedN = artifacts.length;
  const scored = extrema(artifacts.map((artifact) => artifact.scoredAt));
  const kickoff = extrema(artifacts.map((artifact) => artifact.kickoffUtc));
  const unsigned = emptyEvaluationReport({
    evaluationVersion: PROSPECTIVE_EVALUATION_VERSION,
    phase: PROSPECTIVE_EVALUATION_PHASE,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    protocolFingerprint: LIVE_PROTOCOL_FINGERPRINT,
    evaluatedN,
    fixtureCount: evaluatedN,
    candidateRowCount: evaluatedN * PROSPECTIVE_CANDIDATE_IDS.length,
    checkpointState: evaluationCheckpointState(evaluatedN),
    formalReviewAvailable: formalReviewAvailable(evaluatedN),
    firstScoredAt: scored.first,
    lastScoredAt: scored.last,
    firstKickoffUtc: kickoff.first,
    lastKickoffUtc: kickoff.last,
    observedHomeCount: artifacts.filter((artifact) => artifact.observedClass === "HOME").length,
    observedDrawCount: artifacts.filter((artifact) => artifact.observedClass === "DRAW").length,
    observedAwayCount: artifacts.filter((artifact) => artifact.observedClass === "AWAY").length,
    integrityStatus: input.integrityStatus,
    rejectionPolicy: input.mode,
    rejectedCount: input.rejections.length,
    rejections: [...input.rejections].sort((left, right) => {
      const byId = left.fixtureId.localeCompare(right.fixtureId);
      return byId !== 0 ? byId : left.reason.localeCompare(right.reason);
    }),
    candidateAggregates: aggregateCandidates(artifacts),
    classwiseCalibration: classwiseCalibration(artifacts),
    eceReports: eceReportsForCandidates(artifacts),
    providerCallAccounting: { ...ZERO_EVALUATION_PROVIDER_CALLS },
  });
  return {
    ...unsigned,
    evaluationHash: hashEvaluationReport(unsigned),
  };
}
