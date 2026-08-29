import { describe, expect, it, beforeEach } from "vitest";
import { mapOpportunityFromDecision } from "@/lib/apex-opportunities/map";
import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import type { ApexDecisionInput } from "@/lib/decision-engine/types";
import {
  createIntelligenceLearningSystem,
  evaluateCalibration,
  exportLearningDataset,
  getIntelligenceLearningSystem,
  resetIntelligenceLearningSystem,
} from "@/lib/intelligence-learning";
import { recommendationDraftFixture } from "@/lib/intelligence-learning/fixture";
import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";

function decisionSample(): ApexDecisionInput {
  return {
    matchId: "apex:test:learning",
    kickoffAt: "2026-08-28T15:00:00.000Z",
    predicted: "home",
    predictedLabel: "Victoria Arsenal",
    homeName: "Arsenal",
    awayName: "Chelsea",
    oneXTwo: { home: 0.62, draw: 0.2, away: 0.18 },
    expectedGoals: { home: 2.05, away: 0.82, total: 2.87 },
    decimalOdds: 1.95,
    bookmaker: "Pinnacle",
    bookmakerCount: 3,
    home: {
      name: "Arsenal",
      formLetters: ["W", "W", "W", "D", "W"],
      formQuality: 0.86,
      restDays: 7,
      matchesLast7: 0,
      goalsFor: 12,
      goalsAgainst: 3,
      played: 5,
      awayWinPct: 0.45,
      injuryCount: 0,
      consecutiveAway: 0,
      rank: 1,
    },
    away: {
      name: "Chelsea",
      formLetters: ["L", "L", "D", "L", "W"],
      formQuality: 0.32,
      restDays: 3,
      matchesLast7: 1,
      goalsFor: 4,
      goalsAgainst: 9,
      played: 5,
      awayWinPct: 0.22,
      injuryCount: 1,
      consecutiveAway: 1,
      rank: 12,
    },
    h2h: { pickWins: 3, otherWins: 1, draws: 1, meetings: 5 },
    weather: null,
  };
}

