/**
 * Offline / no-key API-Football client backed by recorded fixtures.
 * Same surface as the live HTTP client — keeps BFF + provider working without credentials.
 */

import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballLeaguesResponse,
  createRecordedApiFootballOddsResponse,
  createRecordedApiFootballPlayersResponse,
  createRecordedApiFootballStandingsResponse,
  createRecordedApiFootballTeamStatisticsResponse,
  createRecordedApiFootballTeamsResponse,
  createRecordedApiFootballTodaysMatchesResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform/providers/api-football/fixtures";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import type {
  ApiFootballEventsResponse,
  ApiFootballLineupsResponse,
  ApiFootballOddsResponse,
  ApiFootballHeadToHeadResponse,
  ApiFootballInjuriesResponse,
  ApiFootballFixturesResponse,
  ApiFootballFixtureStatisticsResponse,
} from "@/lib/data-platform/providers/api-football/types";

export function createFixtureApiFootballClient(): ApiFootballClient {
  const client: ApiFootballClient = {
    async getFixture(id) {
      const payload = createRecordedApiFootballFixturesResponse();
      if (String(id) !== RECORDED_API_FOOTBALL_FIXTURE_ID) {
        return { ...payload, results: 0, response: [] };
      }
      return payload;
    },
    async getFixturesByDate(date) {
      return createRecordedApiFootballTodaysMatchesResponse(date);
    },
    async getFixturesByLeague(league, _season) {
      if (String(league) !== "39") {
        return emptyList<ApiFootballFixturesResponse>("fixtures");
      }
      return createRecordedApiFootballFixturesResponse();
    },
    async getTeamLastFixtures(team, last = 5) {
      return recordedTeamLastFixtures(team, last);
    },
    async getTeam(id) {
      return createRecordedApiFootballTeamsResponse(id);
    },
    async getStandings(league, season) {
      return createRecordedApiFootballStandingsResponse(league, season);
    },
    async getLineups(fixture) {
      const match = createRecordedApiFootballFixturesResponse();
      const item = match.response[0];
      const lineups = item?.lineups ?? [];
      if (String(fixture) !== RECORDED_API_FOOTBALL_FIXTURE_ID) {
        return emptyList<ApiFootballLineupsResponse>("fixtures/lineups");
      }
      return {
        get: "fixtures/lineups",
        parameters: { fixture: String(fixture) },
        errors: [],
        results: lineups.length,
        paging: { current: 1, total: 1 },
        response: lineups,
      };
    },
    async getEvents(fixture) {
      const match = createRecordedApiFootballFixturesResponse();
      const item = match.response[0];
      const events = item?.events ?? [];
      if (String(fixture) !== RECORDED_API_FOOTBALL_FIXTURE_ID) {
        return emptyList<ApiFootballEventsResponse>("fixtures/events");
      }
      return {
        get: "fixtures/events",
        parameters: { fixture: String(fixture) },
        errors: [],
        results: events.length,
        paging: { current: 1, total: 1 },
        response: events,
      };
    },
    async getFixtureById(fixtureId) {
      return client.getFixture(fixtureId);
    },
    async getFixtureEvents(fixtureId) {
      return client.getEvents(fixtureId);
    },
    async getFixtureStatistics(fixture) {
      return recordedFixtureStatistics(fixture);
    },
    async getFixtureOdds(fixtureId) {
      if (String(fixtureId) !== RECORDED_API_FOOTBALL_FIXTURE_ID) {
        return emptyList<ApiFootballOddsResponse>("odds");
      }
      return createRecordedApiFootballOddsResponse();
    },
    async getHeadToHead(homeTeamId, awayTeamId, last = 5) {
      return recordedHeadToHead(homeTeamId, awayTeamId, last);
    },
    async getInjuries(query) {
      return recordedInjuries(query);
    },
    async getPlayer(id, _season?) {
      return createRecordedApiFootballPlayersResponse(id);
    },
    async getLeague(id) {
      return createRecordedApiFootballLeaguesResponse(id);
    },
    async getTeamStatistics(team, league, season) {
      return createRecordedApiFootballTeamStatisticsResponse(team, league, season);
    },
  };

  return client;
}

function emptyList<T extends { response: unknown[] }>(get: string): T {
  return {
    get,
    parameters: {},
    errors: [],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [],
  } as unknown as T;
}

function recordedMiniFixture(options: {
  id: number;
  date: string;
  homeId: number;
  homeName: string;
  awayId: number;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
}): ApiFootballFixturesResponse["response"][number] {
  return {
    fixture: {
      id: options.id,
      date: options.date,
      status: { short: "FT", long: "Match Finished", elapsed: 90 },
    },
    league: { id: 39, name: "Premier League", country: "England", season: 2023 },
    teams: {
      home: { id: options.homeId, name: options.homeName },
      away: { id: options.awayId, name: options.awayName },
    },
    goals: { home: options.homeGoals, away: options.awayGoals },
  };
}

