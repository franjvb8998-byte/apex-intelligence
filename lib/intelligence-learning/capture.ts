/**
 * Side-effect capture for published recommendations.
 * Writers stay synchronous. Failures never break scoring or combo math.
 */

import { recommendationDraftFromCombo } from "@/lib/intelligence-learning/from-combo";
import { recommendationDraftFromMatchSelection } from "@/lib/intelligence-learning/from-match";
import { recommendationDraftFromOpportunity } from "@/lib/intelligence-learning/from-opportunity";
import { getIntelligenceLearningSystem } from "@/lib/intelligence-learning/system";
import type { RecommendationDraft, RecommendationRecord } from "@/lib/intelligence-learning/types";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { MatchAnalysisCore } from "@/lib/decision-engine/from-match";
import type { ApexScoring } from "@/lib/scoring-engine/types";
import type { ComboAnalysis } from "@/lib/smart-combos/types";

export function captureRecommendation(
  draft: RecommendationDraft,
): RecommendationRecord | null {
  try {
    return getIntelligenceLearningSystem().register(draft);
  } catch {
    return null;
  }
}

export function captureOpportunityRecommendation(
  row: ApexOpportunity,
  scoring?: ApexScoring,
): RecommendationRecord | null {
  return captureRecommendation(recommendationDraftFromOpportunity(row, scoring));
}

export function captureMatchRecommendation(input: {
  analysis: MatchAnalysisCore;
  decision: ApexDecision;
  scoring: ApexScoring;
}): RecommendationRecord | null {
  return captureRecommendation(recommendationDraftFromMatchSelection(input));
}

export function captureComboRecommendation(
  analysis: ComboAnalysis,
  scoring?: ApexScoring,
): RecommendationRecord | null {
  return captureRecommendation(recommendationDraftFromCombo(analysis, scoring));
}