describe("APEX Intelligence Learning System", () => {
  beforeEach(() => {
    resetIntelligenceLearningSystem();
  });

  it("registers a unique recommendation and upserts the pending snapshot", () => {
    const learning = createIntelligenceLearningSystem();
    const first = learning.register(recommendationDraftFixture());
    const second = learning.register(
      recommendationDraftFixture({ apexScore: 81, confidence: 88 }),
    );
    expect(first.id).toMatch(/^rec:/);
    expect(second.id).toBe(first.id);
    expect(second.apexScore).toBe(81);
    expect(learning.recommendations.list({ status: "pending" })).toHaveLength(1);
    expect(second.engineVersion.learning).toBe(INTELLIGENCE_LEARNING_VERSION);
    expect(second.reasoning.summary.length).toBeGreaterThan(10);
  });

  it("settles a hit with payout, ROI and realized EV", () => {
    const learning = createIntelligenceLearningSystem();
    const rec = learning.register(recommendationDraftFixture({ odds: 2 }));
    const settled = learning.settle({
      recommendationId: rec.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 2,
      awayScore: 1,
      marketOutcome: "home",
    });
    expect(settled.result.win).toBe(true);
    expect(settled.result.payout).toBe(2);
    expect(settled.result.roi).toBe(1);
    expect(settled.result.evRealized).toBe(1);
    expect(settled.result.recommendationCorrect).toBe(true);
    expect(settled.recommendation.status).toBe("settled");
  });

  it("marks Avoid as correct when the selection misses", () => {
    const learning = createIntelligenceLearningSystem();
    const rec = learning.register(
      recommendationDraftFixture({
        fixtureId: "avoid-1",
        recommendation: "Avoid",
        stakePct: 0,
        kellyStake: 0,
      }),
    );
    const settled = learning.settle({
      recommendationId: rec.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 0,
      awayScore: 1,
      marketOutcome: "away",
    });
    expect(settled.result.selectionHit).toBe(false);
    expect(settled.result.recommendationCorrect).toBe(true);
  });

  it("does not mutate a settled row when the same fixture is published again", () => {
    const learning = createIntelligenceLearningSystem();
    const rec = learning.register(recommendationDraftFixture());
    learning.settle({
      recommendationId: rec.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 2,
      awayScore: 1,
      marketOutcome: "home",
    });
    const replay = learning.register(
      recommendationDraftFixture({ timestamp: "2026-08-30T12:00:00.000Z" }),
    );
    expect(replay.id).not.toBe(rec.id);
    expect(replay.status).toBe("pending");
    expect(learning.recommendations.getById(rec.id)?.status).toBe("settled");
  });

  it("computes ROI by tier, market, league, confidence and score buckets", () => {
    const learning = createIntelligenceLearningSystem();
    const win = learning.register(
      recommendationDraftFixture({
        fixtureId: "w1",
        recommendation: "Elite",
        apexScore: 91,
        confidence: 92,
        odds: 1.8,
      }),
    );
    const loss = learning.register(
      recommendationDraftFixture({
        fixtureId: "l1",
        recommendation: "Value Bet",
        competition: "La Liga",
        apexScore: 64,
        confidence: 55,
        odds: 2.2,
      }),
    );
    learning.settle({
      recommendationId: win.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 3,
      awayScore: 0,
      marketOutcome: "home",
    });
    learning.settle({
      recommendationId: loss.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 0,
      awayScore: 2,
      marketOutcome: "away",
    });

    const report = learning.performance();
    expect(report.settledCount).toBe(2);
    expect(report.overall.winRate).toBe(0.5);
    expect(report.overall.averageOdds).toBe(2);
    expect(report.byRecommendationTier.map((row) => row.key)).toEqual(
      expect.arrayContaining(["Elite", "Value Bet"]),
    );
    expect(report.byMarket[0]?.key).toBe("1x2");
    expect(report.byLeague.map((row) => row.key)).toEqual(
      expect.arrayContaining(["Premier League", "La Liga"]),
    );
    expect(report.byConfidenceBucket.length).toBeGreaterThan(0);
    expect(report.byApexScoreBucket.length).toBeGreaterThan(0);
    expect(report.overall.kellyEfficiency).not.toBeNull();
  });

  it("calibrates predicted confidence against observed hit rate", () => {
    const learning = createIntelligenceLearningSystem();
    for (let i = 0; i < 10; i += 1) {
      const rec = learning.register(
        recommendationDraftFixture({
          fixtureId: `cal-${i}`,
          confidence: 90,
          odds: 2,
        }),
      );
      learning.settle({
        recommendationId: rec.id,
        settlementDate: "2026-08-29T21:00:00.000Z",
        homeScore: i < 8 ? 1 : 0,
        awayScore: i < 8 ? 0 : 1,
        marketOutcome: i < 8 ? "home" : "away",
      });
    }
    const report = evaluateCalibration(learning.listSettled());
    const bin = report.bins.find((row) => row.label === "90-100");
    expect(bin?.count).toBe(10);
    expect(bin?.predicted).toBe(0.9);
    expect(bin?.observed).toBe(0.8);
    expect(bin?.calibrationError).toBe(0.1);
    expect(report.ece).toBe(0.1);
  });

  it("ranks markets and leagues for learning metrics", () => {
    const learning = createIntelligenceLearningSystem();
    const a = learning.register(
      recommendationDraftFixture({
        fixtureId: "m1",
        recommendation: "Strong Bet",
        odds: 2,
        expectedValue: 0.12,
        confidence: 80,
      }),
    );
    const b = learning.register(
      recommendationDraftFixture({
        fixtureId: "m2",
        competition: "Serie A",
        odds: 2,
        expectedValue: -0.04,
        confidence: 40,
      }),
    );
    learning.settle({
      recommendationId: a.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 1,
      awayScore: 0,
      marketOutcome: "home",
    });
    learning.settle({
      recommendationId: b.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 0,
      awayScore: 1,
      marketOutcome: "away",
    });
    const metrics = learning.metrics();
    expect(metrics.bestLeagues[0]?.key).toBe("Premier League");
    expect(metrics.worstLeagues[0]?.key).toBe("Serie A");
    expect(metrics.highestExpectedValueMarkets[0]?.key).toBe("1x2");
    expect(metrics.highestConfidenceMarkets[0]?.sampleSize).toBe(2);
  });

  it("exports an ML-ready dataset with null labels until settlement", () => {
    const learning = createIntelligenceLearningSystem();
    const rec = learning.register(recommendationDraftFixture());
    const pending = exportLearningDataset(learning.recommendations.list(), []);
    expect(pending[0]?.labelHit).toBeNull();
    expect(pending[0]?.labelRoi).toBeNull();
    learning.settle({
      recommendationId: rec.id,
      settlementDate: "2026-08-29T21:00:00.000Z",
      homeScore: 2,
      awayScore: 1,
      marketOutcome: "home",
    });
    const labeled = learning.dataset();
    expect(labeled[0]?.labelHit).toBe(true);
    expect(labeled[0]?.engineScoring).toBe("scoring-v2");
    expect(labeled[0]?.apexScore).toBe(rec.apexScore);
  });

  it("captures scanner rows through the opportunity mapper", () => {
    const input = decisionSample();
    const decision = evaluateDecision(input);
    mapOpportunityFromDecision({
      fixtureId: input.matchId,
      kickoffAt: input.kickoffAt,
      leagueName: "Premier League",
      home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
      away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
      predicted: decision.predicted,
      decision,
      decisionInput: input,
    });
    const recs = getIntelligenceLearningSystem().recommendations.list({
      source: "scanner",
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]?.fixtureId).toBe(input.matchId);
    expect(recs[0]?.apexScore).toBeGreaterThan(0);
    expect(recs[0]?.engineVersion.scoring).toBe("scoring-v2");
  });
});
