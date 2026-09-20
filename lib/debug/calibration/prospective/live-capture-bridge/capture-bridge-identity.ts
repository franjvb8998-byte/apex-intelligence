/**
 * Bind later provider-shaped snapshots to the human-reviewed fixture identity.
 */

import type { ProjectedTargetFixture } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";
import {
  CaptureBridgeRejectedError,
  emptyBridgeReport,
  type ReviewedCaptureHandoff,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

function mismatch(field: string, handoff: ReviewedCaptureHandoff): never {
  throw new CaptureBridgeRejectedError(
    `${field} mismatch`,
    emptyBridgeReport({
      fixtureId: handoff.fixtureId,
      reviewedClassification: handoff.reviewedClassification,
      identityVerified: false,
      captureDisposition: "REJECTED",
    }),
  );
}

export function assertIdentityBound(
  handoff: ReviewedCaptureHandoff,
  projected: ProjectedTargetFixture,
): void {
  if (projected.fixtureId !== handoff.fixtureId) mismatch("fixtureId", handoff);
  if (projected.competitionId !== handoff.competitionId) mismatch("competition", handoff);
  if (projected.season !== handoff.season) mismatch("season", handoff);
  if (projected.kickoffUtc !== handoff.kickoffUtc) mismatch("kickoff", handoff);
  if (projected.homeTeamId !== handoff.homeTeamId) mismatch("homeTeamId", handoff);
  if (projected.awayTeamId !== handoff.awayTeamId) mismatch("awayTeamId", handoff);
}
