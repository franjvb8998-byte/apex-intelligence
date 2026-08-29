export type {
  ApexScoreBreakdown,
  MatchAnalysisData,
  MatchAnalysisExplanation,
  MatchAnalysisMarket,
  MatchAnalysisTeam,
  MatchRisk,
} from "@/lib/match-analysis/types";

export type {
  MatchAnalysis,
  MatchAnalysisInput,
  MatchAnalysisFactor,
  MatchAnalysisPrediction,
  MatchAnalysisTeamStats,
  MatchAnalysisFromBundleOptions,
} from "@/lib/match-analysis/analysis-types";

export { getMockMatchAnalysis } from "@/lib/match-analysis/mock-data";

export {
  MatchAnalysisService,
  createMatchAnalysisService,
} from "@/lib/match-analysis/match-analysis-service";

export {
  getMatchAnalysisData,
  listMatchAnalysisFixtures,
  type LoadMatchAnalysisOptions,
} from "@/lib/match-analysis/load";

export {
  buildPremiumAnalysis,
  type PremiumAnalysis,
  type PremiumCompareKey,
  type PremiumCompareRow,
  type PremiumContribution,
  type PremiumContextFactor,
  type PremiumContextTitleKey,
  type PremiumEvidenceId,
  type PremiumEvidenceSignal,
  type PremiumMarketMove,
  type PremiumRecKind,
  type PremiumRecommendation,
} from "@/lib/match-analysis/premium";

export {
  analyzeMatchWithRules,
  confidenceFromProbability,
} from "@/lib/match-analysis/rules/analyze-with-rules";
