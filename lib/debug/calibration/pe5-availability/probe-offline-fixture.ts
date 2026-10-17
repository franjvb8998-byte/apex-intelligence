/**
 * PE-5.3D — builtin offline fixture envelope.
 *
 * readPe53bOfflineFixture returns one empty in-memory envelope.
 * It accepts a request description, not a callback, and it does not open a
 * socket. runPe53bProbe captures this function at module initialization and
 * calls that captured reference. Replacing the export later does not retarget
 * a runner that has already initialized.
 */

import type {
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";

export function readPe53bOfflineFixture(
  input: Pe53bTransportRequest,
): Pe53bTransportResponse {
  const path = input.path;
  const fixture = input.query.fixture;
  return {
    status: 200,
    headers: {},
    body: {
      get: typeof path === "string" ? path.replace(/^\//, "") : "",
      parameters: { fixture: typeof fixture === "string" ? fixture : "" },
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    },
  };
}
