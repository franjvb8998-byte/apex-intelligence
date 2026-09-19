/**
 * Live API-Football transport for the debug microcollector.
 * Must not be constructed unless live authorization already passed.
 */

import {
  tryCreateApiFootballClientFromEnv,
  type ApiFootballClientOptions,
} from "@/lib/data-platform/providers/api-football/client";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import { LiveCollectionGuardError } from "@/lib/debug/calibration/live-guard";
import type { MicrocollectTransport } from "@/lib/debug/calibration/microcollect";

/**
 * Live transport uses createApiFootballClient (API key header, shared limiter,
 * daily quota circuit, retry). It does not wrap withApiFootballClientCache, so
 * process cache / single-flight are not on this path. Sequential unique lookups
 * do not need single-flight; skipping cache avoids stale-on-429 for a first run.
 */
export function createLiveMicrocollectTransport(
  env: Record<string, string | undefined> = process.env,
  overrides: Omit<ApiFootballClientOptions, "apiKey" | "baseUrl"> = {},
): MicrocollectTransport {
  const client = tryCreateApiFootballClientFromEnv(env, overrides);
  if (!client) {
    throw new LiveCollectionGuardError(
      "API_FOOTBALL_KEY is required for live microcollection",
    );
  }
  return {
    getFixtures: (league, season) => client.getFixturesByLeague(league, season),
    getFixtureOdds: (fixtureId) => client.getFixtureOdds(fixtureId),
  };
}

/** Fixtures-only live transport. No odds method. */
export function createLivePilotTransport(
  env: Record<string, string | undefined> = process.env,
  overrides: Omit<ApiFootballClientOptions, "apiKey" | "baseUrl"> = {},
): FixtureSeasonTransport {
  const client = tryCreateApiFootballClientFromEnv(env, overrides);
  if (!client) {
    throw new LiveCollectionGuardError(
      "API_FOOTBALL_KEY is required for the historical calibration pilot",
    );
  }
  return {
    getFixtures: (league, season) => client.getFixturesByLeague(league, season),
  };
}

/** Fixtures-only live transport for 5B.6 holdout seasons. No odds method. */
export function createLiveValidationTransport(
  env: Record<string, string | undefined> = process.env,
  overrides: Omit<ApiFootballClientOptions, "apiKey" | "baseUrl"> = {},
): FixtureSeasonTransport {
  const client = tryCreateApiFootballClientFromEnv(env, overrides);
  if (!client) {
    throw new LiveCollectionGuardError(
      "API_FOOTBALL_KEY is required for multi-season validation collection",
    );
  }
  return {
    getFixtures: (league, season) => client.getFixturesByLeague(league, season),
  };
}
