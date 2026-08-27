import { describe, expect, it } from "vitest";
import { formatApiFootballWeather } from "@/lib/data-platform/providers/api-football/mapper";
import {
  mergeTeamTrends,
  standingFromTable,
  summarizeHeadToHead,
  trendsFromRecent,
} from "@/lib/match-center/prematch";
import type { MatchCenterRecentMatch } from "@/lib/match-center/types";

function recent(
  goalsFor: number,
  goalsAgainst: number,
): MatchCenterRecentMatch {
  return {
    id: `${goalsFor}-${goalsAgainst}`,
    kickoffAt: "2024-03-10T15:00:00+00:00",
    opponentName: "Rival",
    home: true,
    goalsFor,
    goalsAgainst,
    result:
      goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
  };
}

describe("pre-match trends", () => {
  it("computes last-5 averages, clean sheets, BTTS and over 2.5", () => {
    const trends = trendsFromRecent([
      recent(2, 0),
      recent(1, 1),
      recent(3, 1),
      recent(0, 2),
      recent(2, 1),
    ]);
    expect(trends.recentSample).toBe(5);
    expect(trends.goalsScoredAvg).toBe(1.6);
    expect(trends.goalsConcededAvg).toBe(1);
    expect(trends.cleanSheets).toBe(1);
    expect(trends.bttsPct).toBe(0.6);
    expect(trends.over25Pct).toBe(0.4);
  });

  it("returns empty rates when there are no scored matches", () => {
    expect(trendsFromRecent([])).toMatchObject({
      recentSample: 0,
      goalsScoredAvg: null,
      bttsPct: null,
    });
  });

  it("falls back to season averages when last-5 is empty", () => {
    const merged = mergeTeamTrends([], {
      goalsForAverage: 2.4,
      goalsAgainstAverage: 0.8,
      cleanSheets: 18,
    });
    expect(merged).toMatchObject({
      recentSample: 0,
      goalsScoredAvg: 2.4,
      goalsConcededAvg: 0.8,
      seasonCleanSheets: 18,
      bttsPct: null,
    });
  });

  it("returns null when neither last-5 nor season stats exist", () => {
    expect(mergeTeamTrends([])).toBeNull();
  });
});

describe("standings mapper", () => {
  it("reads both teams from a league table", () => {
    const payload = [
      {
        league: {
          id: 39,
          name: "Premier League",
          season: 2023,
          standings: [
            [
              {
                rank: 1,
                team: { id: 42, name: "Arsenal" },
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
            ],
          ],
        },
      },
    ];
    expect(standingFromTable(payload, "42")).toMatchObject({
      rank: 1,
      points: 89,
      teamName: "Arsenal",
      goalsDiff: 62,
    });
    expect(standingFromTable(payload, "49")).toBeNull();
  });
});

describe("H2H summary", () => {
  it("counts home/away wins, BTTS and over 2.5", () => {
    const summary = summarizeHeadToHead([
      {
        id: "1",
        kickoffAt: "2023-10-21T16:30:00+00:00",
        homeTeamName: "Arsenal",
        awayTeamName: "Chelsea",
        homeGoals: 2,
        awayGoals: 2,
      },
      {
        id: "2",
        kickoffAt: "2023-05-02T19:00:00+00:00",
        homeTeamName: "Chelsea",
        awayTeamName: "Arsenal",
        homeGoals: 1,
        awayGoals: 3,
      },
      {
        id: "3",
        kickoffAt: "2022-11-06T16:30:00+00:00",
        homeTeamName: "Arsenal",
        awayTeamName: "Chelsea",
        homeGoals: 0,
        awayGoals: 0,
      },
    ]);
    expect(summary).toMatchObject({
      meetings: 3,
      homeWins: 0,
      draws: 2,
      awayWins: 1,
    });
    expect(summary?.bttsPct).toBeCloseTo(2 / 3, 3);
    expect(summary?.over25Pct).toBeCloseTo(2 / 3, 3);
  });
});

describe("weather formatter", () => {
  it("returns null when the vendor omits weather", () => {
    expect(formatApiFootballWeather(null)).toBeNull();
    expect(formatApiFootballWeather(undefined)).toBeNull();
  });

  it("formats a structured weather object when present", () => {
    expect(
      formatApiFootballWeather({
        temp: 12,
        condition: "Clear",
        humidity: 64,
      }),
    ).toBe("12° · Clear · Humedad 64%");
  });
});
