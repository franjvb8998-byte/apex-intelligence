export {
  StubReasoningService,
  createStubReasoningService,
} from "@/lib/intelligence/reasoning/services/reasoning-service";

export {
  StubRiskAnalysisService,
  createStubRiskAnalysisService,
} from "@/lib/intelligence/reasoning/services/risk-analysis-service";

import type {
  ConfidenceService,
  ExplainabilityService,
  PromptCatalog,
  ReasoningLlmAdapter,
  ReasoningService,
  RecommendationService,
  ReportService,
  RiskAnalysisService,
  ValueBetService,
} from "@/lib/intelligence/reasoning/contracts";
import { createStubReasoningLlmAdapter } from "@/lib/intelligence/reasoning/adapters";
import { createStubConfidenceService } from "@/lib/intelligence/reasoning/confidence";
import { createStubExplainabilityService } from "@/lib/intelligence/reasoning/explainability";
import { createStubPromptCatalog } from "@/lib/intelligence/reasoning/prompts";
import { createStubRecommendationService } from "@/lib/intelligence/reasoning/recommendations";
import { createStubReportService } from "@/lib/intelligence/reasoning/reports";
import { createStubReasoningService } from "@/lib/intelligence/reasoning/services/reasoning-service";
import { createStubRiskAnalysisService } from "@/lib/intelligence/reasoning/services/risk-analysis-service";
import { createStubValueBetService } from "@/lib/intelligence/reasoning/value-bet";

/** Composition root for the Reasoning Layer (all stubs). */
export type ReasoningLayer = {
  reasoning: ReasoningService;
  explainability: ExplainabilityService;
  confidence: ConfidenceService;
  recommendations: RecommendationService;
  valueBet: ValueBetService;
  reports: ReportService;
  risk: RiskAnalysisService;
  prompts: PromptCatalog;
  llm: ReasoningLlmAdapter;
};

export function createReasoningLayer(): ReasoningLayer {
  return {
    reasoning: createStubReasoningService(),
    explainability: createStubExplainabilityService(),
    confidence: createStubConfidenceService(),
    recommendations: createStubRecommendationService(),
    valueBet: createStubValueBetService(),
    reports: createStubReportService(),
    risk: createStubRiskAnalysisService(),
    prompts: createStubPromptCatalog(),
    llm: createStubReasoningLlmAdapter(),
  };
}
