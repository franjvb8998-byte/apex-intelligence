/**
 * PE-4I.6 — Statistics-only transport wrapper.
 * Hard-refuses schedule / season requests so Stage-2A cannot hit schedule endpoints.
 */

import type {
  Pe4I2ProviderRequest,
  Pe4I2ProviderTransport,
  Pe4I2ProviderTransportResult,
} from "@/lib/debug/calibration/pe4-acquisition/transport";

export class Pe4I6ScheduleEndpointForbiddenError extends Error {
  constructor(message = "PE-4I.6 Stage-2A forbids schedule endpoint") {
    super(message);
    this.name = "Pe4I6ScheduleEndpointForbiddenError";
  }
}

export function createStatisticsOnlyTransport(
  inner: Pe4I2ProviderTransport,
): Pe4I2ProviderTransport & { scheduleAttempts: number } {
  const state = { scheduleAttempts: 0 };
  return {
    get scheduleAttempts() {
      return state.scheduleAttempts;
    },
    async request(
      req: Pe4I2ProviderRequest,
    ): Promise<Pe4I2ProviderTransportResult> {
      if (req.kind === "team_season_schedule") {
        state.scheduleAttempts += 1;
        throw new Pe4I6ScheduleEndpointForbiddenError(
          `schedule endpoint forbidden for team=${req.providerTeamId} season=${req.season}`,
        );
      }
      return inner.request(req);
    },
  };
}
