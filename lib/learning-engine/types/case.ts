/** Stable ids — UUID when persisted. */
export type LearningId = string;

export type MatchOutcome = "home" | "draw" | "away";

export type MarketKey = "1x2" | "over_under_25" | "btts";

export type MarketPrediction = {
  market: MarketKey;
  /** Selected outcome key, e.g. "home" | "over" | "yes". */
  selection: string;
  /** Model probability for that selection in [0, 1]. */
  probability: number;
  /** Optional decimal odds context (not required for learning). */
  decimalOdds?: number | null;
};

export type FeatureVariable = {
  key: string;
  value: number | string | boolean | null;
  source?: string;
};

export type ExplanatoryFactor = {
  key: string;
  label: string;
  direction: "supports" | "against" | "neutral";
  weight: number;
  detail?: string;
};

/**
 * Frozen prediction record at decision time (pre-match or live snapshot).
 */
export type PredictionRecord = {
  id: LearningId;
  matchId: LearningId;
  modelVersion: string;
  predictedAt: string;
  predictedOutcome: MatchOutcome;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  confidence: number;
  markets: MarketPrediction[];
  variables: FeatureVariable[];
  factors: ExplanatoryFactor[];
};

export type ActualMatchResult = {
  matchId: LearningId;
  finishedAt: string;
  outcome: MatchOutcome;
  homeScore: number;
  awayScore: number;
  /** Derived market truths for evaluation. */
  marketResults: Array<{
    market: MarketKey;
    winningSelection: string;
  }>;
};

export type MarketEvaluation = {
  market: MarketKey;
  selection: string;
  probability: number;
  winningSelection: string;
  hit: boolean;
};

/**
 * Full learning case after a match closes.
 */
export type LearningCase = {
  id: LearningId;
  prediction: PredictionRecord;
  actual: ActualMatchResult;
  /** 1X2 correctness. */
  outcomeCorrect: boolean;
  /** Absolute error on predicted outcome probability mass, etc. */
  error: {
    /** 0 if correct, 1 if wrong (0-1 outcome error). */
    outcomeError: number;
    /** Brier score for 1X2 triple. */
    brierScore: number;
    /** |predictedProb(outcome) - 1| style residual on winning class. */
    probabilityResidual: number;
  };
  marketsHit: MarketEvaluation[];
  marketsMissed: MarketEvaluation[];
  recordedAt: string;
};
