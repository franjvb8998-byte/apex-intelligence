import { describe, expect, it } from "vitest";
import { createDeterministicDecisionEngine, evaluateDecision } from "@/lib/decision-engine/evaluate";
import { snapStake } from "@/lib/decision-engine/sizing";
import { MAX_STAKE_PCT } from "@/lib/decision-engine/weights";
import type { ApexDecisionInput } from "@/lib/decision-engine/types";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";

function sample(over: Partial<ApexDecisionInput> = {}): ApexDecisionInput {
  return {
    matchId: "apex:test:decision",
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

describe("APEX Decision Engine v1", () => {
  it("is deterministic and never random", () => {
    const engine = createDeterministicDecisionEngine();
    const a = engine.evaluate(sample());
    const b = evaluateDecision(sample());
    expect(a).toEqual(b);
    expect(a.engineId).toBe("deterministic-v1");
  });

  it("returns a 0–100 score, confidence band, risk band and 5-tier verdict", () => {
    const decision = evaluateDecision(sample());
    expect(decision.score.value).toBeGreaterThanOrEqual(0);
    expect(decision.score.value).toBeLessThanOrEqual(100);
    expect(decision.confidence.value).not.toBe(Math.round(sample().oneXTwo.home * 100));
    expect(["low", "medium", "high"]).toContain(decision.confidence.band);
    expect(["low", "medium", "high"]).toContain(decision.risk.band);
    expect(decision.verdict.stars).toBeGreaterThanOrEqual(1);
    expect(decision.verdict.stars).toBeLessThanOrEqual(5);
    expect(decision.reasonsFor.length).toBeGreaterThanOrEqual(1);
    expect(decision.reasonsFor.length).toBeLessThanOrEqual(6);
    expect(decision.reasonsAgainst.length).toBeGreaterThanOrEqual(1);
    expect(decision.explanation).toContain("The model");
  });

  it("caps stake at 5% and snaps to the published ladder", () => {
    expect(snapStake(9)).toBe(MAX_STAKE_PCT);
    expect(snapStake(0.4)).toBe(0.5);
    expect(snapStake(0)).toBe(0);
    const decision = evaluateDecision(sample({ decimalOdds: 3.1 }));
    expect(decision.sizing.stakePct).toBeLessThanOrEqual(5);
    expect([0, 0.5, 1, 2, 3, 5]).toContain(decision.sizing.stakePct);
  });

  it("forces 0% stake on negative EV", () => {
    const decision = evaluateDecision(sample({ decimalOdds: 1.15 }));
    expect(decision.value.negativeEdge).toBe(true);
    expect(decision.verdict.kind).toBe("avoid");
    expect(decision.sizing.stakePct).toBe(0);
  });

  it("does not invent derby, rotation or new-coach warnings", () => {
    const decision = evaluateDecision(sample());
    const titles = [...decision.reasonsFor, ...decision.reasonsAgainst, ...decision.risk.reasons]
      .map((row) => row.title)
      .join(" ");
    expect(titles).not.toMatch(/derby|rotation|new coach|cup match/i);
  });

  it("drops unpublished pillars instead of filling them", () => {
    const decision = evaluateDecision(
      sample({
        decimalOdds: null,
        bookmaker: null,
        bookmakerCount: 0,
        home: {
          ...sample().home,
          formLetters: [],
          formQuality: null,
          restDays: null,
          played: null,
          rank: null,
        },
        away: {
          ...sample().away,
          formLetters: [],
          formQuality: null,
          restDays: null,
          played: null,
          rank: null,
        },
        h2h: null,
      }),
    );
    const form = decision.score.components.find((row) => row.key === "form");
    const value = decision.score.components.find((row) => row.key === "value");
    const rest = decision.score.components.find((row) => row.key === "rest");
    expect(form?.available).toBe(false);
    expect(value?.available).toBe(false);
    expect(rest?.available).toBe(false);
    expect(decision.reasonsAgainst.some((row) => /sample|missing|unpublished|thin/i.test(row.title + row.detail))).toBe(
      true,
    );
  });

  it("raises risk and cuts confidence when injuries and congestion are published", () => {
    const clean = evaluateDecision(sample());
    const stressed = evaluateDecision(
      sample({
        home: {
          ...sample().home,
          injuryCount: 3,
          matchesLast7: 2,
        },
        weather: "9° · Heavy rain · Humedad 90%",
      }),
    );
    expect(stressed.risk.score).toBeGreaterThan(clean.risk.score);
    expect(stressed.confidence.value).toBeLessThan(clean.confidence.value);
    expect(stressed.reasonsAgainst.map((row) => row.id)).toEqual(
      expect.arrayContaining(["injuries", "congestion", "weather"]),
    );
  });
});

describe("Decision Engine ← recorded fixture", () => {
  it("stamps a full decision on the recorded API-Football match", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    expect(data.decision.engineId).toBe("deterministic-v1");
    expect(data.scoring?.overall).toBe(data.apexScore.value);
    expect(data.decision.reasonsAgainst.length).toBeGreaterThan(0);
    expect(data.decision.sizing.stakePct).toBeLessThanOrEqual(5);
    expect(data.decision.explanation.length).toBeGreaterThan(40);
    expect(["Elite Pick", "Strong Bet", "Lean Bet", "Pass", "Avoid"]).toContain(
      data.decision.verdict.label,
    );
  });
});
