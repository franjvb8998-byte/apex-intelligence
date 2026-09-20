/**
 * Offline prospective scoring runner. Writes a separate scored artifact. Never edits pending.
 */

import { existsSync } from "node:fs";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import {
  PROSPECTIVE_SCORING_PHASE,
  PROSPECTIVE_SCORING_VERSION,
  ScoringRejectedError,
  emptyScoringReport,
  type ProspectiveFinalOutcome,
  type ProspectiveScoredArtifact,
  type ScoreProspectiveRequest,
  type ScoreProspectiveResult,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import {
  countCapturedProspectiveN,
  countScoredProspectiveN,
} from "@/lib/debug/calibration/prospective/scoring/scoring-accounting";
import { assertScoringEligible, selectFixtureRecords } from "@/lib/debug/calibration/prospective/scoring/scoring-eligibility";
import {
  hashCandidateScores,
  hashOutcome,
  hashScoredArtifact,
  sortCandidateScores,
} from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import { scoreCandidateObservation } from "@/lib/debug/calibration/prospective/scoring/scoring-metrics";
import { deriveObservedClass } from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import {
  assertPendingBytesUnchanged,
  persistScoredArtifact,
  readPendingBytes,
  scoredArtifactPath,
} from "@/lib/debug/calibration/prospective/scoring/scoring-persist";
import { buildScoringReport } from "@/lib/debug/calibration/prospective/scoring/scoring-report";

function resolveOutcome(request: ScoreProspectiveRequest, fixtureId: string): ProspectiveFinalOutcome {
  const loaded = request.transport?.loadOutcome(fixtureId) ?? request.outcome;
  if (!loaded) {
    throw new ScoringRejectedError("synthetic outcome is required", emptyScoringReport({ fixtureId }));
  }
  return loaded;
}

function buildArtifact(input: {
  batch: ScoreProspectiveRequest["pendingBatch"];
  outcome: ProspectiveFinalOutcome;
  scoredAt: string;
}): ProspectiveScoredArtifact {
  const observedClass = deriveObservedClass(input.outcome.homeGoals, input.outcome.awayGoals);
  const records = selectFixtureRecords(input.batch, input.outcome.fixtureId);
  const candidateScores = sortCandidateScores(
    records.map((record) => scoreCandidateObservation(record, observedClass)),
  );
  const outcomeHash = hashOutcome(input.outcome);
  const candidateScoresHash = hashCandidateScores(candidateScores);
  const material = {
    scoringVersion: PROSPECTIVE_SCORING_VERSION as typeof PROSPECTIVE_SCORING_VERSION,
    scoredAt: input.scoredAt,
    sourceBatchId: input.batch.batchId,
    sourceBatchHash: input.batch.batchHash,
    sourceRecordsHash: input.batch.recordsHash,
    sourceEvidenceManifestHash: input.batch.evidenceManifestHash,
    candidateFingerprint: input.batch.candidateFingerprint,
    fixtureId: input.outcome.fixtureId,
    competitionId: input.outcome.competitionId,
    season: input.outcome.season,
    kickoffUtc: input.outcome.kickoffUtc,
    finalStatus: input.outcome.finalStatus,
    homeGoals: input.outcome.homeGoals,
    awayGoals: input.outcome.awayGoals,
    observedClass,
    outcomeCapturedAt: input.outcome.outcomeCapturedAt,
    candidateScores,
    outcomeHash,
    candidateScoresHash,
  };
  return {
    ...material,
    scoredArtifactHash: hashScoredArtifact(material),
  };
}

export function scoreProspectiveBatch(request: ScoreProspectiveRequest): ScoreProspectiveResult {
  const pendingBytes = request.pendingPath ? readPendingBytes(request.pendingPath) : null;
  const capturedBefore = countCapturedProspectiveN(request.persistRoot);
  const scoredBefore = countScoredProspectiveN(request.persistRoot);
  const scoredAt = request.scoredAt ?? request.clock.now();
  const fixtureHint = request.outcome?.fixtureId ?? request.pendingBatch.fixtureIds[0] ?? "";

  const finish = (
    artifact: ProspectiveScoredArtifact | null,
    disposition: ScoreProspectiveResult["report"]["persistenceDisposition"],
    scoredAfter = scoredBefore,
  ): ScoreProspectiveResult => {
    if (request.pendingPath && pendingBytes) {
      assertPendingBytesUnchanged(request.pendingPath, pendingBytes);
    }
    return {
      phase: PROSPECTIVE_SCORING_PHASE,
      artifact,
      report: buildScoringReport({
        artifact,
        sourceRecords: artifact
          ? selectFixtureRecords(request.pendingBatch, artifact.fixtureId)
          : undefined,
        capturedNBefore: capturedBefore,
        capturedNAfter: countCapturedProspectiveN(request.persistRoot),
        scoredNBefore: scoredBefore,
        scoredNAfter: scoredAfter,
        persistenceDisposition: disposition,
        sourceIntegrityVerified: artifact != null,
        candidateFingerprintVerified: request.pendingBatch.candidateFingerprint === CANDIDATE_MANIFEST_FINGERPRINT,
      }),
      pendingBytesUnchanged: true,
    };
  };

  try {
    const outcome = resolveOutcome(request, fixtureHint || request.outcome?.fixtureId || "");
    assertScoringEligible({ batch: request.pendingBatch, outcome, scoredAt });

    if (request.persist === true && !request.persistRoot) {
      throw new ScoringRejectedError(
        "persist requires an explicit persistRoot",
        emptyScoringReport({ fixtureId: outcome.fixtureId }),
      );
    }

    if (request.persistRoot) {
      const existing = scoredArtifactPath(request.persistRoot, request.pendingBatch.batchId, outcome.fixtureId);
      if (existsSync(existing)) {
        throw new ScoringRejectedError(
          "already scored",
          emptyScoringReport({
            fixtureId: outcome.fixtureId,
            sourceBatchId: request.pendingBatch.batchId,
            persistenceDisposition: "ALREADY_SCORED",
            capturedNBefore: capturedBefore,
            capturedNAfter: capturedBefore,
            scoredNBefore: scoredBefore,
            scoredNAfter: scoredBefore,
          }),
          "ALREADY_SCORED",
        );
      }
    }

    if (request.simulateScoringFailure === true) {
      throw new ScoringRejectedError(
        "simulated scoring failure",
        emptyScoringReport({ fixtureId: outcome.fixtureId, persistenceDisposition: "FAILED" }),
      );
    }

    const artifact = buildArtifact({ batch: request.pendingBatch, outcome, scoredAt });
    if (request.persist === true && request.persistRoot) {
      persistScoredArtifact({
        artifact,
        persistRoot: request.persistRoot,
        simulateFailureAfterTempWrite: request.simulatePersistenceFailure,
      });
      return finish(artifact, "PERSISTED", countScoredProspectiveN(request.persistRoot));
    }
    return finish(artifact, "NOT_WRITTEN", scoredBefore);
  } catch (error) {
    if (request.pendingPath && pendingBytes) {
      assertPendingBytesUnchanged(request.pendingPath, pendingBytes);
    }
    if (error instanceof ScoringRejectedError) {
      throw new ScoringRejectedError(
        error.message,
        {
          ...error.report,
          capturedNBefore: capturedBefore,
          capturedNAfter: countCapturedProspectiveN(request.persistRoot),
          scoredNBefore: scoredBefore,
          scoredNAfter: countScoredProspectiveN(request.persistRoot),
          providerCallAccounting: error.report.providerCallAccounting,
        },
        error.disposition,
      );
    }
    if (error instanceof ProspectiveIntegrityError) {
      throw new ScoringRejectedError(
        error.message,
        emptyScoringReport({
          fixtureId: fixtureHint,
          capturedNBefore: capturedBefore,
          capturedNAfter: capturedBefore,
          scoredNBefore: scoredBefore,
          scoredNAfter: scoredBefore,
        }),
      );
    }
    throw error;
  }
}
