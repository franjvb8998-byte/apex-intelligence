/**
 * Production API-Football → season-universe transport (PE-3F / PE-3H).
 *
 * Production contract (PE-3H): GET /fixtures?league=&season= (unpaged).
 * Completeness is proven from the response envelope itself — never by
 * sending an unsupported `page=` parameter on plans that reject it.
 *
 * Architectural paged transport remains available for providers/plans that
 * genuinely support page walking (PE-3E complete-fetch). Production loader
 * does not use it.
 *
 * Never /teams/statistics. Never all-leagues fallback.
 */

import { apexIdFor } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import type {
  ApiFootballFixtureItem,
  ApiFootballFixturesResponse,
} from "@/lib/data-platform/providers/api-football/types";
import {
  createProductDataProvider,
  isQuotaError,
} from "@/lib/repositories";
import {
  normalizeSeasonUniverseRows,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe/acquisition";
import type { SeasonUniversePageTransport } from "@/lib/prematch-lifecycle/season-universe/complete-fetch";
import type { SeasonUniverseLoader } from "@/lib/prematch-lifecycle/season-universe/run-scope-cache";
import type { SeasonUniverseKey } from "@/lib/prematch-lifecycle/season-universe/season-resolution";
import { vendorLeagueIdFromCompetitionId } from "@/lib/prematch-lifecycle/season-universe/vendor-league-id";

const PROVIDER = "api-football" as const;

/**
 * True when API-Football `errors` is absent or empty (array [] or object {}).
 * Non-empty payloads (e.g. `{ page: "The Page field do not exist." }`) are
 * never treated as success.
 */
export function isApiFootballSeasonListErrorsEmpty(errors: unknown): boolean {
  if (errors == null) return true;
  if (Array.isArray(errors)) return errors.length === 0;
  if (typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>).filter(
      Boolean,
    );
    return values.length === 0;
  }
  return false;
}

export type ApiFootballUnpagedCompleteness =
  | { ok: true }
  | {
      ok: false;
      reason: "malformed_provider_response" | "incomplete_season_list";
    };

/**
 * Completeness proof for the proven unpaged league+season contract:
 * empty errors, paging.current===1, paging.total===1, results===response.length.
 */
export function evaluateApiFootballUnpagedFixturesCompleteness(
  payload: ApiFootballFixturesResponse,
): ApiFootballUnpagedCompleteness {
  if (!isApiFootballSeasonListErrorsEmpty(payload.errors)) {
    return { ok: false, reason: "malformed_provider_response" };
  }
  if (!Array.isArray(payload.response)) {
    return { ok: false, reason: "malformed_provider_response" };
  }
  const paging = payload.paging;
  if (
    paging == null ||
    !Number.isInteger(paging.current) ||
    !Number.isInteger(paging.total) ||
    paging.current < 1 ||
    paging.total < 1
  ) {
    return { ok: false, reason: "malformed_provider_response" };
  }
  if (paging.current !== 1 || paging.total !== 1) {
    return { ok: false, reason: "incomplete_season_list" };
  }
  const results = payload.results;
  if (
    typeof results !== "number" ||
    !Number.isFinite(results) ||
    !Number.isInteger(results) ||
    results < 0
  ) {
    return { ok: false, reason: "malformed_provider_response" };
  }
  if (results !== payload.response.length) {
    return { ok: false, reason: "incomplete_season_list" };
  }
  return { ok: true };
}

/**
 * Map one vendor fixture item into a season-universe row for `key`.
 * Cross-key rows are dropped (null); malformed ids are dropped.
 */
export function mapApiFootballFixtureItemToSeasonUniverseRow(
  item: ApiFootballFixtureItem,
  key: SeasonUniverseKey,
): SeasonUniverseProviderRow | null {
  const fixtureId = String(item.fixture?.id ?? "");
  if (!/^[1-9]\d*$/.test(fixtureId)) return null;
  if (item.teams?.home?.id == null || item.teams?.away?.id == null) {
    return null;
  }
  if (item.league?.id == null) return null;

  const competitionId = apexIdFor(
    PROVIDER,
    "league",
    String(item.league.id),
  );
  const season =
    item.league.season != null ? String(item.league.season).trim() : "";
  if (!season) return null;
  if (competitionId !== key.competitionId || season !== key.season) {
    return null;
  }

  const kickoffUtc = new Date(item.fixture.date).toISOString();
  if (Number.isNaN(Date.parse(kickoffUtc))) return null;

  const status = item.fixture.status?.short;
  if (!status) return null;

  const homeGoals =
    item.score?.fulltime?.home ?? item.goals?.home ?? null;
  const awayGoals =
    item.score?.fulltime?.away ?? item.goals?.away ?? null;

  return {
    fixtureId,
    kickoffUtc,
    homeTeamId: apexIdFor(PROVIDER, "team", String(item.teams.home.id)),
    awayTeamId: apexIdFor(PROVIDER, "team", String(item.teams.away.id)),
    competitionId,
    season,
    status,
    homeGoals: homeGoals == null ? null : homeGoals,
    awayGoals: awayGoals == null ? null : awayGoals,
  };
}

