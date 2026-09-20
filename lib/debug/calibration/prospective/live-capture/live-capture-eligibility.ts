/**
 * 5C.5A eligibility: compose 5C.3 planner + 5C.2 time/leakage guards. No competing rules.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import type { PriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { findPriorFixtureCapture } from "@/lib/debug/calibration/prospective/capture/capture-persist";
import {
  assertEligibleFixture,
  assertNoOutcomeLeakage,
} from "@/lib/debug/calibration/prospective/capture/capture-eligibility";
import { toProspectiveFixtureInput } from "@/lib/debug/calibration/prospective/live-capture/live-capture-evidence";
import {
  ACCEPTED_PROSPECTIVE_SEASON,
  EXTRA_LIVE_CAPTURE_LEAKAGE_KEYS,
  LiveCaptureRejectedError,
  type LiveCaptureFixtureInput,
  type LiveCaptureReadinessRow,
  type LiveCaptureRequest,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import { liveCaptureWindow } from "@/lib/debug/calibration/prospective/live-capture/live-capture-config";
import { planDiscoveredFixtures } from "@/lib/debug/calibration/prospective/protocol/protocol-planner";
import type { PlannerClassification } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import { PROSPECTIVE_COMPETITION_ID } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

const EXTRA_LEAKAGE = new Set<string>(EXTRA_LIVE_CAPTURE_LEAKAGE_KEYS.map((key) => key.toLowerCase()));

function assertExtraLeakage(value: unknown, path = "input"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertExtraLeakage(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (EXTRA_LEAKAGE.has(key.toLowerCase())) {
      throw new ProspectiveIntegrityError(`capture input cannot contain outcome field ${key} at ${path}`);
    }
    assertExtraLeakage(child, `${path}.${key}`);
  }
}

export function assertLiveCaptureInputContract(value: unknown): void {
  assertExtraLeakage(value);
  assertNoOutcomeLeakage(value);
}

function evidenceLooksReady(fixture: LiveCaptureFixtureInput): boolean {
  return Boolean(
    fixture.evidenceAsOf &&
      fixture.preMatchEvidence?.home?.teamId &&
      fixture.preMatchEvidence?.away?.teamId,
  );
}

export function classifyLiveCaptureFixtures(
  fixtures: readonly LiveCaptureFixtureInput[],
  capturedAt: string,
  priorIndex?: PriorCaptureIndex,
): PlannerClassification[] {
  const already = new Set<string>(
    (priorIndex?.entries ?? [])
      .filter((entry) => entry.candidateFingerprint === CANDIDATE_MANIFEST_FINGERPRINT)
      .map((entry) => entry.fixtureId),
  );
  return planDiscoveredFixtures(
    fixtures.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      competitionId: fixture.competitionId,
      season: fixture.season,
      kickoff: fixture.kickoffUtc,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      status: fixture.status,
      alreadyCaptured: already.has(fixture.fixtureId),
    })),
    { now: () => capturedAt },
    { season: ACCEPTED_PROSPECTIVE_SEASON, priorCapturedIds: already },
  );
}

export function assessLiveCaptureReadiness(request: LiveCaptureRequest): LiveCaptureReadinessRow[] {
  assertLiveCaptureInputContract(request);
  const capturedAt = request.capturedAt ?? request.clock.now();
  const classifications = classifyLiveCaptureFixtures(request.fixtures, capturedAt, request.priorIndex);
  const byId = new Map(request.fixtures.map((row) => [row.fixtureId, row]));
  return classifications.map((row) => {
    const fixture = byId.get(row.fixtureId);
    const duplicate = row.disposition === "DUPLICATE";
    const evidenceReady = fixture ? evidenceLooksReady(fixture) : false;
    let captureEligible = row.disposition === "IN_WINDOW" && evidenceReady && !duplicate;
    let reason = row.reason;
    if (captureEligible && fixture) {
      try {
        assertEligibleFixture(toProspectiveFixtureInput(fixture), capturedAt, liveCaptureWindow());
        if (request.priorIndex) {
          const prior = findPriorFixtureCapture(
            request.priorIndex,
            fixture.fixtureId,
            CANDIDATE_MANIFEST_FINGERPRINT,
          );
          if (prior) {
            captureEligible = false;
            reason = `already captured under fingerprint ${prior.candidateFingerprint} in batch ${prior.batchId}`;
          }
        }
      } catch (error) {
        captureEligible = false;
        reason = error instanceof Error ? error.message : String(error);
      }
    }
    return {
      fixtureId: row.fixtureId,
      kickoff: row.kickoffUtc ?? fixture?.kickoffUtc ?? "",
      minutesToKickoff: row.minutesBeforeKickoff,
      protocolClassification: row.disposition,
      captureEligible,
      evidenceReady,
      oddsPresent: fixture?.oddsSnapshot != null,
      fiveArmReady: captureEligible,
      duplicate,
      persistenceReady: captureEligible,
      reason,
    };
  });
}

export function assertAllFixturesEligible(request: LiveCaptureRequest): PlannerClassification[] {
  if (request.fixtures.length === 0) {
    throw new LiveCaptureRejectedError("live capture requires at least one fixture");
  }
  const classifications = classifyLiveCaptureFixtures(
    request.fixtures,
    request.capturedAt ?? request.clock.now(),
    request.priorIndex,
  );
  const readiness = assessLiveCaptureReadiness(request);
  const failed = readiness.filter((row) => !row.captureEligible);
  if (failed.length > 0) {
    const first = failed[0]!;
    throw new LiveCaptureRejectedError(
      `rejected: ${first.protocolClassification}: ${first.reason}`,
      classifications,
    );
  }
  for (const fixture of request.fixtures) {
    if (fixture.competitionId !== PROSPECTIVE_COMPETITION_ID) {
      throw new LiveCaptureRejectedError(
        `rejected: INTEGRITY_REJECTED: competition is not Premier League 39`,
        classifications,
      );
    }
    if (fixture.season !== ACCEPTED_PROSPECTIVE_SEASON) {
      throw new LiveCaptureRejectedError(
        `rejected: INTEGRITY_REJECTED: season ${fixture.season} is not the accepted prospective season ${ACCEPTED_PROSPECTIVE_SEASON}`,
        classifications,
      );
    }
  }
  return classifications;
}
