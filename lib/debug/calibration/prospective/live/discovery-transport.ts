/**
 * Debug-only GET /fixtures transport. Odds and subresources are unavailable.
 * Does not change production API-Football client behavior.
 */

import { createHttpClient, type HttpClient } from "@/lib/data-platform/http";
import { readApiFootballConfig } from "@/lib/data-platform/providers/api-football/config";
import { LiveCollectionGuardError } from "@/lib/debug/calibration/live-guard";
import { HistoricalFirewallError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { USED_HISTORICAL_SEASONS } from "@/lib/debug/calibration/prospective/candidate-types";
import { PROSPECTIVE_COMPETITION_ID } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import {
  DISCOVERY_ALLOWED_PATH,
  DISCOVERY_ALLOWED_QUERY_KEYS,
  DISCOVERY_FORBIDDEN_PATHS,
  DiscoveryIntegrityError,
  type DiscoveryFixtureQuery,
  type DiscoveryTransport,
} from "@/lib/debug/calibration/prospective/live/discovery-types";

const ALLOWED_QUERY = new Set<string>(DISCOVERY_ALLOWED_QUERY_KEYS);

export function assertOddsUnavailable(transport: DiscoveryTransport): void {
  for (const key of Object.keys(transport)) {
    if (/odds/i.test(key)) {
      throw new DiscoveryIntegrityError("odds endpoint must be unavailable during discovery");
    }
  }
}

export function assertAllowedDiscoveryRequest(
  path: string,
  query: Record<string, unknown>,
): void {
  if (DISCOVERY_FORBIDDEN_PATHS.includes(path as (typeof DISCOVERY_FORBIDDEN_PATHS)[number])) {
    throw new DiscoveryIntegrityError(`discovery forbids endpoint ${path}`);
  }
  if (path !== DISCOVERY_ALLOWED_PATH) {
    throw new DiscoveryIntegrityError(`discovery allows only ${DISCOVERY_ALLOWED_PATH}, not ${path}`);
  }
  if (path.includes("/fixtures/")) {
    throw new DiscoveryIntegrityError("discovery forbids fixtures subresources");
  }
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY.has(key)) {
      throw new DiscoveryIntegrityError(`discovery forbids query parameter ${key}`);
    }
  }
  if (query.league != null && String(query.league) !== PROSPECTIVE_COMPETITION_ID) {
    throw new DiscoveryIntegrityError("discovery league must be Premier League 39");
  }
  if (query.season != null) {
    const season = String(query.season);
    if ((USED_HISTORICAL_SEASONS as readonly string[]).includes(season)) {
      throw new HistoricalFirewallError(
        `${season} is used 5B investigation data and cannot enter prospective discovery`,
      );
    }
  }
}

export function createLiveDiscoveryTransport(
  env: Record<string, string | undefined> = process.env,
  overrides: { httpClient?: HttpClient } = {},
): DiscoveryTransport {
  const config = readApiFootballConfig(env);
  if (!config.apiKey) {
    throw new LiveCollectionGuardError(
      "API_FOOTBALL_KEY is required for live discovery",
    );
  }
  const http =
    overrides.httpClient ??
    createHttpClient({
      baseUrl: config.baseUrl,
      providerId: "api-football-discovery",
      timeoutMs: config.timeoutMs,
      defaultHeaders: {
        "x-apisports-key": config.apiKey,
      },
    });
  return {
    async getFixtures(query: DiscoveryFixtureQuery) {
      assertAllowedDiscoveryRequest(DISCOVERY_ALLOWED_PATH, query);
      const response = await http.get<unknown>(DISCOVERY_ALLOWED_PATH, query);
      return response.data;
    },
  };
}
