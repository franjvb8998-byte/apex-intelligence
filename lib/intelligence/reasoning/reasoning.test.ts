import { describe, expect, it } from "vitest";
import {
  createReasoningLayer,
  createStubConfidenceService,
  createStubExplainabilityService,
  createStubPromptCatalog,
  createStubReasoningLlmAdapter,
  createStubReasoningService,
  createStubRecommendationService,
  createStubReportService,
  createStubRiskAnalysisService,
  createStubValueBetService,
  REASONING_PROMPT_IDS,
  type ReasoningInput,
  type ReasoningOutput,
  type Recommendation,
  type RiskAnalysis,
  type ConfidenceScore,
  type Explanation,
  type ValueOpportunity,
  type PredictionReport,
} from "@/lib/intelligence/reasoning";

/** Compile-time shape checks — if this file typechecks, contracts are wired. */
const sampleInput: ReasoningInput = {
  matchId: "apex:mock:match:demo-1001",
  homeTeamId: "home",
  awayTeamId: "away",
  oneXTwo: { home: 0.45, draw: 0.28, away: 0.27 },
};

function assertType<_T>(_value: unknown): void {
  // intentional no-op — used only for type positions
}

describe("Reasoning Layer — architecture stubs", () => {
  it("exports contract types that compile", () => {
    assertType<ReasoningInput>(sampleInput);
    assertType<Partial<ReasoningOutput>>({});
    assertType<Partial<Recommendation>>({});
    assertType<Partial<RiskAnalysis>>({});
    assertType<Partial<ConfidenceScore>>({});
    assertType<Partial<Explanation>>({});
    assertType<Partial<ValueOpportunity>>({});
    assertType<Partial<PredictionReport>>({});
    expect(sampleInput.matchId).toBeTruthy();
    expect(REASONING_PROMPT_IDS.matchNarrative).toContain("reasoning");
  });

  it("createReasoningLayer wires stub services", () => {
    const layer = createReasoningLayer();
    expect(layer.reasoning).toBeTruthy();
    expect(layer.explainability).toBeTruthy();
    expect(layer.confidence).toBeTruthy();
    expect(layer.recommendations).toBeTruthy();
    expect(layer.valueBet).toBeTruthy();
    expect(layer.reports).toBeTruthy();
    expect(layer.risk).toBeTruthy();
    expect(layer.prompts).toBeTruthy();
    expect(layer.llm).toBeTruthy();
  });

  it("every stub throws Not implemented", async () => {
    const layer = createReasoningLayer();

    await expect(layer.reasoning.reason(sampleInput)).rejects.toThrow(
      /Not implemented/,
    );
    await expect(
      layer.explainability.explain(sampleInput, {}),
    ).rejects.toThrow(/Not implemented/);
    await expect(layer.confidence.score(sampleInput, {})).rejects.toThrow(
      /Not implemented/,
    );
    await expect(layer.recommendations.recommend(sampleInput)).rejects.toThrow(
      /Not implemented/,
    );
    await expect(layer.valueBet.findOpportunities(sampleInput)).rejects.toThrow(
      /Not implemented/,
    );
    await expect(
      layer.risk.analyze(sampleInput, []),
    ).rejects.toThrow(/Not implemented/);
    await expect(
      layer.reports.buildReport(sampleInput, {
        matchId: sampleInput.matchId,
        generatedAt: new Date().toISOString(),
        confidence: { value: 0, band: "low" },
        explanation: { summary: "", factors: [] },
        recommendations: [],
        risks: { overall: "low", score: 0, items: [] },
        valueOpportunities: [],
      }),
    ).rejects.toThrow(/Not implemented/);
    expect(() => layer.prompts.get("x")).toThrow(/Not implemented/);
    await expect(layer.llm.complete("hi")).rejects.toThrow(/Not implemented/);
  });

  it("individual stub factories are constructible", () => {
    expect(createStubReasoningService()).toBeTruthy();
    expect(createStubExplainabilityService()).toBeTruthy();
    expect(createStubConfidenceService()).toBeTruthy();
    expect(createStubRecommendationService()).toBeTruthy();
    expect(createStubValueBetService()).toBeTruthy();
    expect(createStubReportService()).toBeTruthy();
    expect(createStubRiskAnalysisService()).toBeTruthy();
    expect(createStubPromptCatalog()).toBeTruthy();
    expect(createStubReasoningLlmAdapter()).toBeTruthy();
  });
});
