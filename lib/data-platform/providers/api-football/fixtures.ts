/**
 * Recorded API-Football payloads for offline / no-API-KEY mode (Sprint 6).
 * Keeps the app working without live credentials.
 */

import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform/providers/api-football/recorded-fixture";
import type {
  ApiFootballFixturesResponse,
  ApiFootballLeaguesResponse,
  ApiFootballPlayersResponse,
  ApiFootballStandingsResponse,
  ApiFootballTeamStatisticsResponse,
  ApiFootballTeamsResponse,
} from "@/lib/data-platform/providers/api-football/types";

export {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
};

/** Arsenal (home side of recorded fixture). */
export const RECORDED_API_FOOTBALL_TEAM_ID = "42";
/** Bukayo Saka (from recorded lineup). */
export const RECORDED_API_FOOTBALL_PLAYER_ID = "1467";
/** Premier League. */
export const RECORDED_API_FOOTBALL_LEAGUE_ID = "39";
export const RECORDED_API_FOOTBALL_SEASON = 2023;

export function createRecordedApiFootballTeamsResponse(
  teamId: string = RECORDED_API_FOOTBALL_TEAM_ID,
): ApiFootballTeamsResponse {
  const id = Number(teamId) || Number(RECORDED_API_FOOTBALL_TEAM_ID);
  const isChelsea = id === 49;
  return {
    get: "teams",
    parameters: { id: String(id) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        team: {
          id,
          name: isChelsea ? "Chelsea" : "Arsenal",
          code: isChelsea ? "CHE" : "ARS",
          country: "England",
          founded: isChelsea ? 1905 : 1886,
          national: false,
          logo: `https://media.api-sports.io/football/teams/${id}.png`,
        },
        venue: {
          id: isChelsea ? 519 : 494,
          name: isChelsea ? "Stamford Bridge" : "Emirates Stadium",
          city: "London",
          capacity: isChelsea ? 40341 : 60704,
          surface: "grass",
        },
      },
    ],
  };
}

export function createRecordedApiFootballPlayersResponse(
  playerId: string = RECORDED_API_FOOTBALL_PLAYER_ID,
): ApiFootballPlayersResponse {
  const id = Number(playerId) || Number(RECORDED_API_FOOTBALL_PLAYER_ID);
  return {
    get: "players",
    parameters: { id: String(id), season: String(RECORDED_API_FOOTBALL_SEASON) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        player: {
          id,
          name: id === 643 ? "M. Ødegaard" : "B. Saka",
          firstname: id === 643 ? "Martin" : "Bukayo",
          lastname: id === 643 ? "Ødegaard" : "Saka",
          age: id === 643 ? 25 : 22,
          nationality: id === 643 ? "Norway" : "England",
          height: "178 cm",
          weight: "72 kg",
          injured: false,
          photo: `https://media.api-sports.io/football/players/${id}.png`,
        },
        statistics: [
          {
            team: {
              id: 42,
              name: "Arsenal",
              logo: "https://media.api-sports.io/football/teams/42.png",
            },
            league: {
              id: 39,
              name: "Premier League",
              country: "England",
              season: RECORDED_API_FOOTBALL_SEASON,
            },
            games: {
              appearences: 35,
              lineups: 34,
              minutes: 2900,
              number: id === 643 ? 8 : 7,
              position: id === 643 ? "Midfielder" : "Attacker",
              rating: "7.40",
              captain: id === 643,
            },
          },
        ],
      },
    ],
  };
}

export function createRecordedApiFootballLeaguesResponse(
  leagueId: string = RECORDED_API_FOOTBALL_LEAGUE_ID,
): ApiFootballLeaguesResponse {
  const id = Number(leagueId) || Number(RECORDED_API_FOOTBALL_LEAGUE_ID);
  return {
    get: "leagues",
    parameters: { id: String(id) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: {
          id,
          name: "Premier League",
          type: "League",
          logo: "https://media.api-sports.io/football/leagues/39.png",
        },
        country: {
          name: "England",
          code: "GB-ENG",
          flag: "https://media.api-sports.io/flags/gb-eng.svg",
        },
        seasons: [
          {
            year: RECORDED_API_FOOTBALL_SEASON,
            start: "2023-08-11",
            end: "2024-05-19",
            current: false,
          },
          {
            year: 2024,
            start: "2024-08-16",
            end: "2025-05-25",
            current: true,
          },
        ],
      },
    ],
  };
}

