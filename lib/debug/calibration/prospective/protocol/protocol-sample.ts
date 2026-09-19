/**
 * Prospective sample accounting. N counts fixtures, not candidate rows.
 */

import { LIVE_PROTOCOL_CONFIG } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import type { PlannerClassification } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export function countPrimarySampleN(
  classifications: readonly Pick<PlannerClassification, "fixtureId" | "disposition">[],
): number {
  const fixtures = new Set<string>();
  for (const row of classifications) {
    if (row.disposition === "CAPTURED_PENDING") {
      fixtures.add(row.fixtureId);
    }
  }
  return fixtures.size;
}

export function reportingCheckpoints(): readonly number[] {
  return LIVE_PROTOCOL_CONFIG.reportingCheckpoints;
}
