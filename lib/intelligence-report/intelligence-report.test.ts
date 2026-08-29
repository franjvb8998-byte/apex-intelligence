import { describe, expect, it } from "vitest";
import { getMockExplainablePrediction } from "@/lib/explainable-ai/mock";
import { buildIntelligenceReport } from "@/lib/intelligence-report/build-report";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import { apexScoreFromRating, rateMatch } from "@/lib/match-rating";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type { ApexRatingInput } from "@/lib/match-rating/types";
import type { MatchCenterAbsence, MatchCenterOddsRow } from "@/lib/match-center/types";
import type { MatchCenterRecentMatch } from "@/lib/match-center/types";

function ratingInput(over: Partial<ApexRatingInput> = {}): ApexRatingInput {
  return {
    predictedOutcome: "home",
    predictedLabel: "Victoria Arsenal",
    oneXTwo: { home: 0.63, draw: 0.19, away: 0.18 },
    expectedGoals: { home: 2.05, away: 0.81, total: 2.86 },
    confidence: { value: 0.82, band: "high" },
    riskLevel: "low",
    recommendationAction: "bet",
    decimalOdds: 1.9,
    bookmakerCount: 2,
    home: {
      form: "WWWDW",
      recent: [
        { result: "W" },
        { result: "W" },
        { result: "W" },
        { result: "D" },
        { result: "W" },
      ],
      goalsFor: 12,
      goalsAgainst: 3,
      played: 5,
    },
    away: {
      form: "LLDLW",
      recent: [
        { result: "L" },
        { result: "L" },
        { result: "D" },
        { result: "L" },
        { result: "W" },
      ],
      goalsFor: 4,
      goalsAgainst: 9,
      played: 5,
    },
    standings: {
      home: { rank: 1, points: 89, played: 38 },
      away: { rank: 12, points: 44, played: 38 },
    },
    injuries: [],
    ...over,
  };
}

function recent(
  over: Partial<MatchCenterRecentMatch> & { id: string; kickoffAt: string },
): MatchCenterRecentMatch {
  return {
    opponentName: "Opp",
    home: true,
    goalsFor: 2,
    goalsAgainst: 0,
    result: "W",
    ...over,
  };
}