export type ApiFootballPagedFixturesClient = Pick<
  ApiFootballClient,
  "getFixturesByLeague"
>;

function mapPayloadRows(
  payload: ApiFootballFixturesResponse,
  key: SeasonUniverseKey,
): SeasonUniverseProviderRow[] {
  const rows: SeasonUniverseProviderRow[] = [];
  for (const item of payload.response ?? []) {
    const row = mapApiFootballFixtureItemToSeasonUniverseRow(item, key);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Architectural page transport for plans that genuinely support `page=`.
 * Non-empty provider `errors` fail closed (paging null → complete-fetch
 * rejects). Production API-Football loader does not use this path.
 */
export function createSeasonUniversePageTransportFromApiFootballClient(
  client: ApiFootballPagedFixturesClient,
): SeasonUniversePageTransport {
  return {
    async fetchPage(key, page) {
      const vendorLeagueId = vendorLeagueIdFromCompetitionId(key.competitionId);
      if (!vendorLeagueId) {
        // Fail closed: missing paging → complete-fetch rejects.
        return { paging: null, rows: [] };
      }
      const payload = await client.getFixturesByLeague(
        vendorLeagueId,
        key.season,
        page,
      );
      if (!isApiFootballSeasonListErrorsEmpty(payload.errors)) {
        // Never accept errors.page / empty false-complete envelopes.
        return { paging: null, rows: [] };
      }
      return {
        paging: payload.paging ?? null,
        rows: mapPayloadRows(payload, key),
      };
    },
  };
}

/**
 * Production API-Football season-universe loader: one unpaged league+season
 * request with explicit completeness proof. Does not send `page=`.
 *
 * `httpRequests` counts this logical getFixturesByLeague call (1 on success
 * or fail-closed after the call). Client-internal retries remain outside
 * this counter (existing abstraction limitation).
 */
export function createSeasonUniverseLoaderFromApiFootballUnpagedClient(
  client: ApiFootballPagedFixturesClient,
): SeasonUniverseLoader {
  return async (key) => {
    const vendorLeagueId = vendorLeagueIdFromCompetitionId(key.competitionId);
    if (!vendorLeagueId) {
      return {
        ok: false,
        key,
        reason: "invalid_vendor_league_id",
        httpRequests: 0,
      };
    }
    try {
      const payload = await client.getFixturesByLeague(
        vendorLeagueId,
        key.season,
      );
      const completeness =
        evaluateApiFootballUnpagedFixturesCompleteness(payload);
      if (!completeness.ok) {
        return {
          ok: false,
          key,
          reason: completeness.reason,
          httpRequests: 1,
        };
      }
      return normalizeSeasonUniverseRows(key, mapPayloadRows(payload, key), {
        httpRequests: 1,
      });
    } catch (error) {
      if (isQuotaError(error)) throw error;
      return {
        ok: false,
        key,
        reason: "provider_failure",
        httpRequests: 1,
      };
    }
  };
}

/**
 * Production-capable season-universe loader for C0 recon.
 * Builds from the same product provider path as lifecycle transport
 * (createProductDataProvider → ApiFootballDataProvider.http).
 *
 * Uses the unpaged-complete contract (PE-3H). Does not send `page=`.
 */
export function createProductionSeasonUniverseLoader(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SeasonUniverseLoader {
  const provider = createProductDataProvider(env, { enrichMatch: false });
  if (!(provider instanceof ApiFootballDataProvider)) {
    return async (key) => ({
      ok: false,
      key,
      reason: "provider_failure",
      httpRequests: 0,
    });
  }
  return createSeasonUniverseLoaderFromApiFootballUnpagedClient(provider.http);
}
