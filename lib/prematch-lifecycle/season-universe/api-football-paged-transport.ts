/**
 * Production API-Football → season-universe paged transport (PE-3F).
 *
 * Reuses the authenticated ApiFootballDataProvider HTTP client.
 * Endpoint: GET /fixtures?league=&season=&page=
 * Never /teams/statistics. Never all-leagues fallback.
 */

import { apexIdFor } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import { createProductDataProvider } from "@/lib/repositories";
import type { SeasonUniverseProviderRow } from "@/lib/prematch-lifecycle/season-universe/acquisition";
import type { SeasonUniversePageTransport } from "@/lib/prematch-lifecycle/season-universe/complete-fetch";
import { createSeasonUniverseLoaderFromPagedTransport } from "@/lib/prematch-lifecycle/season-universe/from-bundles";
import type { SeasonUniverseLoader } from "@/lib/prematch-lifecycle/season-universe/run-scope-cache";
import type { SeasonUniverseKey } from "@/lib/prematch-lifecycle/season-universe/season-resolution";
import { vendorLeagueIdFromCompetitionId } from "@/lib/prematch-lifecycle/season-universe/vendor-league-id";

const PROVIDER = "api-football" as const;

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

/**
 * Page transport over an existing ApiFootballClient (live or recorded).
 * Caller must already have validated vendor league mapping via
 * createSeasonUniverseLoaderFromPagedTransport.
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
      const rows: SeasonUniverseProviderRow[] = [];
      for (const item of payload.response ?? []) {
        const row = mapApiFootballFixtureItemToSeasonUniverseRow(item, key);
        if (row) rows.push(row);
      }
      return {
        paging: payload.paging ?? null,
        rows,
      };
    },
  };
}

/**
 * Production-capable season-universe loader for C0 recon.
 * Builds from the same product provider path as lifecycle transport
 * (createProductDataProvider → ApiFootballDataProvider.http).
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
  return createSeasonUniverseLoaderFromPagedTransport(
    createSeasonUniversePageTransportFromApiFootballClient(provider.http),
  );
}
