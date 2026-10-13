/**
 * PE-5.3C — offline transport capability.
 *
 * The private symbol below is the only offline credential the runner accepts.
 * It is not exported. A matching `kind` string cannot mint it.
 *
 * createPe53bBuiltinOfflineTransport is the transport runPe53bProbe uses.
 * It is constructed in this module and has no network implementation.
 *
 * createPe53bBrandedOfflineTransport is the testing seam. It stamps the
 * private symbol on a callback. The stamp does not inspect or sandbox that
 * callback. runPe53bProbe does not accept the callback.
 */

import type {
  Pe53bTransportRequest,
  Pe53bTransportResponse,
} from "@/lib/debug/calibration/pe5-availability/probe-transport";

const PE53C_OFFLINE_CAPABILITY = Symbol("pe53c.offlineFixtureTransport");

export type Pe53bBrandedOfflineTransport = {
  request(input: Pe53bTransportRequest): Promise<Pe53bTransportResponse>;
};

type BrandedCarrier = Pe53bBrandedOfflineTransport & {
  readonly [PE53C_OFFLINE_CAPABILITY]: typeof PE53C_OFFLINE_CAPABILITY;
};

export function isPe53bBrandedOfflineTransport(
  value: unknown,
): value is Pe53bBrandedOfflineTransport {
  if (typeof value !== "object" || value === null) return false;
  const carrier = value as Partial<BrandedCarrier>;
  return (
    carrier[PE53C_OFFLINE_CAPABILITY] === PE53C_OFFLINE_CAPABILITY &&
    typeof carrier.request === "function"
  );
}

export function createPe53bBrandedOfflineTransport(
  request: (input: Pe53bTransportRequest) => Promise<Pe53bTransportResponse>,
): Pe53bBrandedOfflineTransport {
  const invoke: BrandedCarrier["request"] =
    typeof request === "function"
      ? request
      : async () => {
          throw new Error("invalid offline transport");
        };
  const branded: BrandedCarrier = {
    [PE53C_OFFLINE_CAPABILITY]: PE53C_OFFLINE_CAPABILITY,
    request: invoke,
  };
  return branded;
}

export function createPe53bBuiltinOfflineTransport(): Pe53bBrandedOfflineTransport {
  return createPe53bBrandedOfflineTransport(async (input) => ({
    status: 200,
    headers: {},
    body: {
      get: input.path.replace(/^\//, ""),
      parameters: { fixture: input.query.fixture },
      errors: [],
      results: 0,
      paging: { current: 1, total: 1 },
      response: [],
    },
  }));
}
