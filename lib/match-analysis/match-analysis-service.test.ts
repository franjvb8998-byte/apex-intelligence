import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "@/lib/data-platform/mock-provider";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import {
  createMatchAnalysisService,
  MatchAnalysisService,
} from "@/lib/match-analysis/match-analysis-service";
import {
  analyzeMatchWithRules,
  confidenceFromProbability,
} from "@/lib/match-analysis/rules/analyze-with-rules";
import { getMockMatchCenter } from "@/lib/match-center/mock-data";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";

describe("MatchAnalysisService", () => {
  it("analyzes a Data Platform bundle end-to-end with rules", async () => {
    const provider = createMockDataProvider();
    const bundle = await provider.getMatch({ matchId: "demo-1001" });
    const service = createMatchAnalysisService();
    const analysis = service.analyzeBundle(bundle);

    expect(analysis.matchId).toBe(bundle.match.id);
    expect(analysis.prediction.outcome).toMatch(/home|draw|away/);
    expect(analysis.confidence.value).toBeGreaterThan(0);
    expect(analysis.confidence.band).toMatch(/low|medium|high/);
    expect(analysis.expectedGoals.total).toBeGreaterThan(0);
    expect(analysis.strengths.length).toBeGreaterThan(0);
    expect(analysis.weaknesses.length).toBeGreaterThan(0);
    expect(analysis.tacticalFactors.length).toBeGreaterThan(0);
    expect(analysis.riskLevel).toMatch(/low|medium|high/);
    expect(analysis.recommendation.action).toMatch(
      /bet|pass|watch|reduce_stake|other/,
    );
    expect(analysis.explainability.summary).toBeTruthy();
    expect(analysis.explainability.narrative).toContain("Probability Engine");
    expect(analysis.explainable.method).toBe("rules");
    expect(analysis.explainable.positiveFactors.length).toBeGreaterThan(0);
    expect(analysis.source.reasoning).toBe("rules");
    expect(analysis.source.probabilityEngine).toBe(true);
    expect(analysis.source.dataPlatform).toBe(true);
  });

  it("honours injected probability engine", async () => {
    const provider = createMockDataProvider();
    const bundle = await provider.getMatch({ matchId: "demo-1001" });
    const engine = createEloPoissonHybridEngine();
    const service = new MatchAnalysisService({ engine });
    const a = service.analyzeBundle(bundle, { homeElo: 1700, awayElo: 1400 });
    const b = service.analyzeBundle(bundle, { homeElo: 1400, awayElo: 1700 });
    expect(a.prediction.oneXTwo.home).toBeGreaterThan(b.prediction.oneXTwo.home);
  });

  it("surfaces value bet when market odds are soft", async () => {
    const provider = createMockDataProvider();
    const bundle = await provider.getMatch({ matchId: "demo-1001" });
    const service = createMatchAnalysisService();
    const analysis = service.analyzeBundle(bundle, {
      homeElo: 1700,
      awayElo: 1400,
      marketOdds: { home: 3.5, draw: 3.4, away: 2.1 },
    });
    // Soft home odds with strong home model should produce edge when home is predicted
    if (analysis.prediction.outcome === "home") {
      expect(analysis.valueBet).not.toBeNull();
      expect(analysis.valueBet!.edge).toBeGreaterThan(0.03);
    }
  });
});

describe("analyzeMatchWithRules", () => {
  it("builds explainability without OpenAI", () => {
    const probability = createEloPoissonHybridEngine().predict({
      homeElo: 1600,
      awayElo: 1500,
    });
    const now = new Date().toISOString();
    const analysis = analyzeMatchWithRules({
      match: {
        id: "m1",
        leagueId: "l1",
        homeTeamId: "h",
        awayTeamId: "a",
        kickoffAt: now,
        status: "scheduled",
        score: { home: null, away: null },
        venue: null,
        minute: null,
        externalRefs: [],
        ingestedAt: now,
        updatedAt: now,
      },
      homeTeam: {
        id: "h",
        leagueId: "l1",
        name: "Home FC",
        shortName: "HOM",
        crestUrl: null,
        externalRefs: [],
      },
      awayTeam: {
        id: "a",
        leagueId: "l1",
        name: "Away United",
        shortName: "AWY",
        crestUrl: null,
        externalRefs: [],
      },
      probability,
      confidence: confidenceFromProbability(probability),
      teamStats: {
        home: { form: "WWWWW", wins: 15, goalsAgainst: 10 },
        away: { form: "LLDLL", wins: 4, goalsAgainst: 35 },
      },
    });

    expect(analysis.recentForm.home).toBe("WWWWW");
    expect(analysis.explainability.caveats?.some((c) => c.includes("LLM"))).toBe(
      true,
    );
    expect(analysis.keyPlayers).toEqual([]);
    expect(analysis.injuries).toEqual([]);
  });
});

describe("Match Center AI Analysis wiring", () => {
  it("includes aiAnalysis on mock Match Center payload", () => {
    const data = getMockMatchCenter({ status: "scheduled" });
    expect(data.aiAnalysis.prediction.label).toBeTruthy();
    expect(data.aiAnalysis.source.reasoning).toBe("rules");
  });

  it("includes aiAnalysis when mapping Data Platform bundle", async () => {
    const provider = createMockDataProvider();
    const bundle = await provider.getMatch({ matchId: "demo-1001" });
    const center = createMatchCenterFromApexBundle(bundle);
    expect(center.aiAnalysis.matchId).toBe(bundle.match.id);
    expect(center.preview.analysis.explanation.summary).toContain("Lectura APEX");
  });
});
