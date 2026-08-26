/**
 * APEX Reasoning Layer — contracts / domain types.
 * Pure types only. No OpenAI. No Probability / Learning Engine imports required.
 */

/** Opaque ids used across the reasoning layer. */
export type ReasoningId = string;

export type ReasoningMarketKey = "1x2" | "over_under" | "btts" | "other";

export type ReasoningSide = "home" | "draw" | "away" | "over" | "under" | "yes" | "no";

/**
 * Input to the reasoning pipeline.
 * Consumes already-normalized signals (never raw vendor JSON).
 */
export type ReasoningInput = {
  matchId: ReasoningId;
  leagueId?: ReasoningId;
  homeTeamId: ReasoningId;
  awayTeamId: ReasoningId;
  /** Kickoff ISO timestamp when known. */
  kickoffAt?: string;
  /** Pre-computed 1X2 probabilities from Probability Engine (optional until wired). */
  oneXTwo?: {
    home: number;
    draw: number;
    away: number;
  };
  /** Optional market snapshots for value detection. */
  markets?: Array<{
    key: ReasoningMarketKey;
    line?: number | null;
    selections: Array<{
      side: ReasoningSide;
      probability?: number;
      decimalOdds?: number | null;
    }>;
  }>;
  /** Free-form context bag for future feature adapters. */
  context?: Record<string, unknown>;
  locale?: string;
};

/**
 * Calibrated confidence for a reasoning conclusion.
 * Local to the Reasoning Layer (distinct from Core domain exports).
 */
export type ConfidenceScore = {
  /** Calibrated score in [0, 1]. */
  value: number;
  band: "low" | "medium" | "high";
  /** Optional rationale keys for explainability. */
  drivers?: string[];
};

/** Human-readable explanation of a reasoning step or output. */
export type Explanation = {
  summary: string;
  narrative?: string;
  factors: Array<{
    key: string;
    label: string;
    direction: "supports" | "against" | "neutral";
    weight?: number;
    detail?: string;
  }>;
  caveats?: string[];
};

/** Actionable recommendation derived from reasoning. */
export type Recommendation = {
  id: ReasoningId;
  title: string;
  action: "bet" | "pass" | "watch" | "reduce_stake" | "other";
  market?: ReasoningMarketKey;
  selection?: ReasoningSide;
  priority: "low" | "medium" | "high";
  rationale: string;
  confidence: ConfidenceScore;
};

/** Structured risk view for a match / recommendation set. */
export type RiskAnalysis = {
  overall: "low" | "medium" | "high";
  score: number;
  items: Array<{
    id: ReasoningId;
    severity: "low" | "medium" | "high";
    title: string;
    detail: string;
  }>;
};

/** Edge / value opportunity vs market pricing. */
export type ValueOpportunity = {
  id: ReasoningId;
  market: ReasoningMarketKey;
  selection: ReasoningSide;
  modelProbability: number;
  impliedProbability: number | null;
  decimalOdds: number | null;
  edge: number;
  kellyFraction?: number | null;
  explanation?: string;
};

/** Full prediction + reasoning report for a match. */
export type PredictionReport = {
  id: ReasoningId;
  matchId: ReasoningId;
  generatedAt: string;
  headline: string;
  recommendations: Recommendation[];
  risks: RiskAnalysis;
  confidence: ConfidenceScore;
  explanation: Explanation;
  valueOpportunities: ValueOpportunity[];
  modelVersions?: {
    probability?: string;
    reasoning?: string;
  };
};

/**
 * Output of the reasoning pipeline for one match.
 */
export type ReasoningOutput = {
  matchId: ReasoningId;
  generatedAt: string;
  confidence: ConfidenceScore;
  explanation: Explanation;
  recommendations: Recommendation[];
  risks: RiskAnalysis;
  valueOpportunities: ValueOpportunity[];
  report?: PredictionReport;
};
