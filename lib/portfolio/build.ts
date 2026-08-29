/**
 * Assemble the Portfolio Intelligence report from bankroll history.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { roundMoney } from "@/lib/bankroll/calculate";
import type { BankrollData, BankrollFixture } from "@/lib/bankroll/types";
import { classifyBets } from "@/lib/portfolio/classify";
import { buildInsights, buildRecommendations } from "@/lib/portfolio/insights";
import {
  buildKpis,
  exposureBuckets,
  isSettled,
  toSlices,
} from "@/lib/portfolio/metrics";
import type { ExposureSlice, PortfolioReport } from "@/lib/portfolio/types";

function profitByMarket(data: BankrollData): ExposureSlice[] {
  const totals = new Map<string, number>();
  for (const bet of data.bets) {
    if (!isSettled(bet.result) || bet.profit == null) continue;
    totals.set(bet.market, roundMoney((totals.get(bet.market) ?? 0) + bet.profit));
  }
  const peak = Math.max(
    ...[...totals.values()].map((n) => Math.abs(n)),
    0,
  );
  if (peak <= 0) return [];
  return toSlices(
    new Map(
      [...totals.entries()].filter(([, profit]) => profit > 0),
    ),
    [...totals.values()].filter((n) => n > 0).reduce((a, b) => a + b, 0) || 1,
  );
}

export function buildPortfolioReport(
  data: BankrollData,
  fixtures: BankrollFixture[] = [],
  analyzed: ApexOpportunity[] = [],
): PortfolioReport {
  const classified = classifyBets(data.bets, fixtures);
  const buckets = exposureBuckets(classified);
  const { kpis, health } = buildKpis(
    classified,
    data.metrics.currentBankroll,
    data.metrics.yield,
  );
  const valueMarkets = profitByMarket(data);
  const insights = buildInsights({
    kpis,
    byLeague: buckets.byLeague,
    byMarket: buckets.byMarket,
    classified,
    profitByMarket: valueMarkets,
  });
  const recommendations = buildRecommendations({
    kpis,
    byLeague: buckets.byLeague,
    byMarket: buckets.byMarket,
  });
  const pendingAvoid = classified.filter((row) => {
    if (row.bet.result !== "pending") return false;
    const hit = analyzed.find(
      (opp) =>
        opp.home.name === row.home &&
        opp.away.name === row.away,
    );
    return hit?.recommendation === "Avoid";
  }).length;
  if (pendingAvoid > 0) {
    insights.push({
      id: "scoring-avoid",
      tone: "warning",
      text: `${pendingAvoid} open position${pendingAvoid === 1 ? "" : "s"} sit on a Scoring Engine Avoid.`,
    });
  }

  return {
    kpis,
    health,
    byLeague: buckets.byLeague,
    byMarket: buckets.byMarket,
    byTeam: buckets.byTeam,
    byCompetition: buckets.byCompetition,
    insights,
    recommendations,
    classified,
    pendingCount: classified.filter((row) => row.bet.result === "pending").length,
    allocatedStake: buckets.allocatedStake,
  };
}
