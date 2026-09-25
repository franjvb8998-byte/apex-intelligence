/**
 * PE-4I.2 — Injectable provider transport (tests use fakes only).
 */

export type Pe4I2TeamSeasonScheduleRequest = {
  kind: "team_season_schedule";
  providerTeamId: string;
  season: string;
};

export type Pe4I2FixtureStatisticsRequest = {
  kind: "fixture_statistics";
  providerFixtureId: string;
};

export type Pe4I2ProviderRequest =
  | Pe4I2TeamSeasonScheduleRequest
  | Pe4I2FixtureStatisticsRequest;

export type Pe4I2ProviderTransportResult =
  | {
      ok: true;
      /** Opaque provider payload (fixtures list or statistics list). */
      payload: unknown;
    }
  | {
      ok: false;
      reason: "provider_error" | "malformed_response";
      message: string;
    };

export type Pe4I2ProviderTransport = {
  request(req: Pe4I2ProviderRequest): Promise<Pe4I2ProviderTransportResult>;
};

/** Refuses all network — used as default for dry-run / plan. */
export function createRefusingTransport(): Pe4I2ProviderTransport {
  return {
    async request() {
      return {
        ok: false,
        reason: "provider_error",
        message: "PE-4I.2 transport refused: live provider disabled",
      };
    },
  };
}

export type Pe4I2FakeTransportScript = {
  onRequest: (
    req: Pe4I2ProviderRequest,
    callIndex: number,
  ) => Pe4I2ProviderTransportResult | Promise<Pe4I2ProviderTransportResult>;
};

export function createFakePe4I2Transport(
  script: Pe4I2FakeTransportScript,
): Pe4I2ProviderTransport & { readonly calls: Pe4I2ProviderRequest[] } {
  const calls: Pe4I2ProviderRequest[] = [];
  return {
    calls,
    async request(req) {
      calls.push(req);
      return script.onRequest(req, calls.length - 1);
    },
  };
}
