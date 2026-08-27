/**
 * API-Football REST client (api-sports.io v3).
 * Auth header, retry, and rate limiting included.
 * Returns vendor JSON only — mapping happens in adapters/mapper.
 */

import type { HttpClient } from "@/lib/data-platform/http";
import { createHttpClient } from "@/lib/data-platform/http";
import type { TtlCache } from "@/lib/data-platform/cache";
import {
  API_FOOTBALL_DEFAULT_BASE_URL,
  readApiFootballConfig,
  type ApiFootballConfig,
} from "@/lib/data-platform/providers/api-football/config";
import {
  ApiFootballError,
  toApiFootballError,
} from "@/lib/data-platform/providers/api-football/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/lib/data-platform/providers/api-football/rate-limiter";
import { withRetry } from "@/lib/data-platform/providers/api-football/retry";
import type {
  ApiFootballEventsResponse,
  ApiFootballFixturesResponse,
  ApiFootballLeaguesResponse,
  ApiFootballLineupsResponse,
  ApiFootballOddsResponse,
  ApiFootballPlayersResponse,
  ApiFootballStandingsResponse,
  ApiFootballTeamStatisticsResponse,
  ApiFootballTeamsResponse,
  ApiFootballHeadToHeadResponse,
  ApiFootballInjuriesResponse,
} from "@/lib/data-platform/providers/api-football/types";

export type ApiFootballClientOptions = {
  apiKey: string;
  baseUrl?: string;
  httpClient?: HttpClient;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  config?: Partial<ApiFootballConfig>;
  rateLimiter?: RateLimiter;
  /** Disable retry (tests). Default true. */
  retry?: boolean;
};

export type ApiFootballClient = {
  /** Match details */
  getFixture(id: string): Promise<ApiFootballFixturesResponse>;
  /** Today's (or any date) matches */
  getFixturesByDate(date: string): Promise<ApiFootballFixturesResponse>;
  getFixturesByLeague(
    league: string | number,
    season: string | number,
  ): Promise<ApiFootballFixturesResponse>;
  getTeam(id: string): Promise<ApiFootballTeamsResponse>;
  getTeamStatistics(
    team: string | number,
    league: string | number,
    season: string | number,
  ): Promise<ApiFootballTeamStatisticsResponse>;
  getPlayer(
    id: string,
    season?: string | number,
  ): Promise<ApiFootballPlayersResponse>;
  getLeague(id: string): Promise<ApiFootballLeaguesResponse>;
  getStandings(
    league: string | number,
    season: string | number,
  ): Promise<ApiFootballStandingsResponse>;
  getLineups(fixture: string): Promise<ApiFootballLineupsResponse>;
  getEvents(fixture: string): Promise<ApiFootballEventsResponse>;

  /** @deprecated Use getFixture */
  getFixtureById(fixtureId: string): Promise<ApiFootballFixturesResponse>;
  /** @deprecated Use getEvents */
  getFixtureEvents(fixtureId: string): Promise<ApiFootballEventsResponse>;
  /** Legacy odds helper kept for recorded/ingest adapter compatibility. */
  getFixtureOdds(fixtureId: string): Promise<ApiFootballOddsResponse>;
  getHeadToHead(
    homeTeamId: string | number,
    awayTeamId: string | number,
    last?: number,
  ): Promise<ApiFootballHeadToHeadResponse>;
  getInjuries(query: {
    fixture?: string | number;
    team?: string | number;
    season?: string | number;
  }): Promise<ApiFootballInjuriesResponse>;
};

function assertApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    throw new ApiFootballError({
      message: "API_FOOTBALL_KEY is required for live HTTP calls",
      code: "missing_api_key",
    });
  }
}

/**
 * Create an authenticated API-Football client with retry + rate limiting.
 */
