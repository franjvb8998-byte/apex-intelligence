/**
 * Internal football data source for DAL v1.
 * The only request-path module allowed to construct or inspect API-Football.
 */

import {
  createApiFootballDataProvider,
  readApiFootballConfig,
  type IDataProvider,
} from "@/lib/data-platform";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  DataProviderFixturesQuery,
  DataProviderMatchQuery,
} from "@/lib/data-platform/types";
import {
  oncePerRequest,
  oncePerRequestSync,
  requestIdentityKey,
  requestMemoKey,
} from "@/lib/repositories/once-per-request";

export type DataAccessProfile = "product" | "recorded";

export type DataAccessMode = "live" | "recorded" | "mock";

export type RepositoryContext = {
  provider?: IDataProvider;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Default: product (API-Football, recorded fallback without a key). */
  profile?: DataAccessProfile;
  enrichMatch?: boolean;
};

export type FootballExtras = Pick<
  ApiFootballClient,
  | "getTeam"
  | "getTeamStatistics"
  | "getStandings"
  | "getFixtureStatistics"
  | "getFixtureOdds"
  | "getHeadToHead"
  | "getInjuries"
  | "getTeamLastFixtures"
  | "getLineups"
  | "getEvents"
  | "getPlayer"
  | "getLeague"
>;

export type FootballSource = {
  readonly provider: IDataProvider;
  readonly id: IDataProvider["id"];
  readonly displayName: string;
  readonly dataMode: DataAccessMode;
  readonly extras: FootballExtras | null;
  getMatch(query: DataProviderMatchQuery): Promise<ApexMatchBundle>;
  listFixtures(query?: DataProviderFixturesQuery): Promise<ApexMatchBundle[]>;
};

export function hasFootballApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(readApiFootballConfig(env).apiKey);
}

export function dataModeOf(provider: IDataProvider): DataAccessMode {
  if (provider.id === "mock") return "mock";
  if (provider instanceof ApiFootballDataProvider) return provider.dataMode;
  return "live";
}

function envIdentity(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return env === process.env ? "process-env" : `custom:${requestIdentityKey(env)}`;
}

export function createProductDataProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: { enrichMatch?: boolean } = {},
): IDataProvider {
  const enrichMatch = options.enrichMatch ?? true;
  return oncePerRequestSync(
    requestMemoKey("product-provider", [envIdentity(env), enrichMatch]),
    () => {
      const hasKey = hasFootballApiKey(env);
      return createApiFootballDataProvider({
        env,
        enrichMatch,
        fallback: hasKey ? "error" : "recorded",
      });
    },
  );
}

export function createRecordedDataProvider(
  options: { enrichMatch?: boolean } = {},
): IDataProvider {
  const enrichMatch = options.enrichMatch ?? true;
  return oncePerRequestSync(
    requestMemoKey("recorded-provider", [enrichMatch]),
    () =>
      createApiFootballDataProvider({
        apiKey: null,
        fallback: "recorded",
        enrichMatch,
      }),
  );
}

function extrasFrom(provider: IDataProvider): FootballExtras | null {
  if (!(provider instanceof ApiFootballDataProvider)) return null;
  const http = provider.http;
  return {
    getTeam: (id) =>
      oncePerRequest(requestMemoKey("af:team", [id]), () => http.getTeam(id)),
    getTeamStatistics: (team, league, season) =>
      oncePerRequest(
        requestMemoKey("af:team-stats", [team, league, season]),
        () => http.getTeamStatistics(team, league, season),
      ),
    getStandings: (league, season) =>
      // Removed duplicate standings.getTable: Match Center enrich and Match
      // Analysis catalogue share this in-flight table per league+season.
      oncePerRequest(requestMemoKey("af:standings", [league, season]), () =>
        http.getStandings(league, season),
      ),
    getFixtureStatistics: (fixture) =>
      oncePerRequest(requestMemoKey("af:fixture-stats", [fixture]), () =>
        http.getFixtureStatistics(fixture),
      ),
    getFixtureOdds: (fixtureId) =>
      oncePerRequest(requestMemoKey("af:odds", [fixtureId]), () =>
        http.getFixtureOdds(fixtureId),
      ),
    getHeadToHead: (homeTeamId, awayTeamId, last) =>
      oncePerRequest(
        requestMemoKey("af:h2h", [homeTeamId, awayTeamId, last]),
        () => http.getHeadToHead(homeTeamId, awayTeamId, last),
      ),
    getInjuries: (query) =>
      oncePerRequest(
        requestMemoKey("af:injuries", [
          query.fixture,
          query.team,
          query.season,
        ]),
        () => http.getInjuries(query),
      ),
    getTeamLastFixtures: (team, last) =>
      oncePerRequest(
        requestMemoKey("af:fixtures:team", [team, last]),
        () => http.getTeamLastFixtures(team, last),
      ),
    getLineups: (fixture) =>
      // Removed duplicate /fixtures/lineups: getById already carried lineups
      // on the bundle; this memo covers list-only snapshots that still enrich.
      oncePerRequest(requestMemoKey("af:lineups", [fixture]), () =>
        http.getLineups(fixture),
      ),
    getEvents: (fixture) =>
      oncePerRequest(requestMemoKey("af:events", [fixture]), () =>
        http.getEvents(fixture),
      ),
    getPlayer: (id, season) =>
      oncePerRequest(requestMemoKey("af:player", [id, season]), () =>
        http.getPlayer(id, season),
      ),
    getLeague: (id) =>
      oncePerRequest(requestMemoKey("af:league", [id]), () =>
        http.getLeague(id),
      ),
  };
}

function resolveProvider(context: RepositoryContext = {}): IDataProvider {
  if (context.provider) return context.provider;
  const env = context.env ?? process.env;
  if (context.profile === "recorded") {
    return createRecordedDataProvider({ enrichMatch: context.enrichMatch });
  }
  return createProductDataProvider(env, { enrichMatch: context.enrichMatch });
}

function buildFootballSource(provider: IDataProvider): FootballSource {
  return {
    provider,
    id: provider.id,
    displayName: provider.displayName,
    dataMode: dataModeOf(provider),
    extras: extrasFrom(provider),
    // Removed duplicate getById: Dashboard featured match, Match Center,
    // Match Analysis, and Copilot share this in-flight promise per request.
    getMatch: (query) =>
      oncePerRequest(requestMemoKey("af:getMatch", [query.matchId]), () =>
        provider.getMatch(query),
      ),
    // Removed duplicate date/league lists: Dashboard today scan and
    // listCatalogue both call listFixtures({ date: today }).
    listFixtures: (query = {}) =>
      oncePerRequest(
        requestMemoKey("af:listFixtures", [
          query.date,
          query.leagueId,
          query.season,
          query.limit,
        ]),
        async () => (await provider.listFixtures?.(query)) ?? [],
      ),
  };
}

export function createFootballSource(
  context: RepositoryContext = {},
): FootballSource {
  const provider = resolveProvider(context);
  // One FootballSource per provider instance in this request (Sprint 2A).
  return oncePerRequestSync(
    requestMemoKey("source", [requestIdentityKey(provider)]),
    () => buildFootballSource(provider),
  );
}
