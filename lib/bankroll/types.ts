/**
 * My Bankroll — view-model types.
 */

import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";

export type BetResult = "won" | "lost" | "void" | "pending";

export type BankrollBetDraft = {
  id: string;
  placedAt: string;
  match: string;
  market: string;
  odds: number;
  stake: number;
  result: BetResult;
};

export type BankrollBet = BankrollBetDraft & {
  profit: number | null;
};

export type BankrollSnapshot = {
  date: string;
  balance: number;
};

export type MonthlyProfit = {
  month: string;
  label: string;
  profit: number;
};

export type BankrollMetrics = {
  currentBankroll: number;
  initialBankroll: number;
  todayProfit: number;
  totalProfit: number;
  /** Net settled profit / total stake risked. Same formula as yield. */
  roi: number | null;
  /** Net settled profit / total stake risked. Same formula as ROI. */
  yield: number | null;
  winRate: number | null;
  averageOdds: number | null;
  betCount: number;
  /** Won + lost stakes only (void and pending excluded). */
  stakeRisked: number;
};

export type BankrollData = {
  currency: BankrollCurrency;
  source: "mock";
  initialBankroll: number;
  bets: BankrollBet[];
  metrics: BankrollMetrics;
  evolution: BankrollSnapshot[];
  monthlyProfit: MonthlyProfit[];
};

export type SuggestedOdds = Partial<Record<string, number>>;

export type BankrollFixture = DashboardMatchSummary & {
  leagueLogoUrl: string | null;
  suggestedOdds: SuggestedOdds;
};

export type BetPreview = {
  stake: number | null;
  odds: number | null;
  potentialReturn: number | null;
  potentialProfit: number | null;
};
