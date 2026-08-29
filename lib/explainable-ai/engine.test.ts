import { describe, expect, it } from "vitest";
import {
  createExplainableAiEngine,
  explainPrediction,
  getMockExplainablePrediction,
} from "@/lib/explainable-ai";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import { createMatchAnalysisService } from "@/lib/match-analysis/match-analysis-service";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";

describe("Explainable AI engine", () => {
  it("builds structured explanation from Probability Engine output", () => {
    const probability = createEloPoissonHybridEngine().predict({
      homeElo: 1650,
      awayElo: 1480,
      matchId: "apex:test:explain:1",
    });

    const report = explainPrediction({
      matchId: "apex:test:explain:1",
      homeTeamName: "Home FC",
      awayTeamName: "Away United",
      leagueName: "Test League",
      probability,
      homeForm: "WWDLW",
      awayForm: "LLDWL",
      timelineEventCount: 1,
      dataProvider: "mock",
    });

    expect(report.method).toBe("rules");
    expect(report.predictedOutcome).toMatch(/home|draw|away/);
    expect(report.summary).toContain("Home FC");
    expect(report.confidence.value).toBeGreaterThan(0);
    expect(report.positiveFactors.length).toBeGreaterThan(0);
    expect(report.negativeFactors.length).toBeGreaterThan(0);
    expect(report.evidence.length).toBeGreaterThan(3);
    expect(report.qualityScore.value).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore.value).toBeLessThanOrEqual(100);
    expect(report.qualityScore.band).toMatch(/low|medium|high/);
  });

  it("exposes createExplainableAiEngine factory", () => {
    const engine = createExplainableAiEngine();
    const probability = createEloPoissonHybridEngine().predict({
      homeElo: 1600,
      awayElo: 1600,
    });
    const report = engine.explain({
      matchId: "m",
      homeTeamName: "A",
      awayTeamName: "B",
      probability,
    });
    expect(report.matchId).toBe("m");
  });

  it("provides mock explainable prediction for UI demos", () => {
    const mock = getMockExplainablePrediction();
    expect(mock.evidence.some((e) => e.source === "rules")).toBe(true);
  });
});

describe("Explainable AI · Match Analysis integration", () => {
  it("attaches explainable payload on MatchAnalysis", async () => {
    const provider = createMockDataProvider();
    const bundle = await provider.getMatch({ matchId: "demo-1001" });
    const analysis = createMatchAnalysisService().analyzeBundle(bundle);

    expect(analysis.explainable.matchId).toBe(analysis.matchId);
    expect(analysis.explainable.method).toBe("rules");
    expect(analysis.explainable.positiveFactors.length).toBeGreaterThan(0);
    expect(analysis.explainable.evidence.some((e) => e.label.includes("1X2"))).toBe(
      true,
    );
  });
});

describe("Explainable AI · Copilot mock", () => {
  it("still ships a rules explainable payload for UI demos", () => {
    const report = getMockExplainablePrediction();
    expect(report.method).toBe("rules");
    expect(report.qualityScore.value).toBeGreaterThan(0);
  });
});
