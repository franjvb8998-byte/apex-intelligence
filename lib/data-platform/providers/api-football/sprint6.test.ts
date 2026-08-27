/**
 * Sprint 6 — API-Football Real Data v1 compilation + behaviour tests.
 */

import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "@/lib/data-platform/cache";
import {
  adaptApiFootballLeague,
  adaptApiFootballPlayer,
  adaptApiFootballTeam,
  adaptApiFootballTeamStatistics,
  ApiFootballDataProvider,
  createApiFootballClient,
  createFixtureApiFootballClient,
  createRecordedApiFootballLeaguesResponse,
  createRecordedApiFootballPlayersResponse,
  createRecordedApiFootballTeamStatisticsResponse,
  createRecordedApiFootballTeamsResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  RECORDED_API_FOOTBALL_LEAGUE_ID,
  RECORDED_API_FOOTBALL_PLAYER_ID,
  RECORDED_API_FOOTBALL_TEAM_ID,
  withApiFootballClientCache,
} from "@/lib/data-platform/providers/api-football";
import { ProviderFactory } from "@/lib/data-platform/provider-factory";
import {
  getLeague,
  getPlayer,
  getTeamStatistics,
} from "@/lib/bff";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API-Football Sprint 6 — fixtures fallback", () => {
  it("uses recorded fixtures when API key is missing", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });

    expect(provider.dataMode).toBe("recorded");
    const bundle = await provider.getMatch({
      matchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    expect(bundle.homeTeam.name).toBe("Arsenal");
    expect(bundle.awayTeam.name).toBe("Chelsea");
  });

  it("lists today's matches from fixtures without a key", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });
    const list = await provider.listFixtures({ date: "2024-04-23" });
    expect(list.length).toBeGreaterThan(0);
  });

  it("lists fixtures by league and season", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });
    const list = await provider.listFixtures({
      leagueId: "39",
      season: "2025",
      limit: 20,
    });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.homeTeam.name).toBe("Arsenal");
  });

  it("ProviderFactory api-football without key does not throw", () => {
    const provider = ProviderFactory.create({
      provider: "api-football",
      env: {},
      apiFootball: { apiKey: null, env: {}, useCache: false },
    });
    expect(provider.id).toBe("api-football");
  });

  it("throws when fallback=error and key missing", () => {
    expect(
      () =>
        new ApiFootballDataProvider({
          apiKey: null,
          env: {},
          fallback: "error",
        }),
    ).toThrow(/API_FOOTBALL_KEY|API_KEY/i);
  });
});

describe("API-Football Sprint 6 — client endpoints", () => {
  it("calls team statistics, player, and league endpoints", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/teams/statistics")) {
        return jsonResponse(createRecordedApiFootballTeamStatisticsResponse());
      }
      if (url.includes("/players")) {
        return jsonResponse(createRecordedApiFootballPlayersResponse());
      }
      if (url.includes("/leagues")) {
        return jsonResponse(createRecordedApiFootballLeaguesResponse());
      }
      return jsonResponse({ response: [] });
    });

    const client = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });

    await client.getTeamStatistics(42, 39, 2023);
    await client.getPlayer("1467", 2023);
    await client.getLeague("39");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes("/teams/statistics"))).toBe(true);
    expect(urls.some((u) => u.includes("/players"))).toBe(true);
    expect(urls.some((u) => u.includes("/leagues"))).toBe(true);
  });

  it("fixture client serves offline catalogue", async () => {
    const client = createFixtureApiFootballClient();
    const team = await client.getTeam(RECORDED_API_FOOTBALL_TEAM_ID);
    const player = await client.getPlayer(RECORDED_API_FOOTBALL_PLAYER_ID);
    const league = await client.getLeague(RECORDED_API_FOOTBALL_LEAGUE_ID);
    const stats = await client.getTeamStatistics(42, 39, 2023);
    const standings = await client.getStandings(39, 2023);

    expect(team.response[0]?.team.name).toBe("Arsenal");
    expect(player.response[0]?.player.name).toBe("B. Saka");
    expect(league.response[0]?.league.name).toBe("Premier League");
    expect(stats.response.fixtures.played.total).toBe(38);
    expect(standings.response[0]?.league.standings[0]?.length).toBeGreaterThan(
      0,
    );
  });
});

describe("API-Football Sprint 6 — adapters", () => {
  it("maps vendor DTOs to Apex entities", () => {
    const team = adaptApiFootballTeam(
      createRecordedApiFootballTeamsResponse().response[0]!,
    );
    const player = adaptApiFootballPlayer(
      createRecordedApiFootballPlayersResponse().response[0]!,
    );
    const league = adaptApiFootballLeague(
      createRecordedApiFootballLeaguesResponse().response[0]!,
    );
    const stats = adaptApiFootballTeamStatistics(
      createRecordedApiFootballTeamStatisticsResponse().response,
    );

    expect(team.id).toContain("apex:api-football:team:");
    expect(player.name).toBe("B. Saka");
    expect(league.name).toBe("Premier League");
    expect(stats?.wins).toBe(28);
  });

  it("does not crash when team statistics payload is empty", () => {
    expect(adaptApiFootballTeamStatistics(undefined)).toBeNull();
    expect(adaptApiFootballTeamStatistics({} as never)).toBeNull();
  });
});

describe("API-Football Sprint 6 — cache", () => {
  it("caches repeated client calls", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(createRecordedApiFootballTeamsResponse()),
    );
    const inner = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });
    const cache = createTtlCache({ defaultTtlMs: 60_000 });
    const client = withApiFootballClientCache(inner, cache, 60_000);

    await client.getTeam("42");
    await client.getTeam("42");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("BFF Sprint 6 — player / league / team statistics", () => {
  it("returns recorded player/league/stats via api-football provider", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: null,
      env: {},
      useCache: false,
    });

    const player = await getPlayer(
      { id: RECORDED_API_FOOTBALL_PLAYER_ID, season: "2023" },
      { provider },
    );
    const league = await getLeague(RECORDED_API_FOOTBALL_LEAGUE_ID, {
      provider,
    });
    const stats = await getTeamStatistics(
      {
        team: RECORDED_API_FOOTBALL_TEAM_ID,
        league: RECORDED_API_FOOTBALL_LEAGUE_ID,
        season: "2023",
      },
      { provider },
    );

    expect(player.player.name).toBe("B. Saka");
    expect(league.league.name).toBe("Premier League");
    expect(stats.statistics.played).toBe(38);
  });
});
