/**
 * Live-provider interlock. 5C.5B.2 never enables provider I/O.
 * Importing this module performs no network activity and does not read secrets.
 */

import {
  CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED,
  CaptureBridgeRejectedError,
  emptyBridgeReport,
  type CaptureBridgeRequest,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export function assertCaptureBridgeOffline(request: CaptureBridgeRequest): void {
  if (CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED) {
    throw new CaptureBridgeRejectedError(
      "live provider execution is not enabled in 5C.5B.2",
      emptyBridgeReport({ fixtureId: request.handoff.fixtureId }),
    );
  }
  if (request.authorizeLiveProvider === true) {
    throw new CaptureBridgeRejectedError(
      "live provider authorization is not accepted in 5C.5B.2",
      emptyBridgeReport({ fixtureId: request.handoff.fixtureId }),
    );
  }
  if (request.transport.kind !== "synthetic") {
    throw new CaptureBridgeRejectedError(
      "capture bridge accepts synthetic transport only",
      emptyBridgeReport({ fixtureId: request.handoff.fixtureId }),
    );
  }
}
