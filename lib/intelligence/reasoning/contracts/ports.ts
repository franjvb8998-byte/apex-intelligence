/**
 * APEX Reasoning Layer — ports only file (kept separate from types).
 */

import type {
  ConfidenceScore,
  Explanation,
  PredictionReport,
  ReasoningInput,
  ReasoningOutput,
  Recommendation,
  RiskAnalysis,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts/types";

/** Orchestrates end-to-end reasoning for a match. */
export interface ReasoningService {
  reason(input: ReasoningInput): Promise<ReasoningOutput>;
}

/** Builds natural-language / structured explanations. */
export interface ExplainabilityService {
  explain(
    input: ReasoningInput,
    draft: Partial<ReasoningOutput>,
  ): Promise<Explanation>;
}

/** Produces calibrated confidence scores. */
export interface ConfidenceService {
  score(
    input: ReasoningInput,
    draft: Partial<ReasoningOutput>,
  ): Promise<ConfidenceScore>;
}

/** Generates actionable recommendations. */
export interface RecommendationService {
  recommend(input: ReasoningInput): Promise<Recommendation[]>;
}

/** Detects value / edge opportunities. */
export interface ValueBetService {
  findOpportunities(input: ReasoningInput): Promise<ValueOpportunity[]>;
}

/** Assembles a durable prediction report. */
export interface ReportService {
  buildReport(
    input: ReasoningInput,
    output: ReasoningOutput,
  ): Promise<PredictionReport>;
}

/** Analyzes risk profile for recommendations. */
export interface RiskAnalysisService {
  analyze(
    input: ReasoningInput,
    recommendations: Recommendation[],
  ): Promise<RiskAnalysis>;
}

/** Future LLM / prompt adapter — not wired to OpenAI. */
export interface ReasoningLlmAdapter {
  complete(prompt: string): Promise<string>;
}

/** Prompt catalogue access. */
export interface PromptCatalog {
  get(templateId: string, variables?: Record<string, string>): string;
}
