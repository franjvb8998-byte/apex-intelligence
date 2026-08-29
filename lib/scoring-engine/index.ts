/**
 * APEX Scoring Engine v2 — official platform score.
 *
 *   import { createScoringEngine } from "@/lib/scoring-engine";
 *
 * Does not fetch HTTP, does not change Decision Engine weights, and does not invent prices.
 */

export type {
  ApexScoring,
  ScoringComponent,
  ScoringComponentKey,
  ScoringEngineInput,
  ScoringExplanation,
  ScoringExplanationFactor,
  ScoringRecommendation,
  ScoringTier,
} from "@/lib/scoring-engine/types";

export {
  SCORING_COMPONENT_LABELS,
  SCORING_TIER_STARS,
  SCORING_WEIGHTS,
} from "@/lib/scoring-engine/weights";

export { clamp, component, coverageBlend, roundScore } from "@/lib/scoring-engine/normalizers";

export {
  publishedExpectedValue,
  publishedMarketEdge,
  scoreConfidence,
  scoreDataQuality,
  scoreExpectedValue,
  scoreMarketValue,
  scoreMomentum,
  scoreProbability,
  scoreRisk,
  scoreTactical,
  scoreTeamIntelligence,
} from "@/lib/scoring-engine/scores";

export { recommendScoring } from "@/lib/scoring-engine/recommend";
export { explainScoring } from "@/lib/scoring-engine/explain";

export {
  createScoringEngine,
  evaluateScoring,
  evaluateScoringFromEngines,
  scoringComponents,
  type ScoringEnginePort,
} from "@/lib/scoring-engine/evaluate";

export {
  emptyScoringInput,
  scoringInputFromEngines,
} from "@/lib/scoring-engine/builders";

export {
  apexScoreFromScoring,
  scoreMatchSelection,
  verdictKindFromTier,
} from "@/lib/scoring-engine/from-match";
