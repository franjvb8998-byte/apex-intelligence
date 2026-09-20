/**
 * Deterministic scored-artifact hashes. Does not change 5C.2 pending hash semantics.
 */

import { sha256Canonical } from "@/lib/debug/calibration/prospective/capture/capture-manifest";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import type {
  CandidateScoreRow,
  ProspectiveFinalOutcome,
  ProspectiveScoredArtifact,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function sortCandidateScores(rows: readonly CandidateScoreRow[]): CandidateScoreRow[] {
  return [...rows].sort(
    (left, right) =>
      PROSPECTIVE_CANDIDATE_IDS.indexOf(left.candidateId) - PROSPECTIVE_CANDIDATE_IDS.indexOf(right.candidateId),
  );
}

export function hashOutcome(outcome: ProspectiveFinalOutcome): string {
  return sha256Canonical({
    fixtureId: outcome.fixtureId,
    competitionId: outcome.competitionId,
    season: outcome.season,
    kickoffUtc: outcome.kickoffUtc,
    finalStatus: outcome.finalStatus,
    homeGoals: outcome.homeGoals,
    awayGoals: outcome.awayGoals,
    outcomeCapturedAt: outcome.outcomeCapturedAt,
    provenance: outcome.provenance,
  });
}

export function hashCandidateScores(rows: readonly CandidateScoreRow[]): string {
  return sha256Canonical(sortCandidateScores(rows));
}

export function hashScoredArtifact(artifact: Omit<ProspectiveScoredArtifact, "scoredArtifactHash">): string {
  return sha256Canonical(artifact);
}

export function verifyScoredHashes(artifact: ProspectiveScoredArtifact): void {
  const outcomeHash = hashOutcome({
    fixtureId: artifact.fixtureId,
    competitionId: artifact.competitionId,
    season: artifact.season,
    kickoffUtc: artifact.kickoffUtc,
    finalStatus: artifact.finalStatus,
    homeGoals: artifact.homeGoals,
    awayGoals: artifact.awayGoals,
    outcomeCapturedAt: artifact.outcomeCapturedAt,
    provenance: "synthetic",
  });
  if (outcomeHash !== artifact.outcomeHash) {
    throw new Error("outcomeHash verification failed");
  }
  if (hashCandidateScores(artifact.candidateScores) !== artifact.candidateScoresHash) {
    throw new Error("candidateScoresHash verification failed");
  }
  const material: Omit<ProspectiveScoredArtifact, "scoredArtifactHash"> = {
    scoringVersion: artifact.scoringVersion,
    scoredAt: artifact.scoredAt,
    sourceBatchId: artifact.sourceBatchId,
    sourceBatchHash: artifact.sourceBatchHash,
    sourceRecordsHash: artifact.sourceRecordsHash,
    sourceEvidenceManifestHash: artifact.sourceEvidenceManifestHash,
    candidateFingerprint: artifact.candidateFingerprint,
    fixtureId: artifact.fixtureId,
    competitionId: artifact.competitionId,
    season: artifact.season,
    kickoffUtc: artifact.kickoffUtc,
    finalStatus: artifact.finalStatus,
    homeGoals: artifact.homeGoals,
    awayGoals: artifact.awayGoals,
    observedClass: artifact.observedClass,
    outcomeCapturedAt: artifact.outcomeCapturedAt,
    candidateScores: artifact.candidateScores,
    outcomeHash: artifact.outcomeHash,
    candidateScoresHash: artifact.candidateScoresHash,
  };
  if (hashScoredArtifact(material) !== artifact.scoredArtifactHash) {
    throw new Error("scoredArtifactHash verification failed");
  }
}
