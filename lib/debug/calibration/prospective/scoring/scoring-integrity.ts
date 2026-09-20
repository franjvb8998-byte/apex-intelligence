/**
 * Pending-source and scored-artifact integrity. Pending files stay byte-identical.
 */

import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { assertCaptureBatchIntegrity } from "@/lib/debug/calibration/prospective/capture/capture-integrity";
import type { ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { verifyScoredHashes } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export function assertPendingSourceIntegrity(batch: ProspectiveCaptureBatch): void {
  assertCaptureBatchIntegrity(batch);
  if (batch.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new Error("wrong candidate fingerprint");
  }
}

export function assertScoredArtifactIntegrity(artifact: ProspectiveScoredArtifact): void {
  verifyScoredHashes(artifact);
  if (artifact.candidateFingerprint !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new Error("wrong candidate fingerprint");
  }
  if (artifact.candidateScores.length !== 5) {
    throw new Error("scored artifact must contain exactly five candidate rows");
  }
}
