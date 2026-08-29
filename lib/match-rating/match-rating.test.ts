import { describe, expect, it } from "vitest";
import {
  APEX_RATING_WEIGHTS,
  apexScoreFromRating,
  quarterKelly,
  rateMatch,
  valueRatingFromEv,
} from "@/lib/match-rating";
import type { ApexRatingInput } from "@/lib/match-rating/types";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";

function sampleInput(over: Partial<ApexRatingInput> = {}): ApexRatingInput {
  return {
    predictedOutcome: "home",
    predictedLabel: "Victoria Arsenal",
    oneXTwo: { home: 0.63, draw: 0.19, away: 0.18 },
    expectedGoals: { home: 2.05, away: 0.81, total: 2.86 },
    confidence: { value: 0.17, band: "low" },
    decimalOdds: 1.7,
    bookmakerCount: 2,
    home: {
      form: "WDWLW",
      recent: [
        { result: "W" },
        { result: "D" },
        { result: "W" },
        { result: "L" },
        { result: "W" },
      ],
      goalsFor: 91,
      goalsAgainst: 29,
      played: 38,
    },
    away: {
      form: "WLDLW",
      recent: [
        { result: "W" },
        { result: "L" },
        { result: "D" },
        { result: "L" },
        { result: "W" },
      ],
      goalsFor: 70,
      goalsAgainst: 40,
      played: 38,
    },
    standings: {
      home: { rank: 1, points: 89, played: 38 },
      away: { rank: 2, points: 80, played: 38 },
    },
    injuries: [{ teamSide: "home" }],
    eloWinExpectancyHome: 0.67,
    ...over,
  };
}

describe("APEX Match Rating weights", () => {
  it("sums to 1", () => {
    const sum = Object.values(APEX_RATING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 8);
  });
});

describe("quarterKelly", () => {
  it("is a quarter of full Kelly and null without odds", () => {
    const full = (0.63 * 1.7 - 1) / (1.7 - 1);
    expect(quarterKelly(0.63, 1.7)).toBeCloseTo(full * 0.25, 8);
    expect(quarterKelly(0.63, null)).toBeNull();
    expect(quarterKelly(0.4, 1.5)).toBe(0);
  });
});

describe("rateMatch", () => {
  it("emits a 0–100 score, 10 metrics, Kelly, fair odds and EV", () => {
    const rating = rateMatch(sampleInput());
    expect(rating.overall).toBeGreaterThanOrEqual(0);
    expect(rating.overall).toBeLessThanOrEqual(100);
    expect(rating.metrics).toHaveLength(10);
    expect(rating.fairOdds).toBeCloseTo(1 / 0.63, 5);
    expect(rating.expectedValue).toBeCloseTo(0.63 * 1.7 - 1, 8);
    expect(rating.valueRating).toBe(valueRatingFromEv(rating.expectedValue));
    expect(rating.kellyFraction).toBeGreaterThan(0);
    expect(rating.recommendation).toBe("skip");
    expect(rating.recommendationLabel).toBe("Skip");
    expect(rating.recommendedKelly).toBe(0);
    expect(apexScoreFromRating(rating).value).toBe(rating.overall);
    expect(apexScoreFromRating(rating).components).toHaveLength(10);
  });

  it("does not invent market value when odds are missing", () => {
    const rating = rateMatch(
      sampleInput({ decimalOdds: null, bookmakerCount: 0 }),
    );
    expect(rating.expectedValue).toBeNull();
    expect(rating.valueRating).toBeNull();
    expect(rating.kellyFraction).toBeNull();
    expect(rating.kellyLabel).toMatch(/sin cuota/i);
    expect(rating.metrics.find((row) => row.key === "value")?.available).toBe(
      false,
    );
    expect(rating.metrics.find((row) => row.key === "odds")?.available).toBe(
      false,
    );
  });

  it("maps an explicit bet action to Bet when EV is not negative", () => {
    const rating = rateMatch(
      sampleInput({
        confidence: { value: 0.8, band: "high" },
        riskLevel: "low",
        recommendationAction: "bet",
      }),
    );
    expect(rating.recommendation).toBe("bet");
    expect(rating.recommendationLabel).toBe("Bet");
    expect(rating.recommendedKelly).toBeGreaterThan(0);
  });
});

describe("Match Analysis page rating", () => {
  it("attaches a full rating to the recorded Arsenal vs Chelsea fixture", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    expect(data.rating.overall).toBeGreaterThanOrEqual(0);
    expect(data.rating.overall).toBeLessThanOrEqual(100);
    expect(data.rating.metrics).toHaveLength(10);
    expect(data.apexScore.value).toBe(data.scoring?.overall);
    expect(data.rating.fairOdds).toBeGreaterThan(1);
    expect(["bet", "watch", "skip"]).toContain(data.rating.recommendation);
  });
});
