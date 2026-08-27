import { describe, expect, it } from "vitest";
import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import {
  absencesFromInjuries,
  formLettersFromRecent,
  h2hFromFixtures,
  isSuspensionAbsence,
  lineupsFromVendor,
  recentMatchesFromFixtures,
  resultFromScores,
} from "@/lib/match-center/team-context";

function fixture(
  overrides: Partial<{
    id: number;
    homeId: number;
    awayId: number;
    homeName: string;
    awayName: string;
    homeGoals: number | null;
    awayGoals: number | null;
  }> = {},
): ApiFootballFixtureItem {
  return {
    fixture: {
      id: overrides.id ?? 1,
      date: "2026-08-01T12:00:00+00:00",
      status: { short: "FT" },
    },
    league: { id: 39, name: "Premier League" },
    teams: {
      home: {
        id: overrides.homeId ?? 42,
        name: overrides.homeName ?? "Arsenal",
      },
      away: {
        id: overrides.awayId ?? 49,
        name: overrides.awayName ?? "Chelsea",
      },
    },
    goals: {
      home: overrides.homeGoals ?? 2,
      away: overrides.awayGoals ?? 1,
    },
  };
}

describe("team context mappers", () => {
  it("classifies suspensions vs injuries", () => {
    expect(isSuspensionAbsence("Missing Fixture", "Suspended")).toBe(true);
    expect(isSuspensionAbsence("Missing Fixture", "Red Card")).toBe(true);
    expect(isSuspensionAbsence("Missing Fixture", "Injured")).toBe(false);
  });

  it("maps last matches from the team's perspective", () => {
    const recent = recentMatchesFromFixtures(
      [
        fixture({ id: 10, homeGoals: 1, awayGoals: 0 }),
        fixture({
          id: 11,
          homeId: 49,
          awayId: 42,
          homeName: "Chelsea",
          awayName: "Arsenal",
          homeGoals: 3,
          awayGoals: 1,
        }),
      ],
      "42",
    );
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({
      opponentName: "Chelsea",
      home: true,
      result: "W",
    });
    expect(recent[1]).toMatchObject({
      opponentName: "Chelsea",
      home: false,
      result: "L",
    });
    expect(formLettersFromRecent(recent)).toBe("WL");
  });

  it("skips the current fixture in H2H", () => {
    const meetings = h2hFromFixtures(
      [fixture({ id: 99 }), fixture({ id: 12, homeGoals: 0, awayGoals: 0 })],
      "99",
    );
    expect(meetings).toHaveLength(1);
    expect(meetings[0]?.id).toBe("12");
  });

  it("splits injury payloads into injuries and suspensions", () => {
    const { injuries, suspensions } = absencesFromInjuries([
      {
        player: {
          id: 1,
          name: "T. Partey",
          type: "Missing Fixture",
          reason: "Injured",
        },
        team: { id: 42, name: "Arsenal" },
      },
      {
        player: {
          id: 2,
          name: "R. James",
          type: "Missing Fixture",
          reason: "Suspended",
        },
        team: { id: 49, name: "Chelsea" },
      },
    ]);
    expect(injuries).toHaveLength(1);
    expect(injuries[0]?.playerName).toBe("T. Partey");
    expect(suspensions).toHaveLength(1);
    expect(suspensions[0]?.playerName).toBe("R. James");
  });

  it("maps vendor lineups by team", () => {
    const lineups = lineupsFromVendor(
      [
        {
          team: { id: 42, name: "Arsenal" },
          formation: "4-3-3",
          startXI: [
            { player: { id: 7, name: "B. Saka", number: 7, pos: "F" } },
          ],
          substitutes: [],
        },
      ],
      "42",
      "49",
    );
    expect(lineups.home?.formation).toBe("4-3-3");
    expect(lineups.home?.startXI[0]?.name).toBe("B. Saka");
    expect(lineups.away).toBeNull();
  });

  it("derives W/D/L from scores", () => {
    expect(resultFromScores(2, 1)).toBe("W");
    expect(resultFromScores(1, 1)).toBe("D");
    expect(resultFromScores(0, 2)).toBe("L");
    expect(resultFromScores(null, 1)).toBeNull();
  });
});