export function createApiFootballClient(
  options: ApiFootballClientOptions,
): ApiFootballClient {
  assertApiKey(options.apiKey);

  const envConfig = readApiFootballConfig();
  const retryEnabled = options.retry !== false;
  const maxAttempts = options.config?.retryMaxAttempts ?? envConfig.retryMaxAttempts;
  const baseDelayMs =
    options.config?.retryBaseDelayMs ?? envConfig.retryBaseDelayMs;
  const timeoutMs =
    options.timeoutMs ?? options.config?.timeoutMs ?? envConfig.timeoutMs;

  const rateLimiter =
    options.rateLimiter ??
    createRateLimiter({
      maxRequests:
        options.config?.rateLimitMaxRequests ?? envConfig.rateLimitMaxRequests,
      windowMs:
        options.config?.rateLimitWindowMs ?? envConfig.rateLimitWindowMs,
    });

  const http =
    options.httpClient ??
    createHttpClient({
      baseUrl: options.baseUrl ?? API_FOOTBALL_DEFAULT_BASE_URL,
      providerId: "api-football",
      timeoutMs,
      fetchImpl: options.fetchImpl,
      defaultHeaders: {
        "x-apisports-key": options.apiKey,
      },
    });

  async function get<T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const run = async () => {
      await rateLimiter.acquire();
      try {
        const { data } = await http.get<T>(path, query);
        return data;
      } catch (error) {
        throw toApiFootballError(error);
      }
    };

    if (!retryEnabled) return run();
    return withRetry(run, { maxAttempts, baseDelayMs });
  }

  const client: ApiFootballClient = {
    getFixture(id) {
      return get<ApiFootballFixturesResponse>("/fixtures", { id });
    },
    getFixturesByDate(date) {
      return get<ApiFootballFixturesResponse>("/fixtures", { date });
    },
    getFixturesByLeague(league, season) {
      return get<ApiFootballFixturesResponse>("/fixtures", {
        league,
        season,
      });
    },
    getTeam(id) {
      return get<ApiFootballTeamsResponse>("/teams", { id });
    },
    getTeamStatistics(team, league, season) {
      return get<ApiFootballTeamStatisticsResponse>("/teams/statistics", {
        team,
        league,
        season,
      });
    },
    getPlayer(id, season) {
      return get<ApiFootballPlayersResponse>("/players", {
        id,
        season,
      });
    },
    getLeague(id) {
      return get<ApiFootballLeaguesResponse>("/leagues", { id });
    },
    getStandings(league, season) {
      return get<ApiFootballStandingsResponse>("/standings", {
        league,
        season,
      });
    },
    getLineups(fixture) {
      return get<ApiFootballLineupsResponse>("/fixtures/lineups", { fixture });
    },
    getEvents(fixture) {
      return get<ApiFootballEventsResponse>("/fixtures/events", { fixture });
    },
    getFixtureById(fixtureId) {
      return client.getFixture(fixtureId);
    },
    getFixtureEvents(fixtureId) {
      return client.getEvents(fixtureId);
    },
    getFixtureOdds(fixtureId) {
      return get<ApiFootballOddsResponse>("/odds", { fixture: fixtureId });
    },
    getHeadToHead(homeTeamId, awayTeamId, last = 5) {
      return get<ApiFootballHeadToHeadResponse>("/fixtures/headtohead", {
        h2h: `${homeTeamId}-${awayTeamId}`,
        last,
      });
    },
    getInjuries(query) {
      return get<ApiFootballInjuriesResponse>("/injuries", {
        fixture: query.fixture,
        team: query.team,
        season: query.season,
      });
    },
  };

  return client;
}

/**
 * Wrap a client with a simple in-memory TTL cache (Sprint 6).
 */
export function withApiFootballClientCache(
  client: ApiFootballClient,
  cache: TtlCache,
  ttlMs = 60_000,
): ApiFootballClient {
  async function cached<T>(
    key: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const hit = cache.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await run();
    cache.set(key, value, ttlMs);
    return value;
  }

  return {
    getFixture: (id) =>
      cached(`af:fixture:${id}`, () => client.getFixture(id)),
    getFixturesByDate: (date) =>
      cached(`af:fixtures:date:${date}`, () => client.getFixturesByDate(date)),
    getFixturesByLeague: (league, season) =>
      cached(`af:fixtures:league:${league}:${season}`, () =>
        client.getFixturesByLeague(league, season),
      ),
    getTeam: (id) => cached(`af:team:${id}`, () => client.getTeam(id)),
    getTeamStatistics: (team, league, season) =>
      cached(`af:team-stats:${team}:${league}:${season}`, () =>
        client.getTeamStatistics(team, league, season),
      ),
    getPlayer: (id, season) =>
      cached(`af:player:${id}:${season ?? ""}`, () =>
        client.getPlayer(id, season),
      ),
    getLeague: (id) => cached(`af:league:${id}`, () => client.getLeague(id)),
    getStandings: (league, season) =>
      cached(`af:standings:${league}:${season}`, () =>
        client.getStandings(league, season),
      ),
    getLineups: (fixture) =>
      cached(`af:lineups:${fixture}`, () => client.getLineups(fixture)),
    getEvents: (fixture) =>
      cached(`af:events:${fixture}`, () => client.getEvents(fixture)),
    getFixtureById: (fixtureId) =>
      cached(`af:fixture:${fixtureId}`, () => client.getFixtureById(fixtureId)),
    getFixtureEvents: (fixtureId) =>
      cached(`af:events:${fixtureId}`, () => client.getFixtureEvents(fixtureId)),
    getFixtureOdds: (fixtureId) =>
      cached(`af:odds:${fixtureId}`, () => client.getFixtureOdds(fixtureId)),
    getHeadToHead: (homeTeamId, awayTeamId, last) =>
      cached(`af:h2h:${homeTeamId}:${awayTeamId}:${last ?? 5}`, () =>
        client.getHeadToHead(homeTeamId, awayTeamId, last),
      ),
    getInjuries: (query) =>
      cached(
        `af:injuries:${query.fixture ?? ""}:${query.team ?? ""}:${query.season ?? ""}`,
        () => client.getInjuries(query),
      ),
  };
}

/**
 * Build a live client from process env when `API_FOOTBALL_KEY` is set.
 * Returns null when the key is missing.
 */
export function tryCreateApiFootballClientFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  overrides: Omit<ApiFootballClientOptions, "apiKey" | "baseUrl"> = {},
): ApiFootballClient | null {
  const config = readApiFootballConfig(env);
  if (!config.apiKey) return null;
  return createApiFootballClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    config,
    ...overrides,
  });
}
