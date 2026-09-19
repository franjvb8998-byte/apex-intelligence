/**
 * First-live-discovery boundary. Discovery must not create predictions.
 */

import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { LIVE_PROTOCOL_CONFIG } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import { planDiscoveredFixtures } from "@/lib/debug/calibration/prospective/protocol/protocol-planner";
import type {
  DiscoveredFixtureMetadata,
  PlannerClassification,
} from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const FIRST_LIVE_PHASE = "DISCOVERY_ONLY" as const;
export const FIRST_LIVE_CAPTURES_PREDICTIONS = false;

export type DiscoveryPlanResult = {
  phase: typeof FIRST_LIVE_PHASE;
  createdPredictions: false;
  networkCalls: 0;
  classifications: PlannerClassification[];
};

export function planFirstLiveDiscovery(
  fixtures: readonly DiscoveredFixtureMetadata[],
  clock: CaptureClock,
  options?: { season?: string; priorCapturedIds?: ReadonlySet<string> },
): DiscoveryPlanResult {
  if (!LIVE_PROTOCOL_CONFIG.discoverySeparatedFromCapture) {
    throw new Error("first live discovery must remain separated from capture");
  }
  return {
    phase: FIRST_LIVE_PHASE,
    createdPredictions: false,
    networkCalls: 0,
    classifications: planDiscoveredFixtures(fixtures, clock, options),
  };
}
