/**
 * Optional odds disposition. Failures drop odds, not the fixture.
 */

import { projectOptionalOdds } from "@/lib/debug/calibration/prospective/live-execution/live-execution-odds";
import type { ProspectiveOddsSnapshot } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { OddsDisposition } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export function resolveOptionalBridgeOdds(input: {
  raw: unknown;
  capturedAt: string;
  kickoffUtc: string;
  transportFailed?: boolean;
}): { odds: ProspectiveOddsSnapshot | null; disposition: OddsDisposition } {
  if (input.transportFailed) {
    return { odds: null, disposition: "TRANSPORT_FAILED" };
  }
  if (input.raw == null) {
    return { odds: null, disposition: "ABSENT" };
  }
  const attached = projectOptionalOdds(input.raw, input.capturedAt, input.kickoffUtc);
  if (attached) {
    return { odds: attached, disposition: "ATTACHED" };
  }
  const record = input.raw !== null && typeof input.raw === "object" ? (input.raw as Record<string, unknown>) : {};
  const capturedAt = typeof record.capturedAt === "string" ? record.capturedAt : "";
  if (capturedAt && Date.parse(capturedAt) >= Date.parse(input.kickoffUtc)) {
    return { odds: null, disposition: "DROPPED_LATE" };
  }
  if (capturedAt && Date.parse(capturedAt) > Date.parse(input.capturedAt)) {
    return { odds: null, disposition: "DROPPED_LATE" };
  }
  return { odds: null, disposition: "DROPPED_INVALID" };
}
