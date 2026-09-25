/**
 * PE-4I.3 — Research-only live transport adapter over ApiFootballClient.
 * Does not alter production client behavior. Not used by lifecycle/scanner.
 */

import {
  tryCreateApiFootballClientFromEnv,
  type ApiFootballClient,
} from "@/lib/data-platform/providers/api-football/client";
import type {
  Pe4I2ProviderRequest,
  Pe4I2ProviderTransport,
  Pe4I2ProviderTransportResult,
} from "@/lib/debug/calibration/pe4-acquisition/transport";

export type Pe4I2LiveClient = Pick<
  ApiFootballClient,
  "getTeamFixturesBySeason" | "getFixtureStatistics"
>;

export function createPe4I2LiveTransportFromClient(
  client: Pe4I2LiveClient,
): Pe4I2ProviderTransport {
  return {
    async request(req: Pe4I2ProviderRequest): Promise<Pe4I2ProviderTransportResult> {
      try {
        if (req.kind === "team_season_schedule") {
          const payload = await client.getTeamFixturesBySeason(
            req.providerTeamId,
            req.season,
          );
          return { ok: true, payload };
        }
        const payload = await client.getFixtureStatistics(req.providerFixtureId);
        return { ok: true, payload };
      } catch (err) {
        return {
          ok: false,
          reason: "provider_error",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export function createPe4I2LiveTransportFromEnv(
  env: Record<string, string | undefined> = process.env,
): Pe4I2ProviderTransport {
  const client = tryCreateApiFootballClientFromEnv(env);
  if (!client) {
    throw new Error(
      "API_FOOTBALL_KEY (or APISPORTS_KEY) is required for PE-4I.3 live smoke",
    );
  }
  return createPe4I2LiveTransportFromClient(client);
}
