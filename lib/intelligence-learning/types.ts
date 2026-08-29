/**
 * APEX Intelligence Learning System — persisted recommendation + settlement contracts.
 * Future ML models consume these records. No HTTP. No UI.
 */

import type { MatchOutcome } from "@/lib/intelligence/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export type RecommendationId = string;

export type RecommendationSource = "scanner" | "match-analysis" | "smart-combo";

export type LearningMarket = "1x2" | "combo";

export type RecommendationStatus = "pending" | "settled";

export const INTELLIGENCE_LEARNING_VERSION = "intelligence-learning-v1";

export type EngineVersion = {
  learning: typeof INTELLIGENCE_LEARNING_VERSION;
  scoring: string;
  decision: string;
};

export type RecommendationTeams = {
  home: string;
  away: string;
};

export type RecommendationReasoning = {
  summary: string;
  supporting: Array<{ key: string; title: string; detail: string }>;
  against: Array<{ key: string; title: string; detail: string }>;
  reasonsFor: Array<{ id: string; title: string; detail: string }>;
  reasonsAgainst: Array<{ id: string; title: string; detail: string }>;
};

/**
 * Frozen snapshot of a published Scoring Engine recommendation.
 * Missing signals stay null. Never invent odds, scores, or news.
 */
export type RecommendationRecord = {
  id: RecommendationId;
  pendingKey: string;
  timestamp: string;
  source: RecommendationSource;
  fixtureId: string;
  competition: string;
  teams: RecommendationTeams;
  market: LearningMarket;
  selectionLabel: string;
  predicted: MatchOutcome | "combo" | null;
  odds: number | null;
  recommendation: ScoringTier;
  apexScore: number;
  confidence: number | null;
  risk: number | null;
  expectedValue: number | null;
  kellyStake: number | null;
  stakePct: number;
  teamIntelligence: number | null;
  momentum: number | null;
  tacticalScore: number | null;
  marketScore: number | null;
  dataQuality: number | null;
  reasoning: RecommendationReasoning;
  engineVersion: EngineVersion;
  status: RecommendationStatus;
};

export type RecommendationDraft = Omit<
  RecommendationRecord,
  "id" | "pendingKey" | "status"
> & {
  id?: RecommendationId;
};

export type ResultRecord = {
  recommendationId: RecommendationId;
  settlementDate: string;
  homeScore: number | null;
  awayScore: number | null;
  marketOutcome: string;
  selectionHit: boolean;
  recommendationCorrect: boolean;
  win: boolean;
  loss: boolean;
  stake: number;
  payout: number;
  roi: number | null;
  evRealized: number | null;
  sizedStake: number;
  sizedPayout: number;
  sizedRoi: number | null;
};

export type SettlementInput = {
  recommendationId: RecommendationId;
  settlementDate: string;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Winning 1X2 side, or "hit" / "miss" for a combo fold. */
  marketOutcome: string;
};

export type SettledLearningCase = {
  recommendation: RecommendationRecord;
  result: ResultRecord;
};

export type SliceMetrics = {
  key: string;
  sampleSize: number;
  wins: number;
  losses: number;
  winRate: number | null;
  roi: number | null;
  sizedRoi: number | null;
  averageOdds: number | null;
  averageEv: number | null;
  averageStake: number | null;
  averageApexScore: number | null;
  averageConfidence: number | null;
  kellyEfficiency: number | null;
};

export type PerformanceReport = {
  engineVersion: typeof INTELLIGENCE_LEARNING_VERSION;
  sampleSize: number;
  pendingCount: number;
  settledCount: number;
  overall: SliceMetrics;
  byRecommendationTier: SliceMetrics[];
  byMarket: SliceMetrics[];
  byLeague: SliceMetrics[];
  byConfidenceBucket: SliceMetrics[];
  byApexScoreBucket: SliceMetrics[];
};

export type CalibrationBin = {
  label: string;
  /** Mean predicted confidence in the bin, 0–1. */
  predicted: number;
  /** Observed selection hit rate, 0–1. */
  observed: number;
  /** |predicted − observed|. */
  calibrationError: number;
  count: number;
};

export type CalibrationReport = {
  engineVersion: typeof INTELLIGENCE_LEARNING_VERSION;
  sampleSize: number;
  /** Expected Calibration Error over confidence bins. */
  ece: number;
  bins: CalibrationBin[];
};

export type LearningMetricRow = {
  key: string;
  sampleSize: number;
  roi: number | null;
  winRate: number | null;
  averageEv: number | null;
  averageConfidence: number | null;
  variance: number | null;
};

export type LearningMetricsReport = {
  engineVersion: typeof INTELLIGENCE_LEARNING_VERSION;
  sampleSize: number;
  mostProfitableMarkets: LearningMetricRow[];
  worstMarkets: LearningMetricRow[];
  bestLeagues: LearningMetricRow[];
  worstLeagues: LearningMetricRow[];
  highestConfidenceMarkets: LearningMetricRow[];
  highestVarianceMarkets: LearningMetricRow[];
  highestExpectedValueMarkets: LearningMetricRow[];
};

/**
 * Flat row for future supervised models. Labels stay null until settlement.
 * Do not train on this yet — only persist and export.
 */
export type LearningFeatureRow = {
  recommendationId: RecommendationId;
  timestamp: string;
  source: RecommendationSource;
  fixtureId: string;
  competition: string;
  market: LearningMarket;
  recommendation: ScoringTier;
  apexScore: number;
  confidence: number | null;
  risk: number | null;
  expectedValue: number | null;
  kellyStake: number | null;
  stakePct: number;
  odds: number | null;
  teamIntelligence: number | null;
  momentum: number | null;
  tacticalScore: number | null;
  marketScore: number | null;
  dataQuality: number | null;
  engineScoring: string;
  engineDecision: string;
  labelHit: boolean | null;
  labelRoi: number | null;
  labelCorrect: boolean | null;
};
