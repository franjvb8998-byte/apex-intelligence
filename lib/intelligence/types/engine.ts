import type {
  ConfidenceScore,
  MatchContext,
  MatchOutcome,
  OutcomeProbability,
  SystemPrediction,
  UUID,
} from "@/lib/intelligence/types/domain";

/** Feature vector produced before model inference. Opaque by design for now. */
export type FeatureVector = {
  matchId: UUID;
  generatedAt: string;
  /** Named numeric features; schema evolves with the model. */
  values: Record<string, number>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ModelInferenceResult = {
  probabilities: OutcomeProbability;
  predictedOutcome: MatchOutcome;
  rawScores?: Record<string, number>;
  modelVersion: string;
};

export type ExplanationFactor = {
  key: string;
  label: string;
  direction: "supports" | "against" | "neutral";
  weight: number;
  detail?: string;
};

export type PredictionExplanation = {
  matchId: UUID;
  summary: string;
  factors: ExplanationFactor[];
  caveats: string[];
};

export type SimulationScenario = {
  id: string;
  label: string;
  assumptions: Record<string, number | string | boolean>;
};

export type SimulationResult = {
  matchId: UUID;
  scenarioId: string;
  probabilities: OutcomeProbability;
  sampleSize: number;
};

export type MarketQuote = {
  matchId: UUID;
  source: string;
  capturedAt: string;
  /** Decimal odds for home / draw / away. */
  odds: OutcomeProbability;
  /** Implied probabilities after removing overround (optional). */
  impliedProbabilities?: OutcomeProbability;
};

export type ValueSignal = {
  matchId: UUID;
  outcome: MatchOutcome;
  modelProbability: number;
  marketImpliedProbability: number;
  edge: number;
};

export type LearningSignal = {
  userId?: UUID;
  matchId: UUID;
  predictedOutcome: MatchOutcome;
  actualOutcome: MatchOutcome;
  correct: boolean;
  confidenceAtPrediction: number;
  modelVersion: string;
};

export type ModelEvaluationSnapshot = {
  modelVersion: string;
  sampleSize: number;
  accuracy: number;
  logLoss: number | null;
  calibrationError: number | null;
  evaluatedAt: string;
};

export type LiveMatchEvent = {
  matchId: UUID;
  occurredAt: string;
  type: string;
  payload: Record<string, unknown>;
};

export type LivePredictionUpdate = {
  matchId: UUID;
  probabilities: OutcomeProbability;
  confidence: ConfidenceScore;
  reason: string;
  updatedAt: string;
};

export type PredictionPipelineInput = {
  matchId: UUID;
  /** Optional preloaded context to avoid extra I/O in batch jobs. */
  context?: MatchContext;
  options?: {
    includeExplanation?: boolean;
    includeMarketComparison?: boolean;
    persist?: boolean;
  };
};

export type PredictionPipelineResult = {
  prediction: SystemPrediction;
  features: FeatureVector;
  explanation?: PredictionExplanation;
  valueSignals?: ValueSignal[];
};