export function createRecordedApiFootballStandingsResponse(
  league: string | number = RECORDED_API_FOOTBALL_LEAGUE_ID,
  season: string | number = RECORDED_API_FOOTBALL_SEASON,
): ApiFootballStandingsResponse {
  return {
    get: "standings",
    parameters: { league: String(league), season: String(season) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: {
          id: Number(league) || 39,
          name: "Premier League",
          country: "England",
          logo: "https://media.api-sports.io/football/leagues/39.png",
          season: Number(season) || RECORDED_API_FOOTBALL_SEASON,
          standings: [
            [
              {
                rank: 1,
                team: {
                  id: 42,
                  name: "Arsenal",
                  logo: "https://media.api-sports.io/football/teams/42.png",
                },
                points: 89,
                goalsDiff: 62,
                form: "WWWWW",
                all: {
                  played: 38,
                  win: 28,
                  draw: 5,
                  lose: 5,
                  goals: { for: 91, against: 29 },
                },
              },
              {
                rank: 2,
                team: {
                  id: 49,
                  name: "Chelsea",
                  logo: "https://media.api-sports.io/football/teams/49.png",
                },
                points: 63,
                goalsDiff: 14,
                form: "WDWLW",
                all: {
                  played: 38,
                  win: 18,
                  draw: 9,
                  lose: 11,
                  goals: { for: 77, against: 63 },
                },
              },
            ],
          ],
        },
      },
    ],
  };
}

export function createRecordedApiFootballTeamStatisticsResponse(
  team: string | number = RECORDED_API_FOOTBALL_TEAM_ID,
  league: string | number = RECORDED_API_FOOTBALL_LEAGUE_ID,
  season: string | number = RECORDED_API_FOOTBALL_SEASON,
): ApiFootballTeamStatisticsResponse {
  const teamId = Number(team) || 42;
  return {
    get: "teams/statistics",
    parameters: {
      team: String(teamId),
      league: String(league),
      season: String(season),
    },
    errors: [],
    results: 1,
    response: {
      league: {
        id: Number(league) || 39,
        name: "Premier League",
        country: "England",
        season: Number(season) || RECORDED_API_FOOTBALL_SEASON,
      },
      team: {
        id: teamId,
        name: teamId === 49 ? "Chelsea" : "Arsenal",
        logo: `https://media.api-sports.io/football/teams/${teamId}.png`,
      },
      form: "WWDLW",
      fixtures: {
        played: { home: 19, away: 19, total: 38 },
        wins: { home: 15, away: 13, total: 28 },
        draws: { home: 2, away: 3, total: 5 },
        loses: { home: 2, away: 3, total: 5 },
      },
      goals: {
        for: {
          total: { home: 48, away: 43, total: 91 },
          average: { home: "2.5", away: "2.3", total: "2.4" },
        },
        against: {
          total: { home: 12, away: 17, total: 29 },
          average: { home: "0.6", away: "0.9", total: "0.8" },
        },
      },
      clean_sheet: { home: 12, away: 6, total: 18 },
      failed_to_score: { home: 2, away: 4, total: 6 },
    },
  };
}

/** Today's matches offline: reuse the recorded fixture as a one-item day list. */
export function createRecordedApiFootballTodaysMatchesResponse(
  date?: string,
): ApiFootballFixturesResponse {
  const base = createRecordedApiFootballFixturesResponse();
  return {
    ...base,
    get: "fixtures",
    parameters: {
      date: date ?? new Date().toISOString().slice(0, 10),
    },
  };
}
