import { describe, expect, it } from "vitest";
import {
  buildLearningCase,
  createMockLearningFixtures,
} from "@/lib/learning-engine";
import { DECISION_POSITIVE_WEIGHTS } from "@/lib/decision-engine/weights";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { simulateUnitMarks } from "@/lib/lab/backtest";
import { buildComparison } from "@/lib/lab/compare";
import { decisionWeightBars, learningFactorBars } from "@/lib/lab/features";
import { LAB_MODELS, LAB_SECTIONS } from "@/lib/lab/registry";
import {
  DEFAULT_LAB_STRATEGY,
  labStrategyPasses,
  paperLabStrategy,
} from "@/lib/lab/strategy";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";

function opportunity(overrides: Partial<ApexOpportunity> = {}): ApexOpportunity {
  return {
    fixtureId: "1035089",
    kickoffAt: "2026-08-27T19:00:00.000Z",
    leagueName: "Premier League",
    country: "England",
    market: "1x2",
    home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
    away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
    predicted: "home",
    selectionLabel: "Arsenal",
    score: 66,
    stars: 1,
    confidence: 37,
    confidenceBand: "low",
    riskBand: "medium",
    riskScore: 42,
    fairOdds: 1.64,
    bookmakerOdds: 1.7,
    valuePct: 0.04,
    expectedValue: 0.04,
    marketEdge: 0.04,
    kellyPct: 1.4,
    stakePct: 0,
    stakeLabel: "0%",
    verdict: "avoid",
    verdictLabel: "Avoid",
    recommendation: "Avoid",
    explanation: "Skip.",
    reasonsFor: [],
    reasonsAgainst: [],
    positiveEdge: true,
    ...overrides,
  };
}

function emptyReport(): EvaluationReport {
  return {
    id: "eval:test",
    modelVersion: DEFAULT_HYBRID_CONFIG.modelVersion,
    sampleSize: 4,
    evaluatedAt: "2026-08-27T00:00:00.000Z",
    accuracy: {
      outcome: 0.25,
      byOutcome: {
        home: { support: 3, accuracy: 0.33 },
        draw: { support: 0, accuracy: 0 },
        away: { support: 1, accuracy: 0 },
      },
      markets: {},
    },
    calibration: { ece: 0.12, bins: [] },
    biases: [],
    patterns: [],
    recommendations: [],
    aggregateError: { meanBrier: 0.4, meanOutcomeError: 0.75 },
  };
}

describe("APEX Lab", () => {
  it("catalogues the ten research sections and published engines", () => {
    expect(LAB_SECTIONS.map((section) => section.id)).toEqual([
      "library",
      "backtest",
      "strategy",
      "compare",
      "simulate",
      "reports",
      "explain",
      "features",
      "decision",
      "versions",
    ]);
    expect(LAB_MODELS.some((model) => model.version === "deterministic-v1")).toBe(
      true,
    );
    expect(
      LAB_MODELS.some(
        (model) => model.version === DEFAULT_HYBRID_CONFIG.modelVersion,
      ),
    ).toBe(true);
    expect(LAB_MODELS.every((model) => model.href.startsWith("/"))).toBe(true);
  });

  it("papers a strategy on Decision Engine rows without re-scoring", () => {
    const rows = [
      opportunity(),
      opportunity({
        fixtureId: "2",
        score: 82,
        confidence: 74,
        expectedValue: 0.08,
        verdict: "elite_pick",
        riskBand: "low",
      }),
    ];
    const open = paperLabStrategy(rows, DEFAULT_LAB_STRATEGY);
    expect(open.selected).toBe(2);
    expect(open.scanned).toBe(2);

    const quality = paperLabStrategy(rows, {
      id: "quality",
      name: "Quality desk",
      minScore: 75,
      minConfidence: 65,
      minEv: 0,
      risk: "all",
      verdicts: ["elite_pick", "strong_bet", "lean_bet", "pass", "avoid"],
    });
    expect(quality.selected).toBe(1);
    expect(quality.passed[0]?.fixtureId).toBe("2");
    expect(labStrategyPasses(rows[0]!, DEFAULT_LAB_STRATEGY)).toBe(true);
  });

  it("walks Learning Engine closed-book cases as unit marks", () => {
    const cases = createMockLearningFixtures().map((fixture) =>
      buildLearningCase(fixture),
    );
    const backtest = simulateUnitMarks(cases);
    expect(backtest.sampleSize).toBe(4);
    expect(backtest.hitRate).toBe(0.25);
    expect(backtest.equity.at(-1)?.value).toBe(-2);
    expect(backtest.marks[0]?.hit).toBe(true);
    expect(backtest.modelVersion).toBe(DEFAULT_HYBRID_CONFIG.modelVersion);
  });

  it("compares paired featured engines and unpaired research samples", () => {
    const rows = buildComparison({
      analyzed: [opportunity()],
      report: emptyReport(),
      featured: {
        label: "Arsenal vs Chelsea",
        href: "/match-analysis/1035089",
        decision: null,
        rating: null,
        explainable: null,
        probability: {
          modelVersion: DEFAULT_HYBRID_CONFIG.modelVersion,
          home: 0.48,
          draw: 0.27,
          away: 0.25,
        },
      },
    });
    expect(rows.some((row) => row.paired && row.id === "paired-probability")).toBe(
      true,
    );
    expect(rows.some((row) => row.id === "decision-engine" && !row.paired)).toBe(
      true,
    );
    expect(rows.some((row) => row.id === "probability-engine")).toBe(true);
  });

  it("exposes published Decision Engine weights and learning factor mass", () => {
    const weights = decisionWeightBars();
    const attack = weights.find((bar) => bar.key === "attack");
    expect(attack?.weight).toBe(DECISION_POSITIVE_WEIGHTS.attack);
    expect(weights.some((bar) => bar.key === "injuries")).toBe(true);

    const cases = createMockLearningFixtures().map((fixture) =>
      buildLearningCase(fixture),
    );
    const factors = learningFactorBars(cases);
    expect(factors.length).toBeGreaterThan(0);
    expect(factors.every((bar) => bar.weight >= 0 && bar.weight <= 1)).toBe(true);
  });
});
