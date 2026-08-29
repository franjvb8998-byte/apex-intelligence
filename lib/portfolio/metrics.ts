/**
 * Portfolio KPIs from the existing bankroll ledger.
 * Forward EV / Kelly use this book's settled hit rate (Laplace), not the Decision Engine.
 */

import { roundMoney } from "@/lib/bankroll/calculate";
import type { BankrollBet, BetResult } from "@/lib/bankroll/types";
import { expectedValue, quarterKelly } from "@/lib/match-rating/pricing";
import { classifyBets, teamWeights } from "@/lib/portfolio/classify";
import type {
  ClassifiedBet,
  ExposureSlice,
  PortfolioHealth,
  PortfolioHealthBand,
  PortfolioKpis,
} from "@/lib/portfolio/types";
import type { BankrollFixture } from "@/lib/bankroll/types";

export function isAllocated(result: BetResult): boolean {
  return result === "won" || result === "lost" || result === "pending";
}

export function isSettled(result: BetResult): boolean {
  return result === "won" || result === "lost";
}

function sumStake(bets: BankrollBet[]): number {
  return roundMoney(bets.reduce((sum, bet) => sum + bet.stake, 0));
}

function laplaceRate(wins: number, settled: number): number | null {
  if (settled <= 0) return null;
  return (wins + 1) / (settled + 2);
}

export function hitRateByMarket(bets: BankrollBet[]): Map<string, number> {
  const rates = new Map<string, number>();
  const overallSettled = bets.filter((bet) => isSettled(bet.result));
  const overall =
    laplaceRate(
      overallSettled.filter((bet) => bet.result === "won").length,
      overallSettled.length,
    ) ?? 0.5;

  const markets = [...new Set(bets.map((bet) => bet.market))];
  for (const market of markets) {
    const settled = bets.filter(
      (bet) => bet.market === market && isSettled(bet.result),
    );
    rates.set(
      market,
      laplaceRate(
        settled.filter((bet) => bet.result === "won").length,
        settled.length,
      ) ?? overall,
    );
  }
  return rates;
}

export function herfindahl(shares: number[]): number {
  if (shares.length === 0) return 1;
  return shares.reduce((sum, share) => sum + share * share, 0);
}

export function diversificationFromShares(shares: number[]): number {
  const positive = shares.filter((share) => share > 0);
  if (positive.length === 0) return 0;
  if (positive.length === 1) return 0;
  const hhi = herfindahl(positive);
  const min = 1 / positive.length;
  const span = 1 - min;
  if (span <= 0) return 100;
  return Math.round((1 - (hhi - min) / span) * 100);
}

export function toSlices(
  totals: Map<string, number>,
  allocated: number,
): ExposureSlice[] {
  if (allocated <= 0) return [];
  return [...totals.entries()]
    .map(([label, stake]) => ({
      key: label,
      label,
      stake: roundMoney(stake),
      share: stake / allocated,
    }))
    .filter((slice) => slice.stake > 0)
    .sort((a, b) => b.stake - a.stake || a.label.localeCompare(b.label, "en"));
}

export function exposureBuckets(classified: ClassifiedBet[]): {
  byLeague: ExposureSlice[];
  byMarket: ExposureSlice[];
  byTeam: ExposureSlice[];
  byCompetition: ExposureSlice[];
  allocatedStake: number;
} {
  const rows = classified.filter((row) => isAllocated(row.bet.result));
  const allocatedStake = sumStake(rows.map((row) => row.bet));
  const leagues = new Map<string, number>();
  const markets = new Map<string, number>();
  const teams = new Map<string, number>();
  const competitions = new Map<string, number>();

  for (const row of rows) {
    const stake = row.bet.stake;
    leagues.set(row.league, (leagues.get(row.league) ?? 0) + stake);
    markets.set(row.bet.market, (markets.get(row.bet.market) ?? 0) + stake);
    competitions.set(
      row.competition,
      (competitions.get(row.competition) ?? 0) + stake,
    );
    for (const part of teamWeights(row)) {
      teams.set(part.team, (teams.get(part.team) ?? 0) + stake * part.weight);
    }
  }

  return {
    byLeague: toSlices(leagues, allocatedStake),
    byMarket: toSlices(markets, allocatedStake),
    byTeam: toSlices(teams, allocatedStake),
    byCompetition: toSlices(competitions, allocatedStake),
    allocatedStake,
  };
}

