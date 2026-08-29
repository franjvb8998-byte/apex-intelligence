import { describe, expect, it } from "vitest";
import { mapOpportunityFromCenter } from "@/lib/apex-opportunities/map";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { loadMatchCenterFromApiFootball } from "@/lib/match-center/load";
import {
  matchMetricsFromFixtureStatistics,
  positionFromStandings,
} from "@/lib/match-analysis/metrics";

describe("Match Analysis catalogue mappers", () => {
  it("reads league position from standings", () => {
    const position = positionFromStandings(
      [
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
      ],
      "42",
    );
    expect(position).toMatchObject({ rank: 1, points: 89, teamName: "Arsenal" });
  });

  it("parses possession, shots and xG from fixture statistics", () => {
    const metrics = matchMetricsFromFixtureStatistics({
      team: { id: 42, name: "Arsenal" },
      statistics: [
        { type: "Ball Possession", value: "58%" },
        { type: "Total Shots", value: 14 },
        { type: "Shots on Goal", value: 6 },
        { type: "expected_goals", value: "1.82" },
      ],
    });
    expect(metrics).toEqual({
      possession: 58,
      shots: 14,
      shotsOnTarget: 6,
      expectedGoals: 1.82,
    });
  });
});

describe("Match Analysis ← API-Football", () => {
  it("loads the recorded fixture without mock teams or odds", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(data.source).toBe("data-platform");
    expect(data.homeTeam.name).toBe("Arsenal");
    expect(data.awayTeam.name).toBe("Chelsea");
    expect(data.homeTeam.logoUrl).toBe(
      "https://media.api-sports.io/football/teams/42.png",
    );
    expect(data.awayTeam.logoUrl).toBe(
      "https://media.api-sports.io/football/teams/49.png",
    );
    expect(data.leaguePosition.home?.rank).toBe(1);
    expect(data.leaguePosition.away?.rank).toBe(2);
    expect(data.recentMatches.home).toHaveLength(5);
    expect(data.h2h.length).toBeGreaterThan(0);
    expect(data.venueSplit.home.home?.played).toBeGreaterThan(0);
    expect(data.matchMetrics.home?.possession).toBe(58);
    expect(data.matchMetrics.away?.expectedGoals).toBeCloseTo(0.94);
    expect(data.expectedGoals.total).toBeGreaterThan(0);
    expect(data.rating.metrics).toHaveLength(10);
    expect(data.rating.overall).toBeGreaterThanOrEqual(0);
    expect(data.scoring?.engineId).toBe("scoring-v2");
    expect(data.scoring?.overall).toBe(data.apexScore.value);

    const center = await loadMatchCenterFromApiFootball({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    const row = mapOpportunityFromCenter(center);
    expect(row?.score).toBe(data.scoring?.overall);
    expect(row?.recommendation).toBe(data.scoring?.recommendation.tier);
    expect(center.preview.analysis.scoring?.overall).toBe(data.scoring?.overall);

    expect(data.decision.reasonsAgainst.length).toBeGreaterThan(0);
    expect(data.report.breakdown).toHaveLength(9);
    expect(data.report.narrative.length).toBeGreaterThan(20);
    expect(data.twins).toBeDefined();
    expect(data.oneXTwo.home + data.oneXTwo.draw + data.oneXTwo.away).toBeCloseTo(
      1,
    );
    expect(data.explanation.caveats.join(" ")).not.toMatch(/simulad/i);
  });
});
