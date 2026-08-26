/**
 * APEX Intelligence — Reasoning Layer
 *
 * Architecture-only scaffolding. No OpenAI. Does not modify Probability Engine,
 * Learning Engine, Data Platform, or HTTP APIs.
 *
 * @see docs/REASONING_LAYER.md
 */

export type {
  ConfidenceScore,
  ConfidenceService,
  Explanation,
  ExplainabilityService,
  PredictionReport,
  PromptCatalog,
  ReasoningId,
  ReasoningInput,
  ReasoningLlmAdapter,
  ReasoningMarketKey,
  ReasoningOutput,
  ReasoningService,
  ReasoningSide,
  Recommendation,
  RecommendationService,
  ReportService,
  RiskAnalysis,
  RiskAnalysisService,
  ValueBetService,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts";

export {
  createStubReasoningLlmAdapter,
  StubReasoningLlmAdapter,
} from "@/lib/intelligence/reasoning/adapters";

export {
  createStubPromptCatalog,
  REASONING_PROMPT_IDS,
  StubPromptCatalog,
  type ReasoningPromptId,
} from "@/lib/intelligence/reasoning/prompts";

export {
  createStubExplainabilityService,
  StubExplainabilityService,
} from "@/lib/intelligence/reasoning/explainability";

export {
  createStubConfidenceService,
  StubConfidenceService,
} from "@/lib/intelligence/reasoning/confidence";

export {
  createStubRecommendationService,
  StubRecommendationService,
} from "@/lib/intelligence/reasoning/recommendations";

export {
  createStubValueBetService,
  StubValueBetService,
} from "@/lib/intelligence/reasoning/value-bet";

export {
  createStubReportService,
  StubReportService,
} from "@/lib/intelligence/reasoning/reports";

export {
  createReasoningLayer,
  createStubReasoningService,
  createStubRiskAnalysisService,
  StubReasoningService,
  StubRiskAnalysisService,
  type ReasoningLayer,
} from "@/lib/intelligence/reasoning/services";
