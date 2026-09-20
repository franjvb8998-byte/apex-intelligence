/**
 * Per-candidate aggregates. N is fixture count. Frozen candidate order only.
 */

import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { sortCandidateScores } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import type { ProspectiveCandidateId } from "@/lib/debug/calibration/prospective/candidate-types";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { CandidateAggregate } from "@/lib/debug/calibration/prospective/evaluation/evaluation-types";

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function emptyCandidateAggregate(candidateId: ProspectiveCandidateId): CandidateAggregate {
  return {
    candidateId,
    evaluatedN: 0,
    meanLogLoss: 0,
    meanBrier: 0,
    accuracy: 0,
    meanConfidence: 0,
    numberCorrect: 0,
    numberEvaluated: 0,
  };
}

export function aggregateCandidates(
  artifacts: readonly ProspectiveScoredArtifact[],
): CandidateAggregate[] {
  return PROSPECTIVE_CANDIDATE_IDS.map((candidateId) => {
    const rows = artifacts.map((artifact) => {
      const sorted = sortCandidateScores(artifact.candidateScores);
      const row = sorted.find((item) => item.candidateId === candidateId);
      if (!row) {
        throw new Error(`missing candidate row ${candidateId} after integrity`);
      }
      return row;
    });
    const n = rows.length;
    if (n === 0) return emptyCandidateAggregate(candidateId);
    const numberCorrect = rows.filter((row) => row.isCorrect).length;
    const meanLogLoss = rows.reduce((sum, row) => sum + row.logLossContribution, 0) / n;
    const meanBrier = rows.reduce((sum, row) => sum + row.brierContribution, 0) / n;
    const meanConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / n;
    return {
      candidateId,
      evaluatedN: n,
      meanLogLoss: finiteOrZero(meanLogLoss),
      meanBrier: finiteOrZero(meanBrier),
      accuracy: finiteOrZero(numberCorrect / n),
      meanConfidence: finiteOrZero(meanConfidence),
      numberCorrect,
      numberEvaluated: n,
    };
  });
}
