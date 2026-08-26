/**
 * Offline / no-key API-Football client backed by recorded fixtures.
 * Same surface as the live HTTP client — keeps BFF + provider working without credentials.
 */

import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballLeaguesResponse,
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
    async getFixtureOdds(_fixtureId) {
      return emptyList<ApiFootballOddsResponse>("odds");
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
