/**
 * APEX Decision Engine v1 — stable contracts.
 * UI and future ML models consume ApexDecision. They must not invent fields.
 */

import type { MatchOutcome } from "@/lib/intelligence/types";

export type ApexRiskBand = "low" | "medium" | "high";
export type ApexConfidenceBand = "low" | "medium" | "high";

export type ApexDecisionVerdictKind =
  | "elite_pick"
  | "strong_bet"
  | "lean_bet"
  | "pass"
  | "avoid";

export type ApexScoreComponentKey =
  | "attack"
  | "defense"
  | "form"
  | "xg"
  | "homeAdvantage"
  | "rest"
  | "injuries"
  | "motivation"
  | "market"
  | "value"
  | "riskAdjustment";

export type ApexScoreComponent = {
  key: ApexScoreComponentKey;
  label: string;
  /** Signed weight as specified (injuries and risk are negative). */
  weight: number;
  /** 0–100 when published; null if the catalogue is silent. */
  score: number | null;
  available: boolean;
  note: string;
};

export type ApexDecisionSide = {
  name: string;
  formLetters: Array<"W" | "D" | "L">;
  formQuality: number | null;
  restDays: number | null;
  matchesLast7: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
  played: number | null;
  awayWinPct: number | null;
  injuryCount: number;
  consecutiveAway: number;
  rank: number | null;
};

export type ApexDecisionInput = {
  matchId: string;
  kickoffAt: string;
  predicted: MatchOutcome;
  predictedLabel: string;
  homeName: string;
  awayName: string;
  oneXTwo: { home: number; draw: number; away: number };
  expectedGoals: { home: number; away: number; total: number };
  decimalOdds: number | null;
  bookmaker: string | null;
  bookmakerCount: number;
  home: ApexDecisionSide;
  away: ApexDecisionSide;
  h2h: {
    pickWins: number;
    otherWins: number;
    draws: number;
    meetings: number;
  } | null;
  weather: string | null;
};

export type ApexDecisionReason = {
  id: string;
  title: string;
  detail: string;
};

export type ApexValueBlock = {
  modelProbability: number;
  marketProbability: number | null;
  valuePct: number | null;
  expectedValue: number | null;
  fairOdds: number | null;
  impliedOdds: number | null;
  marketEdge: number | null;
  positiveEdge: boolean;
  negativeEdge: boolean;
};

export type ApexRiskBlock = {
  score: number;
  band: ApexRiskBand;
  reasons: ApexDecisionReason[];
};

export type ApexConfidenceBlock = {
  value: number;
  band: ApexConfidenceBand;
  caption: string;
};

export type ApexSizingBlock = {
  kellyFraction: number | null;
  kellyPct: number | null;
  stakePct: number;
  stakeLabel: string;
};

export type ApexDecision = {
  engineId: "deterministic-v1";
  predicted: MatchOutcome;
  selectionLabel: string;
  score: {
    value: number;
    label: string;
    coverage: number;
    components: ApexScoreComponent[];
  };
  confidence: ApexConfidenceBlock;
  risk: ApexRiskBlock;
  value: ApexValueBlock;
  sizing: ApexSizingBlock;
  verdict: {
    kind: ApexDecisionVerdictKind;
    label: string;
    stars: number;
  };
  reasonsFor: ApexDecisionReason[];
  reasonsAgainst: ApexDecisionReason[];
  explanation: string;
};

export type DecisionEnginePort = {
  readonly id: "deterministic-v1";
  evaluate(input: ApexDecisionInput): ApexDecision;
};
