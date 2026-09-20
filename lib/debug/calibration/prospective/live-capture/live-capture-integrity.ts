/**
 * 5C.5A integrity wrappers over frozen 5C.2 hashing. No second hash scheme.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import {
  assertCaptureBatchIntegrity,
  verifyBatchHashes,
} from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import { countPrimarySampleN } from "@/lib/debug/calibration/prospective/protocol/protocol-sample";
import { LIVE_CAPTURE_OPERATIONAL_FACTS } from "@/lib/debug/calibration/prospective/live-capture/live-capture-config";
import type { LiveCaptureRequest } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import { LiveCaptureRejectedError } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import type { ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";

export function assertFrozenFingerprintOverride(request: LiveCaptureRequest): void {
  if (
    request.candidateFingerprint != null &&
    request.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT
  ) {
    throw new LiveCaptureRejectedError(
      `rejected: wrong candidate fingerprint ${request.candidateFingerprint}`,
    );
  }
  if (LIVE_CAPTURE_OPERATIONAL_FACTS.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new ProspectiveIntegrityError("live-capture operational fingerprint drifted from frozen 5C.1");
  }
}

export function assertLiveCaptureBatchIntegrity(
  batch: ProspectiveCaptureBatch,
  priorIndex?: LiveCaptureRequest["priorIndex"],
): void {
  assertCaptureBatchIntegrity(batch, priorIndex);
  verifyBatchHashes(batch);
}

export function syntheticOrDryRunSampleN(): 0 {
  return 0;
}

export function assertRealProspectiveNUnchanged(): 0 {
  if (countPrimarySampleN([]) !== 0) {
    throw new ProspectiveIntegrityError("empty classification N must remain 0");
  }
  return 0;
}
