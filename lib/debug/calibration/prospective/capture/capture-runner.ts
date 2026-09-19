/**
 * Five-arm prospective capture runner. Dry-run by default. No scoring.
 */

import {
  CANDIDATE_MANIFEST_FINGERPRINT,
} from "@/lib/debug/calibration/prospective/candidate-config";
import { capturePrediction } from "@/lib/debug/calibration/prospective/candidate-record";
import {
  ProspectiveIntegrityError,
  compareSameKickoff,
} from "@/lib/debug/calibration/prospective/candidate-integrity";
import {
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CANDIDATE_VERSION,
  type ProspectivePredictionRecord,
} from "@/lib/debug/calibration/prospective/candidate-types";
import { assertIsoTimestamp } from "@/lib/debug/calibration/prospective/capture/capture-clock";
import {
  assertEligibleFixture,
  assertUniqueInputFixtures,
} from "@/lib/debug/calibration/prospective/capture/capture-eligibility";
import {
  createEvidenceSnapshot,
  evidenceFromSnapshot,
} from "@/lib/debug/calibration/prospective/capture/capture-evidence";
import {
  assertCaptureBatchIntegrity,
} from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import {
  deriveBatchId,
  hashBatchMaterial,
  hashEvidenceManifest,
  hashRecords,
} from "@/lib/debug/calibration/prospective/capture/capture-manifest";
import {
  findPriorFixtureCapture,
  loadPriorCaptureIndex,
  persistPendingBatch,
} from "@/lib/debug/calibration/prospective/capture/capture-persist";
import { buildCaptureReport } from "@/lib/debug/calibration/prospective/capture/capture-report";
import type {
  CaptureOptions,
  CaptureRunResult,
  CapturedFixtureHeader,
  ProspectiveCaptureBatch,
  ProspectiveEvidenceSnapshot,
  ProspectiveFixtureInput,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

function candidateOrder(id: string): number {
  return PROSPECTIVE_CANDIDATE_IDS.indexOf(id as (typeof PROSPECTIVE_CANDIDATE_IDS)[number]);
}

function sortRecords(records: ProspectivePredictionRecord[]): ProspectivePredictionRecord[] {
  return [...records].sort((left, right) => {
    const kickoff = compareSameKickoff(left, right);
    if (kickoff !== 0) return kickoff;
    return candidateOrder(left.candidateId) - candidateOrder(right.candidateId);
  });
}

function sortSnapshots(
  snapshots: ProspectiveEvidenceSnapshot[],
  headers: CapturedFixtureHeader[],
): ProspectiveEvidenceSnapshot[] {
  const order = new Map(headers.map((row, index) => [row.fixtureId, index]));
  return [...snapshots].sort(
    (left, right) => (order.get(left.fixtureId) ?? 0) - (order.get(right.fixtureId) ?? 0),
  );
}

export function captureProspectiveBatch(
  fixtures: readonly ProspectiveFixtureInput[],
  options: CaptureOptions,
): CaptureRunResult {
  const dryRun = options.dryRun !== false;
  const capturedAt = options.capturedAt ?? options.clock.now();
  const createdAt = options.createdAt ?? options.clock.now();
  assertIsoTimestamp(capturedAt, "capturedAt");
  assertIsoTimestamp(createdAt, "createdAt");
  assertUniqueInputFixtures(fixtures);

  const priorIndex = options.priorIndex ?? (dryRun ? { entries: [] } : loadPriorCaptureIndex(options.persistRoot));
  const seen = new Set<string>();
  const records: ProspectivePredictionRecord[] = [];
  const snapshots: ProspectiveEvidenceSnapshot[] = [];
  const headers: CapturedFixtureHeader[] = [];

  const ordered = [...fixtures].sort(compareSameKickoff);
  for (const fixture of ordered) {
    assertEligibleFixture(fixture, capturedAt, options.window);
    const prior = findPriorFixtureCapture(priorIndex, fixture.fixtureId, CANDIDATE_MANIFEST_FINGERPRINT);
    if (prior) {
      throw new ProspectiveIntegrityError(
        `fixture ${fixture.fixtureId} already captured under fingerprint ${prior.candidateFingerprint} in batch ${prior.batchId}`,
      );
    }
    const snapshot = createEvidenceSnapshot(fixture, capturedAt);
    const evidence = evidenceFromSnapshot(fixture, snapshot);
    const odds = fixture.oddsSnapshot
      ? {
          home: fixture.oddsSnapshot.home,
          draw: fixture.oddsSnapshot.draw,
          away: fixture.oddsSnapshot.away,
        }
      : null;
    for (const candidateId of PROSPECTIVE_CANDIDATE_IDS) {
      records.push(
        capturePrediction(
          {
            evidence,
            capturedAt,
            candidateId,
            odds,
          },
          seen,
        ),
      );
    }
    snapshots.push(snapshot);
    headers.push({
      fixtureId: fixture.fixtureId,
      homeTeamName: fixture.homeTeamName,
      awayTeamName: fixture.awayTeamName,
      kickoff: fixture.kickoff,
      capturedAt,
      evidenceAsOf: fixture.evidenceAsOf,
      oddsPresent: fixture.oddsSnapshot != null,
    });
  }

  const sortedRecords = sortRecords(records);
  const sortedHeaders = [...headers].sort(compareSameKickoff);
  const sortedSnapshots = sortSnapshots(snapshots, sortedHeaders);
  const fixtureIds = sortedHeaders.map((row) => row.fixtureId);
  const recordsHash = hashRecords(sortedRecords);
  const evidenceManifestHash = hashEvidenceManifest(sortedSnapshots);
  const batchId = deriveBatchId({
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    createdAt,
    fixtureIds,
    recordsHash,
  });
  const batchMaterial = {
    batchId,
    createdAt,
    candidateVersion: PROSPECTIVE_CANDIDATE_VERSION,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    fixtureCount: fixtureIds.length,
    recordCount: sortedRecords.length,
    fixtureIds,
    fixtures: sortedHeaders,
    records: sortedRecords,
    evidenceSnapshots: sortedSnapshots,
    evidenceManifestHash,
    recordsHash,
  };
  const batch: ProspectiveCaptureBatch = {
    ...batchMaterial,
    batchHash: hashBatchMaterial(batchMaterial),
  };

  assertCaptureBatchIntegrity(batch, dryRun ? undefined : priorIndex);
  const report = buildCaptureReport(batch);
  if (dryRun) {
    return { dryRun: true, batch, report, persisted: null };
  }

  const persisted = persistPendingBatch({
    batch,
    persistRoot: options.persistRoot,
    simulateFailureAfterTempWrite: options.simulateFailureAfterTempWrite,
  });
  return { dryRun: false, batch, report, persisted };
}
