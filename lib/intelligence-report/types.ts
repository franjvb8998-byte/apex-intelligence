/**
 * APEX Intelligence Report v2 — deterministic betting analyst output.
 * Never invents weather, derbies, rotation, or upcoming cups.
 */

import type { MatchOutcome } from "@/lib/intelligence/types";
import type { ApexRatingMetric } from "@/lib/match-rating/types";

export type ApexVerdictKind = "strong_bet" | "lean_bet" | "avoid";

export type ApexStakeKind = "pass" | "small" | "medium" | "strong";

export type ApexReasonId =
  | "attacking_efficiency"
  | "defensive_record"
  | "xg_differential"
  | "recent_form"
  | "home_advantage"
  | "opponent_absences"
  | "better_rest"
  | "better_h2h";

export type ApexRiskId =
  | "high_variance"
  | "weather"
  | "injuries"
  | "poor_away_form"
  | "schedule_congestion";

export type ApexReportReason = {
  id: ApexReasonId;
  title: string;
  detail: string;
};

export type ApexReportRisk = {
  id: ApexRiskId;
  title: string;
  detail: string;
  /** Points subtracted from PE confidence (0–100 scale). */
  penalty: number;
};

export type ApexMarketFlags = {
  positiveEv: boolean;
  negativeEv: boolean;
  overpriced: boolean;
  underpriced: boolean;
};

export type ApexReportMarket = {
  bookmakerOdds: number | null;
  bookmaker: string | null;
  fairOdds: number | null;
  modelProbability: number;
  expectedValue: number | null;
  kellyPct: number | null;
  impliedProbability: number | null;
  marketEdge: number | null;
  flags: ApexMarketFlags;
};

export type ApexReportBreakdownKey =
  | "attack"
  | "defense"
  | "momentum"
  | "form"
  | "value"
  | "market"
  | "risk"
  | "discipline"
  | "fitness";

export type ApexReportBreakdownBar = {
  key: ApexReportBreakdownKey;
  label: string;
  score: number | null;
  available: boolean;
  note: string;
};

export type ApexIntelligenceReport = {
  verdict: {
    kind: ApexVerdictKind;
    label: string;
    stars: number;
    selectionLabel: string;
    predictedOutcome: MatchOutcome;
  };
  confidence: {
    value: number;
    base: number;
    band: "low" | "medium" | "high";
    caption: string;
  };
  reasons: ApexReportReason[];
  risks: ApexReportRisk[];
  market: ApexReportMarket;
  recommendation: {
    kind: ApexStakeKind;
    label: string;
    exposurePct: number;
    exposureLabel: string;
  };
  narrative: string;
  breakdown: ApexReportBreakdownBar[];
  metricsUsed: ApexRatingMetric[];
};
