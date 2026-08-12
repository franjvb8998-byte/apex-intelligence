export type {
  ApexScoreBreakdown,
  MatchAnalysisData,
  MatchAnalysisExplanation,
  MatchAnalysisMarket,
  MatchAnalysisTeam,
  MatchRisk,
} from "@/lib/match-analysis/types";
export { getMockMatchAnalysis } from "@/lib/match-analysis/mock-data";

/**
 * Future adapter seam:
 * createMatchAnalysisFromCore(result: HybridProbabilityResult, explanation, …): MatchAnalysisData
 * TODO(core-wire): implement when PredictionPipeline is live.
 */
