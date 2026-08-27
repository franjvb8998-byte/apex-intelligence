/**
 * Bankroll P/L, ROI and yield — settled bets only.
 *
 * ROI and Yield use the same industry ratio:
 *   net settled profit / total stake risked
 * Stake risked = won + lost stakes (void returned, pending excluded).
 */

import { DEFAULT_CURRENCY, type BankrollCurrency } from "@/lib/bankroll/currency";
import type {
  BankrollBet,
  BankrollBetDraft,
  BankrollData,
  BankrollMetrics,
  BankrollSnapshot,
  BetPreview,
  BetResult,
  MonthlyProfit,
} from "@/lib/bankroll/types";

const MONTH_LABEL = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function profitForBet(
  odds: number,
  stake: number,
  result: BetResult,
): number | null {
  if (!Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake < 0) {
    return result === "pending" ? null : 0;
  }
  if (result === "pending") return null;
  if (result === "void") return 0;
  if (result === "won") return roundMoney(stake * (odds - 1));
  return roundMoney(-stake);
}

/** Payout if the bet wins: stake × odds. */
export function potentialReturn(odds: number, stake: number): number | null {
  if (!Number.isFinite(odds) || odds <= 1 || !Number.isFinite(stake) || stake <= 0) {
    return null;
  }
  return roundMoney(stake * odds);
}

/** Potential return − stake. */
export function potentialProfit(odds: number, stake: number): number | null {
  const payout = potentialReturn(odds, stake);
  if (payout == null) return null;
  return roundMoney(payout - stake);
}

export function betPreview(odds: number, stake: number): BetPreview {
  const payout = potentialReturn(odds, stake);
  const profit = potentialProfit(odds, stake);
  return {
    odds: Number.isFinite(odds) && odds > 1 ? odds : null,
    stake: Number.isFinite(stake) && stake > 0 ? stake : null,
    potentialReturn: payout,
    potentialProfit: profit,
  };
}

function utcDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms).toISOString().slice(0, 10);
}

function monthKey(iso: string): string {
  return utcDate(iso).slice(0, 7);
}

function isSettled(result: BetResult): boolean {
  return result === "won" || result === "lost";
}

export function attachProfits(bets: BankrollBetDraft[]): BankrollBet[] {
  return bets.map((bet) => ({
    ...bet,
    profit: profitForBet(bet.odds, bet.stake, bet.result),
  }));
}

export function computeMetrics(
  initialBankroll: number,
  bets: BankrollBet[],
  now: Date = new Date(),
): BankrollMetrics {
  const settled = bets.filter((bet) => isSettled(bet.result));
  const totalProfit = roundMoney(
    settled.reduce((sum, bet) => sum + (bet.profit ?? 0), 0),
  );
  const stakeRisked = roundMoney(
    settled.reduce((sum, bet) => sum + bet.stake, 0),
  );
  const wins = settled.filter((bet) => bet.result === "won");
  const today = now.toISOString().slice(0, 10);
  const todayProfit = roundMoney(
    settled
      .filter((bet) => utcDate(bet.placedAt) === today)
      .reduce((sum, bet) => sum + (bet.profit ?? 0), 0),
  );
  const oddsSample = settled.filter(
    (bet) => Number.isFinite(bet.odds) && bet.odds > 1,
  );
  const averageOdds =
    oddsSample.length > 0
      ? roundMoney(
          oddsSample.reduce((sum, bet) => sum + bet.odds, 0) / oddsSample.length,
        )
      : null;
  const performance = stakeRisked > 0 ? totalProfit / stakeRisked : null;

  return {
    currentBankroll: roundMoney(initialBankroll + totalProfit),
    initialBankroll,
    todayProfit,
    totalProfit,
    roi: performance,
    yield: performance,
    winRate: settled.length > 0 ? wins.length / settled.length : null,
    averageOdds,
    betCount: bets.length,
    stakeRisked,
  };
}

export function evolutionSeries(
  initialBankroll: number,
  bets: BankrollBet[],
): BankrollSnapshot[] {
  const ordered = [...bets].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  const firstDate = ordered[0] ? utcDate(ordered[0].placedAt) : null;
  const points: BankrollSnapshot[] = [
    {
      date: firstDate ?? new Date().toISOString().slice(0, 10),
      balance: roundMoney(initialBankroll),
    },
  ];
  let balance = initialBankroll;
  for (const bet of ordered) {
    if (bet.profit == null) continue;
    balance = roundMoney(balance + bet.profit);
    points.push({ date: utcDate(bet.placedAt), balance });
  }
  return points;
}

export function monthlyProfitSeries(bets: BankrollBet[]): MonthlyProfit[] {
  const buckets = new Map<string, number>();
  for (const bet of bets) {
    if (bet.profit == null) continue;
    const key = monthKey(bet.placedAt);
    buckets.set(key, roundMoney((buckets.get(key) ?? 0) + bet.profit));
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, profit]) => ({
      month,
      label: MONTH_LABEL.format(new Date(`${month}-01T00:00:00.000Z`)),
      profit,
    }));
}

export function buildBankrollData(
  initialBankroll: number,
  drafts: BankrollBetDraft[],
  now: Date = new Date(),
  currency: BankrollCurrency = DEFAULT_CURRENCY,
): BankrollData {
  const bets = attachProfits(drafts).sort((a, b) =>
    b.placedAt.localeCompare(a.placedAt),
  );
  return {
    currency,
    source: "mock",
    initialBankroll,
    bets,
    metrics: computeMetrics(initialBankroll, bets, now),
    evolution: evolutionSeries(initialBankroll, bets),
    monthlyProfit: monthlyProfitSeries(bets),
  };
}

export function createBetId(now: Date = new Date()): string {
  return `bet-${now.getTime().toString(36)}`;
}
