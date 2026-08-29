/**
 * APEX Match Rating — 0–100 fixture score and decision card.
 * Numbers come from published match data + Probability Engine. Missing
 * signals are marked unavailable and excluded from the weighted average.
 */

import type { ConfidenceScore, MatchOutcome } from "@/lib/intelligence/types";

export type ApexRatingMetricKey =
  | "form"
  | "attack"
  | "defense"
  | "injuries"
  | "standings"
  | "odds"
  | "impliedProbability"
  | "value"
  | "homeAdvantage"
  | "momentum";

export type ApexRatingMetric = {
  key: ApexRatingMetricKey;
  label: string;
  /** 0–100 when the signal exists; null if the catalogue does not publish it. */
  score: number | null;
  weight: number;
  available: boolean;
  note: string;
};

export type ApexRatingAction = "bet" | "watch" | "skip";

export type ApexRatingRisk = "low" | "medium" | "high";

export type ApexMatchRating = {
  overall: number;
  label: string;
  confidence: ConfidenceScore;
  confidencePct: number;
  risk: ApexRatingRisk;
  /** 0–10 market value. Null when there is no published price. */
  valueRating: number | null;
  /** Quarter-Kelly fraction of bankroll (0–1), or null without odds. */
  kellyFraction: number | null;
  /** Stake actually recommended after Skip / Watch caps. */
  recommendedKelly: number | null;
  kellyLabel: string;
  fairOdds: number | null;
  expectedValue: number | null;
  recommendation: ApexRatingAction;
  recommendationLabel: string;
  selectionLabel: string;
  predictedOutcome: MatchOutcome;
  metrics: ApexRatingMetric[];
  /** Share of total weight that had a published signal (0–1). */
  coverage: number;
};

export type ApexRatingFormSide = {
  form: string | null;
  recent: Array<{ result: "W" | "D" | "L" | null }>;
  goalsFor: number | null;
  goalsAgainst: number | null;
  played: number | null;
};

export type ApexRatingStanding = {
  rank: number;
  points: number;
  played: number | null;
};

export type ApexRatingInjury = {
  teamSide: "home" | "away" | "unknown";
};

export type ApexRatingInput = {
  predictedOutcome: MatchOutcome;
  predictedLabel: string;
  oneXTwo: { home: number; draw: number; away: number };
  expectedGoals: { home: number; away: number; total: number };
  confidence: ConfidenceScore;
  riskLevel?: ApexRatingRisk;
  recommendationAction?: "bet" | "pass" | "watch" | "reduce_stake" | "other";
  decimalOdds: number | null;
  bookmakerCount: number;
  home: ApexRatingFormSide;
  away: ApexRatingFormSide;
  standings: {
    home: ApexRatingStanding | null;
    away: ApexRatingStanding | null;
  };
  injuries: ApexRatingInjury[];
  eloWinExpectancyHome?: number | null;
  /** Live momentum −100…+100 when APEX Vision publishes it. */
  visionMomentum?: number | null;
  headline?: string;
};
