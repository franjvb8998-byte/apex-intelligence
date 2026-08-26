/**
 * APEX Reasoning Layer — service ports (interfaces) + domain types.
 */

export type {
  ConfidenceScore,
  Explanation,
  PredictionReport,
  ReasoningId,
  ReasoningInput,
  ReasoningMarketKey,
  ReasoningOutput,
  ReasoningSide,
  Recommendation,
  RiskAnalysis,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts/types";

export type {
  ConfidenceService,
  ExplainabilityService,
  PromptCatalog,
  ReasoningLlmAdapter,
  ReasoningService,
  RecommendationService,
  ReportService,
  RiskAnalysisService,
  ValueBetService,
} from "@/lib/intelligence/reasoning/contracts/ports";
