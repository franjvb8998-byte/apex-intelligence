/**
 * Recorded API-Football fixtures payload (real vendor shape).
 * Used when no API key is configured and in unit tests — not invented MockFixturePayload.
 *
 * Fixture: Arsenal 2–1 Chelsea · Premier League (recorded sample).
 * External id: {@link RECORDED_API_FOOTBALL_FIXTURE_ID}
 */

import type {
  ApiFootballFixturesResponse,
  ApiFootballOddsBookmaker,
  ApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/types";

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

function recordedBookmaker(
  id: number,
  name: string,
  odds: {
    home: string;
    draw: string;
    away: string;
    over: string;
    under: string;
    bttsYes: string;
    bttsNo: string;
  },
): ApiFootballOddsBookmaker {
  return {
    id,
    name,
    bets: [
      {
        id: 1,
        name: "Match Winner",
        values: [
          { value: "Home", odd: odds.home },
          { value: "Draw", odd: odds.draw },
          { value: "Away", odd: odds.away },
        ],
      },
      {
        id: 5,
        name: "Goals Over/Under",
        values: [
          { value: "Over 2.5", odd: odds.over },
          { value: "Under 2.5", odd: odds.under },
        ],
      },
      {
        id: 8,
        name: "Both Teams Score",
        values: [
          { value: "Yes", odd: odds.bttsYes },
          { value: "No", odd: odds.bttsNo },
        ],
      },
    ],
  };
}

/**
 * Recorded GET /odds payload for the Arsenal–Chelsea sample.
 * Multiple bookmakers so Match Center can highlight the best available price.
 */
export function createRecordedApiFootballOddsResponse(): ApiFootballOddsResponse {
  const bookmakers = [
    recordedBookmaker(8, "Bet365", {
      home: "1.65",
      draw: "4.20",
      away: "5.00",
      over: "1.72",
      under: "2.10",
      bttsYes: "1.66",
      bttsNo: "2.20",
    }),
    recordedBookmaker(11, "1xBet", {
      home: "1.70",
      draw: "4.10",
      away: "5.20",
      over: "1.80",
      under: "2.00",
      bttsYes: "1.72",
      bttsNo: "2.15",
    }),
    recordedBookmaker(4, "Pinnacle", {
      home: "1.68",
      draw: "4.33",
      away: "5.10",
      over: "1.75",
      under: "2.20",
      bttsYes: "1.70",
      bttsNo: "2.30",
    }),
  ];

  return {
    get: "odds",
    parameters: { fixture: RECORDED_API_FOOTBALL_FIXTURE_ID },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: { id: 39, name: "Premier League" },
        fixture: { id: Number(RECORDED_API_FOOTBALL_FIXTURE_ID) },
        bookmakers,
      },
    ],
  };
}
