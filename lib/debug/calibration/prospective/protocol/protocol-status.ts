/**
 * Conservative provider-status mapping. Unknown states are rejected until reviewed.
 */

import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const ELIGIBLE_PREMATCH_STATUSES = ["NS", "NOT_STARTED", "SCHEDULED"] as const;
export const REJECTED_IN_PLAY_OR_FINAL_STATUSES = [
  "LIVE",
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "SUSP",
  "SUSPENDED",
  "INT",
  "FT",
  "AET",
  "PEN",
] as const;
export const POSTPONED_STATUSES = ["PST", "POSTP", "POSTPONED"] as const;
export const CANCELLED_STATUSES = ["CANC", "CANCELLED", "ABD", "ABANDONED"] as const;

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function classifyProviderStatus(status: string): {
  disposition: Extract<
    PlannerDisposition,
    "IN_WINDOW" | "INELIGIBLE_STATUS" | "POSTPONED_BEFORE_CAPTURE" | "CANCELLED_BEFORE_CAPTURE"
  > | "UNKNOWN";
  normalized: string;
} {
  const normalized = normalizeStatus(status);
  if ((ELIGIBLE_PREMATCH_STATUSES as readonly string[]).includes(normalized)) {
    return { disposition: "IN_WINDOW", normalized };
  }
  if ((POSTPONED_STATUSES as readonly string[]).includes(normalized)) {
    return { disposition: "POSTPONED_BEFORE_CAPTURE", normalized };
  }
  if ((CANCELLED_STATUSES as readonly string[]).includes(normalized)) {
    return { disposition: "CANCELLED_BEFORE_CAPTURE", normalized };
  }
  if ((REJECTED_IN_PLAY_OR_FINAL_STATUSES as readonly string[]).includes(normalized)) {
    return { disposition: "INELIGIBLE_STATUS", normalized };
  }
  return { disposition: "UNKNOWN", normalized };
}