function recordedTeamLastFixtures(
  team: string | number,
  last: number,
): ApiFootballFixturesResponse {
  const teamId = Number(team);
  if (teamId !== 42 && teamId !== 49) {
    return emptyList<ApiFootballFixturesResponse>("fixtures");
  }
  const teamName = teamId === 42 ? "Arsenal" : "Chelsea";
  const oppId = teamId === 42 ? 49 : 42;
  const oppName = teamId === 42 ? "Chelsea" : "Arsenal";
  const rows: Array<{ home: boolean; gf: number; ga: number }> = [
    { home: true, gf: 2, ga: 0 },
    { home: false, gf: 1, ga: 1 },
    { home: true, gf: 3, ga: 1 },
    { home: false, gf: 0, ga: 2 },
    { home: true, gf: 2, ga: 1 },
  ].slice(0, Math.max(1, last));

  const response = rows.map((row, index) => {
    const homeId = row.home ? teamId : oppId;
    const homeName = row.home ? teamName : oppName;
    const awayId = row.home ? oppId : teamId;
    const awayName = row.home ? oppName : teamName;
    return recordedMiniFixture({
      id: 1034000 + teamId * 10 + index,
      date: `2024-03-${String(10 + index).padStart(2, "0")}T15:00:00+00:00`,
      homeId,
      homeName,
      awayId,
      awayName,
      homeGoals: row.home ? row.gf : row.ga,
      awayGoals: row.home ? row.ga : row.gf,
    });
  });

  return {
    get: "fixtures",
    parameters: { team: String(team), last: String(last) },
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  };
}

function recordedHeadToHead(
  homeTeamId: string | number,
  awayTeamId: string | number,
  last: number,
): ApiFootballHeadToHeadResponse {
  const ids = new Set([Number(homeTeamId), Number(awayTeamId)]);
  if (!ids.has(42) || !ids.has(49)) {
    return emptyList<ApiFootballHeadToHeadResponse>("fixtures/headtohead");
  }
  const meetings = [
    recordedMiniFixture({
      id: 1034101,
      date: "2023-10-21T16:30:00+00:00",
      homeId: 42,
      homeName: "Arsenal",
      awayId: 49,
      awayName: "Chelsea",
      homeGoals: 2,
      awayGoals: 2,
    }),
    recordedMiniFixture({
      id: 1034102,
      date: "2023-05-02T19:00:00+00:00",
      homeId: 49,
      homeName: "Chelsea",
      awayId: 42,
      awayName: "Arsenal",
      homeGoals: 1,
      awayGoals: 3,
    }),
    recordedMiniFixture({
      id: 1034103,
      date: "2022-11-06T16:30:00+00:00",
      homeId: 42,
      homeName: "Arsenal",
      awayId: 49,
      awayName: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    }),
  ].slice(0, Math.max(1, last));

  return {
    get: "fixtures/headtohead",
    parameters: { h2h: `${homeTeamId}-${awayTeamId}`, last: String(last) },
    errors: [],
    results: meetings.length,
    paging: { current: 1, total: 1 },
    response: meetings,
  };
}

function recordedInjuries(query: {
  fixture?: string | number;
  team?: string | number;
  season?: string | number;
}): ApiFootballInjuriesResponse {
  if (
    query.fixture != null &&
    String(query.fixture) !== RECORDED_API_FOOTBALL_FIXTURE_ID
  ) {
    return emptyList<ApiFootballInjuriesResponse>("injuries");
  }
  if (
    query.fixture == null &&
    query.team != null &&
    String(query.team) !== "42" &&
    String(query.team) !== "49"
  ) {
    return emptyList<ApiFootballInjuriesResponse>("injuries");
  }

  const response: ApiFootballInjuriesResponse["response"] = [
    {
      player: {
        id: 19545,
        name: "T. Partey",
        type: "Missing Fixture",
        reason: "Injured",
      },
      team: { id: 42, name: "Arsenal" },
      fixture: { id: Number(RECORDED_API_FOOTBALL_FIXTURE_ID) },
    },
    {
      player: {
        id: 19524,
        name: "R. James",
        type: "Missing Fixture",
        reason: "Suspended",
      },
      team: { id: 49, name: "Chelsea" },
      fixture: { id: Number(RECORDED_API_FOOTBALL_FIXTURE_ID) },
    },
  ];

  return {
    get: "injuries",
    parameters: {
      fixture: query.fixture != null ? String(query.fixture) : "",
    },
    errors: [],
    results: response.length,
    paging: { current: 1, total: 1 },
    response,
  };
}

function recordedFixtureStatistics(
  fixture: string,
): ApiFootballFixtureStatisticsResponse {
  if (String(fixture) !== RECORDED_API_FOOTBALL_FIXTURE_ID) {
    return emptyList<ApiFootballFixtureStatisticsResponse>(
      "fixtures/statistics",
    );
  }
  return {
    get: "fixtures/statistics",
    parameters: { fixture: String(fixture) },
    errors: [],
    results: 2,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: { id: 42, name: "Arsenal" },
        statistics: [
          { type: "Ball Possession", value: "58%" },
          { type: "Total Shots", value: 14 },
          { type: "Shots on Goal", value: 6 },
          { type: "expected_goals", value: "1.82" },
        ],
      },
      {
        team: { id: 49, name: "Chelsea" },
        statistics: [
          { type: "Ball Possession", value: "42%" },
          { type: "Total Shots", value: 9 },
          { type: "Shots on Goal", value: 3 },
          { type: "expected_goals", value: "0.94" },
        ],
      },
    ],
  };
}
