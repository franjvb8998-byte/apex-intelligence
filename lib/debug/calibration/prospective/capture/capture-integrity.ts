/**
 * Capture-batch leakage, duplicate, and hash integrity. No scoring.
 */

import {
  CANDIDATE_MANIFEST_FINGERPRINT,
} from "@/lib/debug/calibration/prospective/candidate-config";
import {
  HistoricalFirewallError,
  ProspectiveIntegrityError,
  assertManifestFingerprint,
  assertNotUsedHistoricalSeason,
  assertUnscoredRecord,
} from "@/lib/debug/calibration/prospective/candidate-integrity";
import {
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CANDIDATE_VERSION,
  type ProspectiveCandidateId,
  type ProspectivePredictionRecord,
} from "@/lib/debug/calibration/prospective/candidate-types";
import {
  assertFrozenFingerprint,
  deriveBatchId,
  hashBatchMaterial,
  hashEvidenceManifest,
  hashRecords,
} from "@/lib/debug/calibration/prospective/capture/capture-manifest";
import type {
  PriorCaptureIndex,
  ProspectiveCaptureBatch,
  ProspectiveEvidenceSnapshot,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

export function assertExactlyFiveRecordsPerFixture(
  records: readonly ProspectivePredictionRecord[],
  fixtureId: string,
): void {
  const forFixture = records.filter((record) => record.fixtureId === fixtureId);
  if (forFixture.length !== 5) {
    throw new ProspectiveIntegrityError(
      `fixture ${fixtureId} must have exactly five records, got ${forFixture.length}`,
    );
  }
}

export function assertExactCandidateIds(records: readonly ProspectivePredictionRecord[]): void {
  const ids = records.map((record) => record.candidateId);
  if (ids.length !== 5) {
    throw new ProspectiveIntegrityError(`expected exactly five candidate IDs, got ${ids.length}`);
  }
  if (new Set(ids).size !== 5) {
    throw new ProspectiveIntegrityError("duplicate candidate in one fixture capture");
  }
  for (const expected of PROSPECTIVE_CANDIDATE_IDS) {
    if (!ids.includes(expected)) {
      throw new ProspectiveIntegrityError(`missing frozen candidate ${expected}`);
    }
  }
}

export function assertCrossCandidateConsistency(
  records: readonly ProspectivePredictionRecord[],
  snapshot: ProspectiveEvidenceSnapshot,
): void {
  const first = records[0];
  if (!first) {
    throw new ProspectiveIntegrityError("fixture capture produced no records");
  }
  for (const record of records) {
    if (record.kickoff !== first.kickoff) {
      throw new ProspectiveIntegrityError("cross-candidate kickoff mismatch");
    }
    if (record.capturedAt !== first.capturedAt) {
      throw new ProspectiveIntegrityError("cross-candidate capturedAt mismatch");
    }
    if (record.competitionId !== first.competitionId) {
      throw new ProspectiveIntegrityError("cross-candidate competitionId mismatch");
    }
    if (record.season !== first.season) {
      throw new ProspectiveIntegrityError("cross-candidate season mismatch");
    }
    if (record.candidateVersion !== first.candidateVersion) {
      throw new ProspectiveIntegrityError("cross-candidate candidateVersion mismatch");
    }
    if (record.candidateFingerprint !== first.candidateFingerprint) {
      throw new ProspectiveIntegrityError("cross-candidate candidateFingerprint mismatch");
    }
    if (record.inputEvidenceCounts.homePlayedBefore !== snapshot.home.matchesPlayed) {
      throw new ProspectiveIntegrityError("evidence count homePlayedBefore mismatch");
    }
    if (record.inputEvidenceCounts.awayPlayedBefore !== snapshot.away.matchesPlayed) {
      throw new ProspectiveIntegrityError("evidence count awayPlayedBefore mismatch");
    }
    if (record.inputEvidenceCounts.homePlayedBefore !== first.inputEvidenceCounts.homePlayedBefore) {
      throw new ProspectiveIntegrityError("cross-candidate home evidence count mismatch");
    }
    if (record.inputEvidenceCounts.awayPlayedBefore !== first.inputEvidenceCounts.awayPlayedBefore) {
      throw new ProspectiveIntegrityError("cross-candidate away evidence count mismatch");
    }
    if (record.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
      throw new ProspectiveIntegrityError("wrong candidate fingerprint");
    }
    if (record.candidateVersion !== "5c1.v1") {
      throw new ProspectiveIntegrityError("wrong candidate version on record");
    }
    assertUnscoredRecord(record);
    assertNotUsedHistoricalSeason(record.season);
  }
}

export function assertNoPriorFixtureCapture(
  index: PriorCaptureIndex | undefined,
  fixtureId: string,
  fingerprint: string,
): void {
  if (!index) return;
  const hit = index.entries.find(
    (entry) => entry.fixtureId === fixtureId && entry.candidateFingerprint === fingerprint,
  );
  if (hit) {
    throw new ProspectiveIntegrityError(
      `fixture ${fixtureId} already captured under fingerprint ${fingerprint} in batch ${hit.batchId}`,
    );
  }
}

export function assertBatchCounts(batch: ProspectiveCaptureBatch): void {
  if (batch.recordCount !== batch.fixtureCount * 5) {
    throw new ProspectiveIntegrityError("recordCount must equal fixtureCount * 5");
  }
  if (batch.records.length !== batch.recordCount) {
    throw new ProspectiveIntegrityError("records length must equal recordCount");
  }
  if (batch.fixtureIds.length !== batch.fixtureCount) {
    throw new ProspectiveIntegrityError("fixtureIds length must equal fixtureCount");
  }
  if (batch.candidateVersion !== PROSPECTIVE_CANDIDATE_VERSION) {
    throw new ProspectiveIntegrityError("batch candidateVersion must remain the frozen 5C.1 version");
  }
  assertFrozenFingerprint(batch.candidateFingerprint);
  assertManifestFingerprint(batch.candidateFingerprint);
}

export function verifyBatchHashes(batch: ProspectiveCaptureBatch): void {
  const recordsHash = hashRecords(batch.records);
  const evidenceManifestHash = hashEvidenceManifest(batch.evidenceSnapshots);
  if (recordsHash !== batch.recordsHash) {
    throw new ProspectiveIntegrityError("recordsHash mismatch");
  }
  if (evidenceManifestHash !== batch.evidenceManifestHash) {
    throw new ProspectiveIntegrityError("evidenceManifestHash mismatch");
  }
  const expectedId = deriveBatchId({
    candidateFingerprint: batch.candidateFingerprint,
    createdAt: batch.createdAt,
    fixtureIds: batch.fixtureIds,
    recordsHash,
  });
  if (expectedId !== batch.batchId) {
    throw new ProspectiveIntegrityError("batchId mismatch");
  }
  const batchHash = hashBatchMaterial({
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    candidateVersion: batch.candidateVersion,
    candidateFingerprint: batch.candidateFingerprint,
    fixtureCount: batch.fixtureCount,
    recordCount: batch.recordCount,
    fixtureIds: batch.fixtureIds,
    fixtures: batch.fixtures,
    records: batch.records,
    evidenceSnapshots: batch.evidenceSnapshots,
    evidenceManifestHash,
    recordsHash,
  });
  if (batchHash !== batch.batchHash) {
    throw new ProspectiveIntegrityError("batchHash mismatch");
  }
}

export function assertUniqueFixtureCandidateRecords(
  records: readonly ProspectivePredictionRecord[],
): void {
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.fixtureId}::${record.candidateId}`;
    if (seen.has(key)) {
      throw new ProspectiveIntegrityError(`duplicate fixture/candidate ${key}`);
    }
    seen.add(key);
  }
}

export function groupRecordsByFixture(
  records: readonly ProspectivePredictionRecord[],
): Map<string, ProspectivePredictionRecord[]> {
  const groups = new Map<string, ProspectivePredictionRecord[]>();
  for (const record of records) {
    const existing = groups.get(record.fixtureId) ?? [];
    existing.push(record);
    groups.set(record.fixtureId, existing);
  }
  return groups;
}

export function assertCaptureBatchIntegrity(
  batch: ProspectiveCaptureBatch,
  priorIndex?: PriorCaptureIndex,
): void {
  assertBatchCounts(batch);
  assertUniqueFixtureCandidateRecords(batch.records);
  const groups = groupRecordsByFixture(batch.records);
  for (const fixtureId of batch.fixtureIds) {
    const records = groups.get(fixtureId);
    if (!records) {
      throw new ProspectiveIntegrityError(`missing records for ${fixtureId}`);
    }
    assertExactlyFiveRecordsPerFixture(batch.records, fixtureId);
    assertExactCandidateIds(records);
    const snapshot = batch.evidenceSnapshots.find((row) => row.fixtureId === fixtureId);
    if (!snapshot) {
      throw new ProspectiveIntegrityError(`missing evidence snapshot for ${fixtureId}`);
    }
    assertCrossCandidateConsistency(records, snapshot);
    assertNoPriorFixtureCapture(priorIndex, fixtureId, batch.candidateFingerprint);
  }
  verifyBatchHashes(batch);
}

export function rejectUsedHistoricalSeason(season: string): void {
  if ((["2023", "2024", "2025"] as const).includes(season as "2023")) {
    throw new HistoricalFirewallError(
      `${season} is used 5B investigation data and cannot enter prospective capture`,
    );
  }
}

export type { ProspectiveCandidateId };
