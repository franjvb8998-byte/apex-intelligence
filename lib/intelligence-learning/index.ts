/**
 * APEX Intelligence Learning System.
 *
 * Persists every Scoring Engine recommendation, settles results later, and
 * computes performance / calibration / market metrics. No UI. No HTTP.
 *
 *   import { createIntelligenceLearningSystem } from "@/lib/intelligence-learning";
 */

export type {
  CalibrationBin,
  CalibrationReport,
  EngineVersion,
  LearningFeatureRow,
  LearningMarket,
  LearningMetricRow,
  LearningMetricsReport,
  PerformanceReport,
  RecommendationDraft,
  RecommendationId,
  RecommendationReasoning,
  RecommendationRecord,
  RecommendationSource,
  RecommendationStatus,
  RecommendationTeams,
  ResultRecord,
  SettledLearningCase,
  SettlementInput,
  SliceMetrics,
} from "@/lib/intelligence-learning/types";

export { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";

export type {
  IntelligenceLearningStore,
  IntelligenceLearningSystem,
  RecommendationListFilter,
  RecommendationRegistry,
  ResultRegistry,
} from "@/lib/intelligence-learning/contracts";

export { InMemoryIntelligenceLearningStore } from "@/lib/intelligence-learning/memory";
export {
  createIntelligenceLearningSystem,
  getIntelligenceLearningSystem,
  resetIntelligenceLearningSystem,
  type IntelligenceLearningServices,
} from "@/lib/intelligence-learning/system";

export { createRecommendationRegistry } from "@/lib/intelligence-learning/recommendations";
export { createResultRegistry, settleRecommendation } from "@/lib/intelligence-learning/results";
export { evaluatePerformance } from "@/lib/intelligence-learning/performance";
export { evaluateCalibration } from "@/lib/intelligence-learning/calibration";
export { evaluateLearningMetrics } from "@/lib/intelligence-learning/metrics";
export { exportLearningDataset, toFeatureRow } from "@/lib/intelligence-learning/dataset";

export { recommendationDraftFromOpportunity } from "@/lib/intelligence-learning/from-opportunity";
export { recommendationDraftFromMatchSelection } from "@/lib/intelligence-learning/from-match";
export { recommendationDraftFromCombo } from "@/lib/intelligence-learning/from-combo";
export { recommendationDraftFixture } from "@/lib/intelligence-learning/fixture";
export {
  captureComboRecommendation,
  captureMatchRecommendation,
  captureOpportunityRecommendation,
  captureRecommendation,
} from "@/lib/intelligence-learning/capture";
