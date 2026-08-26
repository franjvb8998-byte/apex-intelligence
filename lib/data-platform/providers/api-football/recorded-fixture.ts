/**
 * Recorded API-Football fixtures payload (real vendor shape).
 * Used when no API key is configured and in unit tests — not invented MockFixturePayload.
 *
 * Fixture: Arsenal 2–1 Chelsea · Premier League (recorded sample).
 * External id: {@link RECORDED_API_FOOTBALL_FIXTURE_ID}
 */

import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";

/** Default demo fixture id for Match Center + offline mode. */
export const RECORDED_API_FOOTBALL_FIXTURE_ID = "1035089";

export function createRecordedApiFootballFixturesResponse(): ApiFootballFixturesResponse {
  return {
    get: "fixtures",
    parameters: { id: RECORDED_API_FOOTBALL_FIXTURE_ID },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: Number(RECORDED_API_FOOTBALL_FIXTURE_ID),
          referee: "M. Oliver",
          timezone: "UTC",
          date: "2024-04-23T19:00:00+00:00",
          timestamp: 1713898800,
          venue: {
            id: 494,
            name: "Emirates Stadium",
            city: "London",
          },
          status: {
            long: "Match Finished",
            short: "FT",
            elapsed: 90,
          },
        },
        league: {
          id: 39,
          name: "Premier League",
          country: "England",
          season: 2023,
          round: "Regular Season - 34",
        },
        teams: {
          home: {
            id: 42,
            name: "Arsenal",
            logo: "https://media.api-sports.io/football/teams/42.png",
            winner: true,
          },
          away: {
            id: 49,
            name: "Chelsea",
            logo: "https://media.api-sports.io/football/teams/49.png",
            winner: false,
          },
        },
        goals: { home: 2, away: 1 },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: null,
          penalty: null,
        },
        events: [
          {
            time: { elapsed: 1, extra: null },
            team: { id: 42, name: "Arsenal" },
            player: { id: 1, name: null },
            assist: null,
            type: "Var",
            detail: "Goal cancelled",
            comments: null,
          },
          {
            time: { elapsed: 24, extra: null },
            team: { id: 42, name: "Arsenal" },
            player: { id: 1467, name: "B. Saka" },
            assist: { id: 643, name: "M. Ødegaard" },
            type: "Goal",
            detail: "Normal Goal",
            comments: null,
          },
          {
            time: { elapsed: 52, extra: null },
            team: { id: 49, name: "Chelsea" },
            player: { id: 2208, name: "C. Palmer" },
            assist: { id: null, name: null },
            type: "Goal",
            detail: "Penalty",
            comments: null,
          },
          {
            time: { elapsed: 67, extra: null },
            team: { id: 42, name: "Arsenal" },
            player: { id: 643, name: "M. Ødegaard" },
            assist: { id: 1467, name: "B. Saka" },
            type: "Goal",
            detail: "Normal Goal",
            comments: null,
          },
          {
            time: { elapsed: 78, extra: null },
            team: { id: 49, name: "Chelsea" },
            player: { id: 2935, name: "M. Caicedo" },
            assist: null,
            type: "Card",
            detail: "Yellow Card",
            comments: null,
          },
        ],
        lineups: [
          {
            team: { id: 42, name: "Arsenal" },
            formation: "4-3-3",
            startXI: [
              {
                player: {
                  id: 643,
                  name: "M. Ødegaard",
                  number: 8,
                  pos: "M",
                },
              },
              {
                player: {
                  id: 1467,
                  name: "B. Saka",
                  number: 7,
                  pos: "F",
                },
              },
            ],
            substitutes: [],
          },
          {
            team: { id: 49, name: "Chelsea" },
            formation: "4-2-3-1",
            startXI: [
              {
                player: {
                  id: 2208,
                  name: "C. Palmer",
                  number: 20,
                  pos: "M",
                },
              },
            ],
            substitutes: [],
          },
        ],
      },
    ],
  };
}
