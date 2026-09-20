/**
 * Safe scoring report. No ranking, winner, stake, or selection fields.
 */

import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { emptyScoringCallAccounting } from "@/lib/debug/calibration/prospective/scoring/scoring-accounting";
import { probabilitiesMatchSource } from "@/lib/debug/calibration/prospective/scoring/scoring-metrics";
import type { ProspectivePredictionRecord } from "@/lib/debug/calibration/prospective/candidate-types";
import type {
  ProspectiveScoredArtifact,
  ScoringPersistenceDisposition,
  ScoringReport,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function buildScoringReport(input: {
  artifact?: ProspectiveScoredArtifact | null;
  sourceRecords?: readonly ProspectivePredictionRecord[];
  capturedNBefore: number;
  capturedNAfter: number;
  scoredNBefore: number;
  scoredNAfter: number;
  persistenceDisposition: ScoringPersistenceDisposition;
  sourceIntegrityVerified?: boolean;
  candidateFingerprintVerified?: boolean;
}): ScoringReport {
  const artifact = input.artifact ?? null;
  const candidateLogLoss: Record<string, number> = {};
  const candidateBrier: Record<string, number> = {};
  const candidateIsCorrect: Record<string, boolean> = {};
  let probabilitiesUnchanged = true;
  if (artifact) {
    for (const row of artifact.candidateScores) {
      candidateLogLoss[row.candidateId] = row.logLossContribution;
      candidateBrier[row.candidateId] = row.brierContribution;
      candidateIsCorrect[row.candidateId] = row.isCorrect;
      const source = input.sourceRecords?.find((record) => record.candidateId === row.candidateId);
      if (source && !probabilitiesMatchSource(row, source)) probabilitiesUnchanged = false;
    }
  }
  return {
    fixtureId: artifact?.fixtureId ?? "",
    competitionId: artifact?.competitionId ?? "",
    season: artifact?.season ?? "",
    kickoffUtc: artifact?.kickoffUtc ?? "",
    sourceBatchId: artifact?.sourceBatchId ?? "",
    sourceIntegrityVerified: input.sourceIntegrityVerified ?? Boolean(artifact),
    candidateFingerprintVerified: input.candidateFingerprintVerified ?? Boolean(artifact),
    finalStatus: artifact?.finalStatus ?? "",
    homeGoals: artifact?.homeGoals ?? null,
    awayGoals: artifact?.awayGoals ?? null,
    observedClass: artifact?.observedClass ?? "",
    outcomeCapturedAt: artifact?.outcomeCapturedAt ?? "",
    scoredAt: artifact?.scoredAt ?? "",
    candidateCount: artifact?.candidateScores.length ?? 0,
    candidateIds: artifact ? artifact.candidateScores.map((row) => row.candidateId) : [...PROSPECTIVE_CANDIDATE_IDS],
    probabilitiesUnchanged,
    candidateLogLoss,
    candidateBrier,
    candidateIsCorrect,
    outcomeHash: artifact?.outcomeHash ?? "",
    candidateScoresHash: artifact?.candidateScoresHash ?? "",
    scoredArtifactHash: artifact?.scoredArtifactHash ?? "",
    capturedNBefore: input.capturedNBefore,
    capturedNAfter: input.capturedNAfter,
    scoredNBefore: input.scoredNBefore,
    scoredNAfter: input.scoredNAfter,
    persistenceDisposition: input.persistenceDisposition,
    providerCallAccounting: emptyScoringCallAccounting(),
  };
}
