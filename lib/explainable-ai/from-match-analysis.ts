/**
 * Adapters: Match Analysis → Explainable AI input.
 */

import type { MatchAnalysis } from "@/lib/match-analysis/analysis-types";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability";
import {
  explainPrediction,
  type ExplainableAiInput,
} from "@/lib/explainable-ai/engine";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

/**
 * Prefer the Sprint 10 payload already attached by Match Analysis rules.
 * Falls back to regenerating from PE + analysis signals when needed.
 */
export function explainableFromMatchAnalysis(
  analysis: MatchAnalysis,
  probability: HybridProbabilityResult,
  options?: {
    homeTeamName?: string;
    awayTeamName?: string;
    leagueName?: string | null;
    dataProvider?: string | null;
  },
): ExplainablePrediction {
  if (analysis.explainable) {
    return analysis.explainable;
  }

  const input: ExplainableAiInput = {
    matchId: analysis.matchId,
    homeTeamName: options?.homeTeamName ?? "Local",
    awayTeamName: options?.awayTeamName ?? "Visitante",
    leagueName: options?.leagueName,
    probability,
    confidence: analysis.confidence,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    homeForm: analysis.recentForm.home,
    awayForm: analysis.recentForm.away,
    timelineEventCount: 0,
    dataProvider: options?.dataProvider,
  };
  return explainPrediction(input);
}

export function explainableInputFromAnalysisContext(
  analysis: MatchAnalysis,
  probability: HybridProbabilityResult,
  homeTeamName: string,
  awayTeamName: string,
  extras?: Partial<ExplainableAiInput>,
): ExplainableAiInput {
  return {
    matchId: analysis.matchId,
    homeTeamName,
    awayTeamName,
    probability,
    confidence: analysis.confidence,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    homeForm: analysis.recentForm.home,
    awayForm: analysis.recentForm.away,
    ...extras,
  };
}
