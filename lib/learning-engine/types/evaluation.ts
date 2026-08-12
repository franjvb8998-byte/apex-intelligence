import type { LearningId, MatchOutcome } from "@/lib/learning-engine/types/case";

export type BiasKind =
  | "home_favorite_overconfidence"
  | "draw_underestimation"
  | "away_underdog_miss"
  | "high_confidence_miss"
  | "market_over_25_bias"
  | "custom";

export type DetectedBias = {
  id: LearningId;
  kind: BiasKind;
  label: string;
  severity: "low" | "medium" | "high";
  evidence: string[];
  score: number;
};

export type RepetitivePattern = {
  id: LearningId;
  label: string;
  description: string;
  matchIds: LearningId[];
  frequency: number;
  confidence: number;
};

export type ModelRecommendation = {
  id: LearningId;
  priority: "low" | "medium" | "high";
  area: "calibration" | "features" | "markets" | "process" | "data";
  title: string;
  detail: string;
  suggestedAction: string;
};

export type CalibrationBin = {
  /** Midpoint of predicted probability bin. */
  predicted: number;
  /** Observed hit rate in bin. */
  observed: number;
  count: number;
};

export type EvaluationReport = {
  id: LearningId;
  modelVersion: string;
  sampleSize: number;
  evaluatedAt: string;
  accuracy: {
    outcome: number;
    byOutcome: Record<MatchOutcome, { support: number; accuracy: number }>;
    markets: Record<string, { support: number; hitRate: number }>;
  };
  calibration: {
    /** Expected Calibration Error (approx). */
    ece: number;
    bins: CalibrationBin[];
  };
  biases: DetectedBias[];
  patterns: RepetitivePattern[];
  recommendations: ModelRecommendation[];
  aggregateError: {
    meanBrier: number;
    meanOutcomeError: number;
  };
};
