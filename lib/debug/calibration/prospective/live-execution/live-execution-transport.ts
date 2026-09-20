/**
 * Injected transport seam. 5C.5B.1 ships a synthetic factory only.
 * Live provider transports must not be constructed or invoked here.
 */

import type {
  LiveExecutionTransport,
  LiveExecutionUniversePayload,
} from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";

export function createSyntheticLiveExecutionTransport(input: {
  target: unknown;
  fixtures?: readonly unknown[];
  odds?: unknown | null;
}): LiveExecutionTransport {
  const fixtures = [...(input.fixtures ?? [])];
  const odds = input.odds ?? null;
  return {
    kind: "synthetic",
    loadUniverse(): LiveExecutionUniversePayload {
      return { target: input.target, fixtures };
    },
    loadOdds(): unknown | null {
      return odds;
    },
  };
}
