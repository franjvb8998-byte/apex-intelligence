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

export function createProductDataProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: { enrichMatch?: boolean } = {},
): IDataProvider {
  const hasKey = hasFootballApiKey(env);
  return createApiFootballDataProvider({
    env,
    enrichMatch: options.enrichMatch ?? true,
    fallback: hasKey ? "error" : "recorded",
  });
}

export function createRecordedDataProvider(
  options: { enrichMatch?: boolean } = {},
): IDataProvider {
  return createApiFootballDataProvider({
    apiKey: null,
    fallback: "recorded",
    enrichMatch: options.enrichMatch ?? true,
  });
}

function extrasFrom(provider: IDataProvider): FootballExtras | null {
  if (!(provider instanceof ApiFootballDataProvider)) return null;
  const http = provider.http;
  return {
    getTeam: (id) => http.getTeam(id),
    getTeamStatistics: (team, league, season) =>
      http.getTeamStatistics(team, league, season),
    getStandings: (league, season) => http.getStandings(league, season),
    getFixtureStatistics: (fixture) => http.getFixtureStatistics(fixture),
    getFixtureOdds: (fixtureId) => http.getFixtureOdds(fixtureId),
    getHeadToHead: (homeTeamId, awayTeamId, last) =>
      http.getHeadToHead(homeTeamId, awayTeamId, last),
    getInjuries: (query) => http.getInjuries(query),
    getTeamLastFixtures: (team, last) => http.getTeamLastFixtures(team, last),
    getLineups: (fixture) => http.getLineups(fixture),
    getEvents: (fixture) => http.getEvents(fixture),
    getPlayer: (id, season) => http.getPlayer(id, season),
    getLeague: (id) => http.getLeague(id),
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

export function createFootballSource(
  context: RepositoryContext = {},
): FootballSource {
  const provider = resolveProvider(context);
  return {
    provider,
    id: provider.id,
    displayName: provider.displayName,
    dataMode: dataModeOf(provider),
    extras: extrasFrom(provider),
    getMatch: (query) => provider.getMatch(query),
    listFixtures: async (query = {}) =>
      (await provider.listFixtures?.(query)) ?? [],
  };
}
