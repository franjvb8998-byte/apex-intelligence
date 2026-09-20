/**
 * 5C.5A offline live-capture orchestrator.
 * Composes frozen 5C.1–5C.4 modules. Default dry-run. No provider transport.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { captureProspectiveBatch } from "@/lib/debug/calibration/prospective/capture/capture-runner";
import { LIVE_CAPTURE_DEFAULT_DRY_RUN, liveCaptureWindow } from "@/lib/debug/calibration/prospective/live-capture/live-capture-config";
import {
  assertAllFixturesEligible,
  assessLiveCaptureReadiness,
  classifyLiveCaptureFixtures,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-eligibility";
import { toProspectiveFixtureInput } from "@/lib/debug/calibration/prospective/live-capture/live-capture-evidence";
import {
  assertFrozenFingerprintOverride,
  assertLiveCaptureBatchIntegrity,
  assertRealProspectiveNUnchanged,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-integrity";
import {
  LIVE_CAPTURE_PHASE,
  LiveCaptureRejectedError,
  type LiveCaptureRequest,
  type LiveCaptureResult,
} from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";

export function orchestrateLiveCapture(request: LiveCaptureRequest): LiveCaptureResult {
  assertFrozenFingerprintOverride(request);
  const dryRun = request.dryRun ?? LIVE_CAPTURE_DEFAULT_DRY_RUN;
  const capturedAt = request.capturedAt ?? request.clock.now();
  const createdAt = request.createdAt ?? capturedAt;
  const classifications = classifyLiveCaptureFixtures(
    request.fixtures,
    capturedAt,
    request.priorIndex,
  );
  const readiness = assessLiveCaptureReadiness(request);
  assertAllFixturesEligible(request);

  if (request.simulateCandidateFailure === true) {
    throw new LiveCaptureRejectedError("simulated candidate failure during five-arm evaluation", classifications);
  }

  const mapped = request.fixtures.map(toProspectiveFixtureInput);
  const captureImpl = request.captureImpl ?? captureProspectiveBatch;
  const capture = captureImpl(mapped, {
    clock: request.clock,
    capturedAt,
    createdAt,
    dryRun,
    persistRoot: request.persistRoot,
    priorIndex: request.priorIndex,
    window: liveCaptureWindow(),
    simulateFailureAfterTempWrite: request.simulateFailureAfterTempWrite,
  });

  if (capture.batch.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new LiveCaptureRejectedError("capture batch fingerprint is not the frozen 5C.1 fingerprint");
  }
  if (capture.batch.recordCount !== capture.batch.fixtureCount * PROSPECTIVE_CANDIDATE_IDS.length) {
    throw new LiveCaptureRejectedError("five-arm capture is incomplete");
  }
  assertLiveCaptureBatchIntegrity(capture.batch, request.priorIndex);

  return {
    phase: LIVE_CAPTURE_PHASE,
    authorizedLiveCapture: false,
    dryRun: capture.dryRun,
    prospectiveN: assertRealProspectiveNUnchanged(),
    acceptedFixtureCount: capture.batch.fixtureCount,
    recordCount: capture.batch.recordCount,
    classifications,
    readiness,
    capture,
    batch: capture.batch,
  };
}