export function healthBand(score: number): PortfolioHealthBand {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Average";
  if (score >= 35) return "Risky";
  return "Critical";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

export function buildKpis(
  classified: ClassifiedBet[],
  currentBankroll: number,
  realizedYield: number | null,
): { kpis: PortfolioKpis; health: PortfolioHealth } {
  const pending = classified.filter((row) => row.bet.result === "pending");
  const activeExposure = sumStake(pending.map((row) => row.bet));
  const buckets = exposureBuckets(classified);
  const rates = hitRateByMarket(classified.map((row) => row.bet));

  let expectedValueMoney: number | null = null;
  let kellyRecommendedMoney = 0;
  let pricedStake = 0;

  for (const row of pending) {
    const p = rates.get(row.bet.market);
    if (p == null) continue;
    const ev = expectedValue(p, row.bet.odds);
    const kelly = quarterKelly(p, row.bet.odds);
    if (ev != null) {
      expectedValueMoney = roundMoney((expectedValueMoney ?? 0) + row.bet.stake * ev);
      pricedStake += row.bet.stake;
    }
    if (kelly != null && currentBankroll > 0) {
      kellyRecommendedMoney += kelly * currentBankroll;
    }
  }

  kellyRecommendedMoney = roundMoney(kellyRecommendedMoney);
  const forwardEv =
    pricedStake > 0 && expectedValueMoney != null
      ? expectedValueMoney / pricedStake
      : pending.length === 0
        ? 0
        : null;
  const expectedYield =
    activeExposure > 0 && expectedValueMoney != null
      ? expectedValueMoney / activeExposure
      : pending.length === 0
        ? 0
        : null;
  const expectedRoi =
    currentBankroll > 0 && expectedValueMoney != null
      ? expectedValueMoney / currentBankroll
      : pending.length === 0
        ? 0
        : null;
  const exposureRatio =
    currentBankroll > 0 ? activeExposure / currentBankroll : null;
  const kellyAllocation =
    currentBankroll > 0 ? activeExposure / currentBankroll : null;

  const diversificationScore = Math.round(
    (diversificationFromShares(buckets.byLeague.map((s) => s.share)) +
      diversificationFromShares(buckets.byMarket.map((s) => s.share)) +
      diversificationFromShares(buckets.byTeam.map((s) => s.share))) /
      3,
  );

  const topLeagueShare = buckets.byLeague[0]?.share ?? 1;
  const allocated = classified.filter((row) => isAllocated(row.bet.result));
  const oddsSample = allocated.filter((row) => row.bet.odds > 1);
  const avgOdds =
    oddsSample.length > 0
      ? oddsSample.reduce((sum, row) => sum + row.bet.odds, 0) / oddsSample.length
      : 2;
  const oddsRisk = Math.min(100, Math.max(0, ((avgOdds - 1.5) / 2.5) * 100));
  const exposureRisk = Math.min(100, (exposureRatio ?? 0) * 400);
  const concentrationRisk = Math.round(herfindahl(buckets.byLeague.map((s) => s.share)) * 100);
  const correlationRisk = Math.round(topLeagueShare * 100);
  const riskScore = clampScore(
    exposureRisk * 0.3 +
      concentrationRisk * 0.3 +
      oddsRisk * 0.2 +
      correlationRisk * 0.2,
  );

  let healthRaw = 55 + diversificationScore * 0.28 - riskScore * 0.35;
  if ((forwardEv ?? 0) > 0) healthRaw += 8;
  if ((forwardEv ?? 0) < 0) healthRaw -= 12;
  if ((realizedYield ?? 0) > 0) healthRaw += 8;
  if ((realizedYield ?? 0) < 0) healthRaw -= 8;
  if ((exposureRatio ?? 0) > 0.12) healthRaw -= 10;
  const health: PortfolioHealth = {
    score: clampScore(healthRaw),
    band: healthBand(clampScore(healthRaw)),
  };

  return {
    kpis: {
      currentBankroll: roundMoney(currentBankroll),
      activeExposure,
      exposureRatio,
      expectedValue: forwardEv,
      expectedValueMoney,
      expectedRoi,
      expectedYield,
      kellyAllocation,
      kellyRecommended:
        currentBankroll > 0 ? kellyRecommendedMoney / currentBankroll : null,
      diversificationScore: clampScore(diversificationScore),
      riskScore,
    },
    health,
  };
}

export function classifyLedger(
  bets: BankrollBet[],
  fixtures: BankrollFixture[] = [],
): ClassifiedBet[] {
  return classifyBets(bets, fixtures);
}
