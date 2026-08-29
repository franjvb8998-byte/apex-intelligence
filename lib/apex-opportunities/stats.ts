/**
 * Header, summary cards, and market-scan KPIs.
 */

import { filterOpportunities } from "@/lib/apex-opportunities/filters";
import type {
  ApexOpportunity,
  OpportunityFilters,
  OpportunityHeaderStats,
  OpportunityMarketSummary,
  OpportunitySummaryStats,
} from "@/lib/apex-opportunities/types";
import { DEFAULT_OPPORTUNITY_FILTERS } from "@/lib/apex-opportunities/types";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((n): n is number => n != null && Number.isFinite(n));
}

export function headerStats(
  analyzed: ApexOpportunity[],
  filtered: ApexOpportunity[],
): OpportunityHeaderStats {
  return {
    analyzed: analyzed.length,
    opportunities: filtered.length,
    elitePicks: filtered.filter((row) => row.verdict === "elite_pick").length,
    averageConfidence: mean(filtered.map((row) => row.confidence)),
    averageEv: mean(finite(filtered.map((row) => row.expectedValue))),
  };
}

export function summaryStats(
  analyzed: ApexOpportunity[],
  filtered: ApexOpportunity[],
): OpportunitySummaryStats {
  return {
    analyzed: analyzed.length,
    elitePicks: filtered.filter((row) => row.verdict === "elite_pick").length,
    averageEdge: mean(finite(filtered.map((row) => row.valuePct ?? row.marketEdge))),
    averageKelly: mean(finite(filtered.map((row) => row.kellyPct))),
    averageConfidence: mean(filtered.map((row) => row.confidence)),
  };
}

export function marketSummary(
  analyzed: ApexOpportunity[],
): OpportunityMarketSummary {
  const highestEv =
    [...analyzed]
      .filter((row) => row.expectedValue != null)
      .sort((a, b) => (b.expectedValue ?? 0) - (a.expectedValue ?? 0))[0] ?? null;

  const highestScore =
    [...analyzed].sort((a, b) => b.score - a.score)[0] ?? null;

  const safest =
    [...analyzed].sort((a, b) => {
      if (a.riskScore !== b.riskScore) return a.riskScore - b.riskScore;
      return b.confidence - a.confidence;
    })[0] ?? null;

  const mostAggressive =
    [...analyzed].sort((a, b) => {
      if (b.stakePct !== a.stakePct) return b.stakePct - a.stakePct;
      const kA = a.kellyPct ?? -1;
      const kB = b.kellyPct ?? -1;
      return kB - kA;
    })[0] ?? null;

  return {
    averageInefficiency: mean(
      finite(analyzed.map((row) => row.valuePct)).map((n) => Math.abs(n)),
    ),
    averageConfidence: mean(analyzed.map((row) => row.confidence)),
    highestEv,
    highestScore,
    safest,
    mostAggressive,
  };
}

export function topOpportunities(
  filtered: ApexOpportunity[],
  limit = 5,
): ApexOpportunity[] {
  return filtered.slice(0, limit);
}

export function boardView(
  analyzed: ApexOpportunity[],
  filters: OpportunityFilters = DEFAULT_OPPORTUNITY_FILTERS,
) {
  const filtered = filterOpportunities(analyzed, filters);
  return {
    filtered,
    top: topOpportunities(filtered),
    header: headerStats(analyzed, filtered),
    summary: summaryStats(analyzed, filtered),
    market: marketSummary(analyzed),
  };
}
