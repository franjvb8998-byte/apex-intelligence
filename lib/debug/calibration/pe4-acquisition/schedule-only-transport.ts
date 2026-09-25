/**
 * PE-4I.5 — Schedule-only transport wrapper.
 * Hard-refuses fixture_statistics requests so Stage-1 cannot invoke stats.
 */

import type {
  Pe4I2ProviderRequest,
  Pe4I2ProviderTransport,
  Pe4I2ProviderTransportResult,
} from "@/lib/debug/calibration/pe4-acquisition/transport";

export class Pe4I5StatisticsEndpointForbiddenError extends Error {
  constructor(message = "PE-4I.5 Stage-1 forbids fixture statistics endpoint") {
    super(message);
    this.name = "Pe4I5StatisticsEndpointForbiddenError";
  }
}

export function createScheduleOnlyTransport(
  inner: Pe4I2ProviderTransport,
): Pe4I2ProviderTransport & { statisticsAttempts: number } {
  const state = { statisticsAttempts: 0 };
  return {
    get statisticsAttempts() {
      return state.statisticsAttempts;
    },
    async request(
      req: Pe4I2ProviderRequest,
    ): Promise<Pe4I2ProviderTransportResult> {
      if (req.kind === "fixture_statistics") {
        state.statisticsAttempts += 1;
        throw new Pe4I5StatisticsEndpointForbiddenError(
          `statistics endpoint forbidden for fixture=${req.providerFixtureId}`,
        );
      }
      if (req.season === "2025") {
        throw new Error(
          "PE-4I.5 holdout firewall: provider season 2025 requests are forbidden",
        );
      }
      return inner.request(req);
    },
  };
}
