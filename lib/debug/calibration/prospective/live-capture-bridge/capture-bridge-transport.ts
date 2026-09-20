/**
 * Synthetic capture-bridge transport factory. No provider I/O.
 *
 * Future live request families (not executed here):
 *   evidenceFamily = prior_completed_same_league_season
 *   oddsFamily = optional_prematch_odds
 */

import type { CaptureBridgeTransport } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export const CAPTURE_BRIDGE_REQUEST_FAMILIES = {
  evidenceFamily: "prior_completed_same_league_season",
  oddsFamily: "optional_prematch_odds",
} as const;

export function createSyntheticCaptureBridgeTransport(input: {
  target: unknown;
  fixtures?: readonly unknown[];
  odds?: unknown | null;
  failEvidence?: boolean;
  failOdds?: boolean;
}): CaptureBridgeTransport {
  return {
    kind: "synthetic",
    loadEvidenceUniverse() {
      if (input.failEvidence) {
        throw new Error("evidence transport failure");
      }
      return { target: input.target, fixtures: [...(input.fixtures ?? [])] };
    },
    loadOdds() {
      if (input.failOdds) {
        throw new Error("odds transport failure");
      }
      return input.odds ?? null;
    },
  };
}
