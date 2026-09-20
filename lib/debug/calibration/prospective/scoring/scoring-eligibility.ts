/**
 * Scoring eligibility and leakage guards. Does not mutate pending artifacts.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import { assertCaptureBatchIntegrity } from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import type { ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { utcMillis } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
import { assertValidFinalOutcome } from "@/lib/debug/calibration/prospective/scoring/scoring-outcome";
import {
  ScoringRejectedError,
  emptyScoringReport,
  type ProspectiveFinalOutcome,
} from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function assertPendingUnscored(batch: ProspectiveCaptureBatch, fixtureId: string): void {
  const records = batch.records.filter((row) => row.fixtureId === fixtureId);
  for (const record of records) {
    if (record.resultStatus !== "PENDING") {
      throw new ScoringRejectedError(
        "pending source must remain PENDING; target result cannot be embedded",
        emptyScoringReport({ fixtureId, sourceBatchId: batch.batchId }),
      );
    }
    if (record.finalHomeGoals != null || record.finalAwayGoals != null || record.scoredAt != null) {
      throw new ScoringRejectedError(
        "pending source cannot contain a target result",
        emptyScoringReport({ fixtureId, sourceBatchId: batch.batchId }),
      );
    }
  }
}

export function selectFixtureRecords(batch: ProspectiveCaptureBatch, fixtureId: string) {
  return batch.records.filter((row) => row.fixtureId === fixtureId);
}

export function assertScoringEligible(input: {
  batch: ProspectiveCaptureBatch;
  outcome: ProspectiveFinalOutcome;
  scoredAt: string;
}): void {
  assertValidFinalOutcome(input.outcome);
  const records = selectFixtureRecords(input.batch, input.outcome.fixtureId);
  if (records.length === 0) {
    throw new ScoringRejectedError(
      "fixtureId mismatch",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId, sourceBatchId: input.batch.batchId }),
    );
  }
  if (records.length !== 5) {
    throw new ScoringRejectedError(
      "fewer than five candidate arms rejected",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId, sourceBatchId: input.batch.batchId }),
    );
  }
  const ids = records.map((row) => row.candidateId);
  if (new Set(ids).size !== 5) {
    throw new ScoringRejectedError(
      "duplicate candidate arm rejected",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
    );
  }
  for (const id of ids) {
    if (!(PROSPECTIVE_CANDIDATE_IDS as readonly string[]).includes(id)) {
      throw new ScoringRejectedError(
        "unknown candidate rejected",
        emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
      );
    }
  }
  for (const expected of PROSPECTIVE_CANDIDATE_IDS) {
    if (!ids.includes(expected)) {
      throw new ScoringRejectedError(
        "unknown candidate rejected",
        emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
      );
    }
  }

  const first = records[0]!;
  if (first.kickoff !== input.outcome.kickoffUtc) {
    throw new ScoringRejectedError(
      "kickoff mismatch",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
    );
  }
  if (first.competitionId !== input.outcome.competitionId) {
    throw new ScoringRejectedError(
      "competition mismatch",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
    );
  }
  if (first.season !== input.outcome.season) {
    throw new ScoringRejectedError(
      "season mismatch",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
    );
  }

  const kickoffMs = utcMillis(first.kickoff, "kickoff");
  const scoredMs = utcMillis(input.scoredAt, "scoredAt");
  const outcomeMs = utcMillis(input.outcome.outcomeCapturedAt, "outcomeCapturedAt");
  if (!(scoredMs > kickoffMs)) {
    throw new ScoringRejectedError(
      scoredMs === kickoffMs ? "scoring at kickoff rejected" : "future fixture rejected",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId, kickoffUtc: first.kickoff }),
    );
  }
  if (!(outcomeMs > kickoffMs)) {
    throw new ScoringRejectedError(
      "outcomeCapturedAt must be after kickoff",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId }),
    );
  }

  if (input.batch.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new ScoringRejectedError(
      "wrong candidate fingerprint",
      emptyScoringReport({ fixtureId: input.outcome.fixtureId, sourceBatchId: input.batch.batchId }),
    );
  }

  assertPendingUnscored(input.batch, input.outcome.fixtureId);

  try {
    assertCaptureBatchIntegrity(input.batch);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const mapped = /fingerprint/.test(message)
      ? "wrong fingerprint"
      : /recordsHash|batchHash|evidenceManifestHash|hash/.test(message)
        ? "tampered pending hash"
        : message;
    throw new ScoringRejectedError(
      mapped,
      emptyScoringReport({ fixtureId: input.outcome.fixtureId, sourceBatchId: input.batch.batchId }),
    );
  }
}
