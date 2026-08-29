import { describe, expect, it } from "vitest";
import { buildApexBrainBriefing } from "@/lib/apex-brain/briefing";
import { BRAIN_FROM_TIER, BRAIN_RECOMMENDATION } from "@/lib/apex-brain/recommendation";
import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import type { ApexDecisionInput } from "@/lib/decision-engine/types";
import { evaluateScoringFromEngines } from "@/lib/scoring-engine";

function sample(over: Partial<ApexDecisionInput> = {}): ApexDecisionInput {
  return {
    matchId: "apex:test:brain",
    kickoffAt: "2024-04-23T19:00:00.000Z",
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
    ...over,
  };
}

describe("APEX Brain v2 briefing", () => {
  it("is deterministic and interpolates Decision Engine numbers", () => {
    const decision = evaluateDecision(sample());
    const a = buildApexBrainBriefing(decision);
    const b = buildApexBrainBriefing(decision);
    expect(a).toEqual(b);
    expect(a.executiveSummary).toContain(`${Math.round(decision.score.value)}/100`);
    expect(a.executiveSummary).toContain(decision.selectionLabel);
    expect(a.executiveSummary).toContain(signedContains(decision.value.expectedValue));
    expect(a.strengths.length).toBeGreaterThanOrEqual(3);
    expect(a.strengths.length).toBeLessThanOrEqual(6);
    expect(a.risks.length).toBeGreaterThanOrEqual(2);
    expect(a.risks.length).toBeLessThanOrEqual(5);
    expect(a.recommendation.label).toBe(
      BRAIN_RECOMMENDATION[decision.verdict.kind].label,
    );
    expect(a.confidenceExplanation).toContain(String(decision.confidence.value));
    expect(a.why).toContain(decision.sizing.stakeLabel);
    expect(a.verdict).toMatch(/bankroll/i);
    const blob = JSON.stringify(a).toLowerCase();
    expect(blob).not.toContain("squad rotation");
    expect(blob).not.toContain("openai");
  });

  it("maps avoid to SKIP and does not invent a bet", () => {
    const decision = evaluateDecision(sample({ decimalOdds: 1.15 }));
    const brief = buildApexBrainBriefing(decision);
    expect(decision.verdict.kind).toBe("avoid");
    expect(brief.recommendation.label).toBe("SKIP");
    expect(brief.verdict.toLowerCase()).toContain("do not force a bet");
  });

  it("uses Scoring Engine overall and tier when a scored snapshot is passed", () => {
    const decision = evaluateDecision(sample());
    const scoring = evaluateScoringFromEngines({
      selectionId: "apex:test:brain",
      selectionLabel: decision.selectionLabel,
      decision,
      decisionInput: sample(),
    });
    const brief = buildApexBrainBriefing(decision, scoring);
    expect(brief.executiveSummary).toContain(`${Math.round(scoring.overall)}/100`);
    expect(brief.executiveSummary).toContain(scoring.recommendation.tier);
    expect(brief.why).toContain("Scoring Engine v2");
    expect(brief.recommendation.label).toBe(
      BRAIN_FROM_TIER[scoring.recommendation.tier].label,
    );
  });

  it("does not reuse the same id across strength, risk, pro and con lists", () => {
    const brief = buildApexBrainBriefing(evaluateDecision(sample()));
    const ids = [
      ...brief.strengths,
      ...brief.risks,
      ...brief.advantages,
      ...brief.disadvantages,
    ].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

function signedContains(value: number | null): string {
  if (value == null) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}