function formSideToRecent(
  side: ApexRatingInput["home"],
  prefix: string,
): MatchCenterRecentMatch[] {
  if (side.recent.length > 0) {
    return side.recent.flatMap((row, index) =>
      row.result
        ? [
            recent({
              id: `${prefix}-${index}`,
              kickoffAt: `2024-03-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
              result: row.result,
            }),
          ]
        : [],
    );
  }
  const letters = [...(side.form?.toUpperCase().replace(/[^WDL]/g, "") ?? "")];
  return letters.flatMap((ch, index) =>
    ch === "W" || ch === "D" || ch === "L"
      ? [
          recent({
            id: `${prefix}-${index}`,
            kickoffAt: `2024-03-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
            result: ch,
          }),
        ]
      : [],
  );
}

function analysisFromRating(
  input: ApexRatingInput,
  extra: Partial<Omit<MatchAnalysisData, "report" | "decision">> = {},
): Omit<MatchAnalysisData, "report" | "decision"> {
  const rating = rateMatch(input);
  return {
    matchId: "apex:test:fixture",
    leagueName: "Premier League",
    kickoffAt: "2024-04-23T19:00:00.000Z",
    status: "scheduled",
    homeTeam: {
      id: "42",
      name: "Arsenal",
      shortName: "ARS",
      logoUrl: null,
    },
    awayTeam: {
      id: "49",
      name: "Chelsea",
      shortName: "CHE",
      logoUrl: null,
    },
    oneXTwo: input.oneXTwo,
    predictedOutcome: input.predictedOutcome,
    confidence: input.confidence,
    markets: [
      {
        id: "m-1x2",
        label: "1X2",
        type: "1x2",
        line: null,
        selections: [
          { key: "home", label: "Home", probability: input.oneXTwo.home, decimalOdds: input.decimalOdds },
          { key: "draw", label: "Draw", probability: input.oneXTwo.draw, decimalOdds: 4.2 },
          { key: "away", label: "Away", probability: input.oneXTwo.away, decimalOdds: 5.0 },
        ],
      },
    ],
    keyFactors: [],
    risks: [],
    explanation: {
      summary: "",
      factors: [],
      caveats: [],
      narrative: "",
    },
    explainable: getMockExplainablePrediction({ matchId: "apex:test:fixture" }),
    modelVersion: "test",
    source: "intelligence-core",
    leaguePosition: { home: null, away: null },
    recentMatches: {
      home: formSideToRecent(input.home, "h"),
      away: formSideToRecent(input.away, "a"),
    },
    h2h: [],
    venueSplit: {
      home: { home: null, away: null },
      away: { home: null, away: null },
    },
    matchMetrics: { home: null, away: null },
    expectedGoals: input.expectedGoals,
    rating,
    apexScore: apexScoreFromRating(rating),
    ...extra,
  };
}

describe("APEX Intelligence Report", () => {
  it("is deterministic for the same published inputs", () => {
    const data = analysisFromRating(ratingInput());
    const a = buildIntelligenceReport({ data });
    const b = buildIntelligenceReport({ data });
    expect(a).toEqual(b);
    expect(a.narrative).toContain("APEX believes");
  });

  it("emits Strong Bet with 5 stars when EV, confidence and risk clear the bar", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput()),
    });
    expect(report.verdict.kind).toBe("strong_bet");
    expect(report.verdict.stars).toBe(5);
    expect(report.verdict.label).toBe("Strong Bet");
    expect(report.recommendation.kind).toBe("strong");
    expect([3, 5]).toContain(report.recommendation.exposurePct);
    expect(report.reasons.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        "attacking_efficiency",
        "defensive_record",
        "xg_differential",
        "recent_form",
        "home_advantage",
      ]),
    );
  });

  it("lists only applicable reasons — H2H, rest and opponent absences stay off without data", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput()),
    });
    const ids = report.reasons.map((row) => row.id);
    expect(ids).not.toContain("better_h2h");
    expect(ids).not.toContain("better_rest");
    expect(ids).not.toContain("opponent_absences");
  });

  it("adds Better H2H, better rest and opponent absences when the catalogue publishes them", () => {
    const data = analysisFromRating(ratingInput(), {
      h2h: [
        {
          id: "1",
          kickoffAt: "2023-01-01T15:00:00.000Z",
          homeTeamName: "Arsenal",
          awayTeamName: "Chelsea",
          homeGoals: 2,
          awayGoals: 0,
        },
        {
          id: "2",
          kickoffAt: "2023-05-01T15:00:00.000Z",
          homeTeamName: "Chelsea",
          awayTeamName: "Arsenal",
          homeGoals: 0,
          awayGoals: 1,
        },
      ],
      recentMatches: {
        home: [
          recent({ id: "h1", kickoffAt: "2024-04-14T15:00:00.000Z" }),
        ],
        away: [
          recent({
            id: "a1",
            kickoffAt: "2024-04-21T15:00:00.000Z",
            result: "L",
          }),
        ],
      },
    });
    const injuries: MatchCenterAbsence[] = [
      {
        id: "inj-1",
        playerName: "N. Jackson",
        teamId: "49",
        teamName: "Chelsea",
        detail: "Knock",
      },
    ];
    const report = buildIntelligenceReport({ data, injuries });
    const ids = report.reasons.map((row) => row.id);
    expect(ids).toContain("better_h2h");
    expect(ids).toContain("better_rest");
    expect(ids).toContain("opponent_absences");
  });

  it("never invents derby, rotation or cup-after risks", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput()),
      weather: "12° · Clear · Humedad 64%",
    });
    const ids = report.risks.map((row) => row.id);
    expect(ids).not.toContain("derby");
    expect(ids).not.toContain("rotation");
    expect(ids).not.toContain("cup");
    expect(report.risks.some((row) => /derby|rotation|cup/i.test(row.title))).toBe(
      false,
    );
    expect(ids).not.toContain("weather");
  });

  it("flags heavy rain only from a published weather string", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput()),
      weather: "9° · Heavy rain · Humedad 91%",
    });
    expect(report.risks.map((row) => row.id)).toContain("weather");
    expect(report.confidence.value).toBeLessThan(report.confidence.base);
  });

  it("maps Skip and negative EV to Avoid / PASS 0%", () => {
    const skip = buildIntelligenceReport({
      data: analysisFromRating(
        ratingInput({
          confidence: { value: 0.17, band: "low" },
          riskLevel: "high",
          recommendationAction: "pass",
        }),
      ),
    });
    expect(skip.verdict.kind).toBe("avoid");
    expect(skip.verdict.stars).toBe(2);
    expect(skip.recommendation).toMatchObject({
      kind: "pass",
      label: "PASS",
      exposurePct: 0,
    });

    const negative = buildIntelligenceReport({
      data: analysisFromRating(
        ratingInput({
          decimalOdds: 1.2,
          recommendationAction: "bet",
        }),
      ),
    });
    expect(negative.market.flags.negativeEv).toBe(true);
    expect(negative.verdict.kind).toBe("avoid");
    expect(negative.recommendation.kind).toBe("pass");
  });

  it("highlights Positive EV and Underpriced when the board is long versus the model", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput({ decimalOdds: 1.9 })),
    });
    expect(report.market.flags.positiveEv).toBe(true);
    expect(report.market.flags.underpriced).toBe(true);
    expect(report.market.fairOdds).toBeCloseTo(1 / 0.63, 5);
    expect(report.market.bookmakerOdds).toBe(1.9);
  });

  it("exposes nine breakdown bars and keeps missing metrics as n/d", () => {
    const report = buildIntelligenceReport({
      data: analysisFromRating(
        ratingInput({
          home: {
            form: null,
            recent: [],
            goalsFor: null,
            goalsAgainst: null,
            played: null,
          },
          away: {
            form: null,
            recent: [],
            goalsFor: null,
            goalsAgainst: null,
            played: null,
          },
          decimalOdds: null,
          bookmakerCount: 0,
        }),
      ),
    });
    expect(report.breakdown).toHaveLength(9);
    expect(report.breakdown.map((row) => row.key)).toEqual([
      "attack",
      "defense",
      "momentum",
      "form",
      "value",
      "market",
      "risk",
      "discipline",
      "fitness",
    ]);
    const form = report.breakdown.find((row) => row.key === "form");
    const value = report.breakdown.find((row) => row.key === "value");
    expect(form?.available).toBe(false);
    expect(form?.score).toBeNull();
    expect(value?.available).toBe(false);
    expect(report.breakdown.find((row) => row.key === "discipline")?.available).toBe(
      true,
    );
  });

  it("uses dashboard odds for bookmaker name when published", () => {
    const odds: MatchCenterOddsRow[] = [
      {
        id: "o1",
        market: "1x2",
        marketLabel: "1X2",
        selection: "home",
        label: "Home",
        decimalOdds: 1.85,
        impliedProbability: 1 / 1.85,
        modelProbability: 0.63,
        expectedValue: 0.63 * 1.85 - 1,
        bookmaker: "Pinnacle",
        isBest: true,
      },
    ];
    const report = buildIntelligenceReport({
      data: analysisFromRating(ratingInput({ decimalOdds: 1.7 })),
      odds,
    });
    expect(report.market.bookmakerOdds).toBe(1.85);
    expect(report.market.bookmaker).toBe("Pinnacle");
  });
});

describe("APEX Intelligence Report ← recorded fixture", () => {
  it("stamps a full report on the recorded API-Football match", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    expect(data.report.verdict.label).toMatch(/Strong Bet|Lean Bet|Avoid/);
    expect(data.report.confidence.value).toBeGreaterThanOrEqual(0);
    expect(data.report.confidence.value).toBeLessThanOrEqual(100);
    expect(data.report.breakdown).toHaveLength(9);
    expect(data.report.narrative.length).toBeGreaterThan(40);
    expect(data.report.recommendation.label).toMatch(
      /PASS|SMALL BET|MEDIUM BET|STRONG BET/,
    );
    expect(
      data.report.risks.every((row) =>
        ["high_variance", "weather", "injuries", "poor_away_form", "schedule_congestion"].includes(
          row.id,
        ),
      ),
    ).toBe(true);
  });
});
