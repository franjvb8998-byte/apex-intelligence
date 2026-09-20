/**
 * Human-reviewed discovery handoff. Capture is refused unless classification is IN_WINDOW.
 */

import {
  CaptureBridgeRejectedError,
  emptyBridgeReport,
  type ReviewedCaptureHandoff,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export function assertReviewedInWindow(handoff: ReviewedCaptureHandoff): void {
  if (handoff.reviewedClassification !== "IN_WINDOW") {
    throw new CaptureBridgeRejectedError(
      `reviewed handoff is ${handoff.reviewedClassification}; evidence acquisition is not authorized`,
      emptyBridgeReport({
        fixtureId: handoff.fixtureId,
        reviewedClassification: handoff.reviewedClassification,
        reviewedDiscoveryAtUtc: handoff.reviewedDiscoveryAtUtc,
        captureDisposition: "REJECTED",
      }),
    );
  }
}
