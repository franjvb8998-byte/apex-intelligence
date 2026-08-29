/**
 * Deterministic portfolio copy from computed slices. No LLM.
 */

import { formatPct } from "@/lib/bankroll/format";
import type {
  ExposureSlice,
  PortfolioInsight,
  PortfolioKpis,
  PortfolioRecommendation,
} from "@/lib/portfolio/types";
import type { ClassifiedBet } from "@/lib/portfolio/types";

function topSlice(slices: ExposureSlice[]): ExposureSlice | null {
  return slices[0] ?? null;
}

function riskPhrase(score: number): string {
  if (score >= 70) return "high";
  if (score >= 45) return "moderate";
  return "low";
}

function teamOverlap(classified: ClassifiedBet[]): string[] {
  const pending = classified.filter((row) => row.bet.result === "pending");
  const counts = new Map<string, number>();
  for (const row of pending) {
    counts.set(row.home, (counts.get(row.home) ?? 0) + 1);
    counts.set(row.away, (counts.get(row.away) ?? 0) + 1);
  }
  const allocated = classified.filter((row) => row.bet.result !== "void");
  const leagueTeams = new Map<string, Set<string>>();
  for (const row of allocated) {
    const set = leagueTeams.get(row.league) ?? new Set<string>();
    set.add(row.home);
    set.add(row.away);
    leagueTeams.set(row.league, set);
  }
  const correlated = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([team]) => team);
  return correlated;
}

export function buildInsights(input: {
  kpis: PortfolioKpis;
  byLeague: ExposureSlice[];
  byMarket: ExposureSlice[];
  classified: ClassifiedBet[];
  profitByMarket: ExposureSlice[];
}): PortfolioInsight[] {
  const insights: PortfolioInsight[] = [];
  const league = topSlice(input.byLeague);
  if (league && league.share >= 0.35 && league.label !== "Unclassified") {
    insights.push({
      id: "overexposed-league",
      tone: "warning",
      text: `You are overexposed to ${league.label}.`,
    });
  }

  const valueMarket = topSlice(input.profitByMarket);
  if (valueMarket && valueMarket.stake > 0) {
    insights.push({
      id: "value-market",
      tone: "info",
      text: `Most of your value comes from ${valueMarket.label}.`,
    });
  }

  insights.push({
    id: "risk-band",
    tone: input.kpis.riskScore >= 70 ? "danger" : "info",
    text: `Current portfolio risk is ${riskPhrase(input.kpis.riskScore)}.`,
  });

  const correlated = teamOverlap(input.classified);
  if (correlated.length > 0) {
    insights.push({
      id: "correlated",
      tone: "warning",
      text: "Reduce correlated positions.",
    });
  } else {
    const topLeagueShare = league?.share ?? 0;
    if (topLeagueShare >= 0.4) {
      insights.push({
        id: "correlated-league",
        tone: "warning",
        text: "Reduce correlated positions.",
      });
    }
  }

  const market = topSlice(input.byMarket);
  if (market && market.share >= 0.45) {
    insights.push({
      id: "market-concentration",
      tone: "warning",
      text: `Stake is concentrated in ${market.label} (${formatPct(market.share, 0)} of allocated exposure).`,
    });
  }

  return insights;
}

export function buildRecommendations(input: {
  kpis: PortfolioKpis;
  byLeague: ExposureSlice[];
  byMarket: ExposureSlice[];
}): PortfolioRecommendation[] {
  const items: PortfolioRecommendation[] = [];
  const exposureHigh = (input.kpis.exposureRatio ?? 0) >= 0.08;
  const concentrated = (input.byLeague[0]?.share ?? 0) >= 0.4;
  const evWeak = (input.kpis.expectedValue ?? 0) <= 0;
  const diversifiedLow = input.kpis.diversificationScore < 55;
  const marketHeavy = (input.byMarket[0]?.share ?? 0) >= 0.4;
  const riskHigh = input.kpis.riskScore >= 55;

  if (exposureHigh || concentrated || riskHigh) {
    items.push({
      id: "reduce_exposure",
      kind: "reduce_exposure",
      title: "Reduce exposure",
      detail: concentrated
        ? `Cut stake in ${input.byLeague[0]!.label} until no league holds more than a third of the book.`
        : "Trim open stakes so active exposure stays a small slice of bankroll.",
    });
  }

  if (evWeak || input.kpis.activeExposure === 0) {
    items.push({
      id: "increase_value",
      kind: "increase_value",
      title: "Increase value opportunities",
      detail:
        input.kpis.activeExposure === 0
          ? "There is no open position. Size only into Scoring Engine v2 Value Bet or better."
          : "Open positions do not project a positive book EV from this ledger's hit rate. Wait for a better price.",
    });
  }

  if (diversifiedLow || concentrated) {
    items.push({
      id: "improve_diversification",
      kind: "improve_diversification",
      title: "Improve diversification",
      detail:
        "Spread new stakes across leagues and markets instead of stacking the same competition.",
    });
  }

  if (marketHeavy || input.kpis.riskScore >= 50) {
    items.push({
      id: "lower_variance",
      kind: "lower_variance",
      title: "Lower variance",
      detail: marketHeavy
        ? `Avoid adding more ${input.byMarket[0]!.label} until that market is a smaller share of exposure.`
        : "Prefer shorter prices and uncorrelated matches to pull portfolio variance down.",
    });
  }

  return items;
}
