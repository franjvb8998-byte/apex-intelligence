import { describe, expect, it } from "vitest";
import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import type { ApexDecisionInput } from "@/lib/decision-engine/types";
import {
  createScoringEngine,
  emptyScoringInput,
  evaluateScoring,
  evaluateScoringFromEngines,
  scoreConfidence,
  scoreDataQuality,
  scoreExpectedValue,
  scoreMarketValue,
  scoreMomentum,
  scoreProbability,
  scoreRisk,
  scoreTactical,
  scoreTeamIntelligence,
  scoringInputFromEngines,
} from "@/lib/scoring-engine";
import { scoringEngineFixture } from "@/lib/scoring-engine/fixture";
import { SCORING_WEIGHTS } from "@/lib/scoring-engine/weights";
import { evaluateTeamIntelligence } from "@/lib/team-intelligence/engine";
import { teamIntelligenceFixture } from "@/lib/team-intelligence/fixture";
import { mapOpportunityFromDecision } from "@/lib/apex-opportunities/map";
import { opportunityToComboLeg } from "@/lib/smart-combos/legs";

function decisionSample(): ApexDecisionInput {
  return {
    matchId: "apex:test:scoring",
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

describe("APEX Scoring Engine v2", () => {
  it("is deterministic and exposes nine weighted components", () => {
    const engine = createScoringEngine();
    const input = scoringEngineFixture();
    expect(engine.evaluate(input)).toEqual(evaluateScoring(input));
    expect(engine.id).toBe("scoring-v2");
    const scored = evaluateScoring(input);
    expect(scored.components).toHaveLength(9);
    expect(scored.overall).toBeGreaterThanOrEqual(0);
    expect(scored.overall).toBeLessThanOrEqual(100);
    expect(Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(
      1,
      8,
    );
  });

  it("scores each pillar independently", () => {
    const input = scoringEngineFixture();
    expect(scoreProbability(input).score).toBe(58);
    expect(scoreExpectedValue(input).available).toBe(true);
    expect(scoreMarketValue(input).available).toBe(true);
    expect(scoreTeamIntelligence(input).score).toBe(74);
    expect(scoreMomentum(input).score).toBe(78);
    expect(scoreTactical(input).score).toBe(71);
    expect(scoreConfidence(input).score).toBe(68);
    expect(scoreRisk(input).score).toBe(72);
    expect(scoreDataQuality(input).available).toBe(true);
    expect(scoreProbability(scoringEngineFixture({ modelProbability: null })).available).toBe(
      false,
    );
    expect(scoreMarketValue(scoringEngineFixture({ marketEdge: null, decimalOdds: null })).available).toBe(
      false,
    );
  });

  it("drops unpublished pillars and lowers coverage", () => {
    const full = evaluateScoring(scoringEngineFixture());
    const thin = evaluateScoring(
      scoringEngineFixture({
        modelProbability: null,
        oneXTwo: null,
        decimalOdds: null,
        expectedValue: null,
        marketEdge: null,
        teamIntelligenceScore: null,
        momentumScore: null,
        tacticalScore: null,
        bookmakerCount: 0,
      }),
    );
    expect(thin.coverage).toBeLessThan(full.coverage);
    expect(thin.components.filter((row) => row.available).length).toBeLessThan(9);
  });

  it("maps negative EV to Avoid and a strong board to Elite or Strong Bet", () => {
    const avoid = evaluateScoring(scoringEngineFixture({ expectedValue: -0.08 }));
    expect(avoid.recommendation.tier).toBe("Avoid");
    expect(avoid.explanation.recommendation).toBe("Avoid");

    const elite = evaluateScoring(
      scoringEngineFixture({
        modelProbability: 0.72,
        expectedValue: 0.08,
        marketEdge: 0.1,
        confidence: 78,
        risk: 18,
        teamIntelligenceScore: 82,
        momentumScore: 80,
        tacticalScore: 76,
      }),
    );
    expect(["Elite", "Strong Bet"]).toContain(elite.recommendation.tier);
    expect(elite.explanation.supporting.length).toBeGreaterThan(0);
    expect(elite.explanation.summary).toMatch(/Arsenal/);
  });

  it("labels positive EV on a mid board as Value Bet", () => {
    const scored = evaluateScoring(
      scoringEngineFixture({
        modelProbability: 0.42,
        expectedValue: 0.06,
        marketEdge: 0.05,
        confidence: 50,
        risk: 40,
        teamIntelligenceScore: 52,
        momentumScore: 50,
        tacticalScore: 48,
        coverage: 0.55,
      }),
    );
    expect(scored.recommendation.tier).toBe("Value Bet");
  });

  it("stays silent when nothing is published", () => {
    const scored = evaluateScoring(
      emptyScoringInput({
        selectionId: "empty",
        selectionLabel: "Unknown",
      }),
    );
    expect(scored.coverage).toBe(0);
    expect(scored.overall).toBe(0);
    expect(scored.components.every((row) => !row.available)).toBe(true);
  });

  it("consumes Decision Engine + Team Intelligence without changing their scores", () => {
    const decisionInput = decisionSample();
    const decision = evaluateDecision(decisionInput);
    const team = evaluateTeamIntelligence(teamIntelligenceFixture());
    const input = scoringInputFromEngines({
      selectionId: decisionInput.matchId,
      selectionLabel: decision.selectionLabel,
      decision,
      decisionInput,
      team,
    });
    expect(input.confidence).toBe(decision.confidence.value);
    expect(input.risk).toBe(decision.risk.score);
    expect(input.teamIntelligenceScore).toBe(team.scores.overall);
    expect(input.momentumScore).toBe(team.scores.momentum.value);
    const scored = evaluateScoring(input);
    expect(scored.engineId).toBe("scoring-v2");
    expect(scored.components.find((row) => row.key === "teamIntelligence")?.score).toBe(
      team.scores.overall,
    );
  });

  it("emits the same score and tier on the opportunity row and combo leg", () => {
    const decisionInput = decisionSample();
    const decision = evaluateDecision(decisionInput);
    const scored = evaluateScoringFromEngines({
      selectionId: decisionInput.matchId,
      selectionLabel: decision.selectionLabel,
      decision,
      decisionInput,
    });
    expect(
      evaluateScoringFromEngines({
        selectionId: decisionInput.matchId,
        selectionLabel: decision.selectionLabel,
        decision,
        decisionInput,
      }),
    ).toEqual(scored);

    const row = mapOpportunityFromDecision({
      fixtureId: decisionInput.matchId,
      kickoffAt: decisionInput.kickoffAt,
      leagueName: "Premier League",
      home: { name: decisionInput.home.name, shortName: "ARS", logoUrl: null },
      away: { name: decisionInput.away.name, shortName: "CHE", logoUrl: null },
      predicted: decision.predicted,
      decision,
      decisionInput,
    });
    expect(row.score).toBe(scored.overall);
    expect(row.recommendation).toBe(scored.recommendation.tier);
    expect(row.verdictLabel).toBe(scored.recommendation.tier);

    const leg = opportunityToComboLeg(row);
    expect(leg.score).toBe(row.score);
    expect(leg.verdictLabel).toBe(row.recommendation);
  });
});
