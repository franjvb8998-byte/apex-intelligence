import { cache } from "react";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { getMockBankroll, loadBankrollFixtures } from "@/lib/bankroll";
import { loadDashboardWorkspace } from "@/lib/dashboard";
import { loadUnlessQuota } from "@/lib/repositories";
import { createLearningEngineWithMocks } from "@/lib/learning-engine";
import {
  fixtureIdFromMatch,
  matchAnalysisHref,
} from "@/lib/match-center/fixture-id";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { BankrollData, BankrollFixture } from "@/lib/bankroll/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";
import type { LearningCase } from "@/lib/learning-engine/types/case";
import type { ApexMatchRating } from "@/lib/match-rating/types";

export type LabScanLoad =
  | { ok: true; analyzed: ApexOpportunity[]; generatedAt: string }
  | { ok: false };

export type LabFeaturedLoad = {
  label: string | null;
  href: string;
  decision: ApexDecision | null;
  rating: ApexMatchRating | null;
  explainable: ExplainablePrediction | null;
  probability: {
    modelVersion: string;
    home: number;
    draw: number;
    away: number;
  } | null;
  quotaExhausted: boolean;
};

export type LabResearchLoad = {
  report: EvaluationReport;
  knowledge: KnowledgeDiscovery[];
  cases: LearningCase[];
};

export const loadLabScan = cache(async (): Promise<LabScanLoad> => {
  const loaded = await loadUnlessQuota(() => getApexOpportunities());
  if (!loaded.ok) return { ok: false };
  return {
    ok: true,
    analyzed: loaded.data.analyzed,
    generatedAt: loaded.data.generatedAt,
  };
});

export const loadLabResearch = cache(async (): Promise<LabResearchLoad> => {
  const { engine } = await createLearningEngineWithMocks();
  const cases = await engine.listCases();
  const report = await engine.evaluate(cases[0]?.prediction.modelVersion);
  const knowledge = await engine.listKnowledge();
  return { report, knowledge, cases };
});

export type LabBookLoad = {
  data: BankrollData;
  fixtures: BankrollFixture[];
};

export const loadLabBook = cache(async (): Promise<LabBookLoad> => {
  const data = getMockBankroll();
  let fixtures: BankrollFixture[] = [];
  try {
    fixtures = await loadBankrollFixtures();
  } catch {
    fixtures = [];
  }
  return { data, fixtures };
});

export const loadLabFeatured = cache(async (): Promise<LabFeaturedLoad> => {
  const { matchCenter, quotaExhausted } = await loadDashboardWorkspace();
  if (!matchCenter) {
    return {
      label: null,
      href: "/match-analysis",
      decision: null,
      rating: null,
      explainable: null,
      probability: null,
      quotaExhausted,
    };
  }
  const analysis = matchCenter.preview.analysis;
  const fixtureId = fixtureIdFromMatch({
    id: matchCenter.match.matchId,
    externalId: matchCenter.match.externalId,
  });
  return {
    label: `${matchCenter.match.homeTeam.name} vs ${matchCenter.match.awayTeam.name}`,
    href: fixtureId ? matchAnalysisHref(fixtureId) : "/match-analysis",
    decision: analysis.decision,
    rating: analysis.rating,
    explainable: analysis.explainable,
    probability: {
      modelVersion: analysis.modelVersion,
      home: analysis.oneXTwo.home,
      draw: analysis.oneXTwo.draw,
      away: analysis.oneXTwo.away,
    },
    quotaExhausted,
  };
});
