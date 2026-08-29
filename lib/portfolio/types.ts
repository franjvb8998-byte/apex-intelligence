/**
 * Portfolio Intelligence — view-model over existing bankroll bets.
 * Does not persist new fields and does not call the Decision Engine.
 */

import type { BankrollBet } from "@/lib/bankroll/types";

export type PortfolioHealthBand =
  | "Excellent"
  | "Good"
  | "Average"
  | "Risky"
  | "Critical";

export type PortfolioInsightTone = "danger" | "warning" | "info" | "success";

export type PortfolioRecommendationKind =
  | "reduce_exposure"
  | "increase_value"
  | "improve_diversification"
  | "lower_variance";

export type ExposureSlice = {
  key: string;
  label: string;
  stake: number;
  share: number;
};

export type ClassifiedBet = {
  bet: BankrollBet;
  home: string;
  away: string;
  league: string;
  competition: string;
};

export type PortfolioKpis = {
  currentBankroll: number;
  activeExposure: number;
  exposureRatio: number | null;
  expectedValue: number | null;
  expectedValueMoney: number | null;
  expectedRoi: number | null;
  expectedYield: number | null;
  kellyAllocation: number | null;
  kellyRecommended: number | null;
  diversificationScore: number;
  riskScore: number;
};

export type PortfolioHealth = {
  score: number;
  band: PortfolioHealthBand;
};

export type PortfolioInsight = {
  id: string;
  tone: PortfolioInsightTone;
  text: string;
};

export type PortfolioRecommendation = {
  id: string;
  kind: PortfolioRecommendationKind;
  title: string;
  detail: string;
};

export type PortfolioReport = {
  kpis: PortfolioKpis;
  health: PortfolioHealth;
  byLeague: ExposureSlice[];
  byMarket: ExposureSlice[];
  byTeam: ExposureSlice[];
  byCompetition: ExposureSlice[];
  insights: PortfolioInsight[];
  recommendations: PortfolioRecommendation[];
  classified: ClassifiedBet[];
  pendingCount: number;
  allocatedStake: number;
};
