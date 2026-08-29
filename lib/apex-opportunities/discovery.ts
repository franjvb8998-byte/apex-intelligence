/**
 * Ranked discovery board — presentation over Decision Engine rows.
 * Does not re-score, re-size, or invent markets.
 */

import { kickoffWindow, leagueOptions } from "@/lib/apex-opportunities/filters";
import type {
  ApexOpportunity,
  OpportunityKickoffWindow,
  OpportunityMarket,
  OpportunityRiskFilter,
} from "@/lib/apex-opportunities/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export type DiscoveryPriorityLabel =
  | "Elite Opportunity"
  | "Strong"
  | "Good"
  | "Watch"
  | "Avoid";

export type DiscoveryPriority = {
  stars: 1 | 2 | 3 | 4 | 5;
  label: DiscoveryPriorityLabel;
  shortLabel: "Elite" | "Strong" | "Good" | "Watch" | "Avoid";
};

export type DiscoveryRecommendationLabel =
  | "STRONG BET"
  | "BET"
  | "LEAN BET"
  | "WATCH"
  | "SKIP";

export type DiscoverySort =
  | "score"
  | "ev"
  | "kelly"
  | "risk"
  | "kickoff";

export type DiscoveryRecommendationFilter = "all" | DiscoveryRecommendationLabel;

export type DiscoveryFilters = {
  league: string;
  market: OpportunityMarket | "all";
  minScore: number;
  risk: OpportunityRiskFilter;
  recommendation: DiscoveryRecommendationFilter;
  kickoff: OpportunityKickoffWindow;
  favoritesOnly: boolean;
};

export type DiscoveryDashboardStats = {
  today: number;
  elite: number;
  averageConfidence: number | null;
  averageEv: number | null;
  highestKelly: number | null;
};

export const DISCOVERY_PRIORITY: Record<ScoringTier, DiscoveryPriority> = {
  Elite: { stars: 5, label: "Elite Opportunity", shortLabel: "Elite" },
  "Strong Bet": { stars: 4, label: "Strong", shortLabel: "Strong" },
  "Value Bet": { stars: 3, label: "Good", shortLabel: "Good" },
  Watch: { stars: 2, label: "Watch", shortLabel: "Watch" },
  Avoid: { stars: 1, label: "Avoid", shortLabel: "Avoid" },
};

const DISCOVERY_FROM_TIER: Record<ScoringTier, DiscoveryRecommendationLabel> = {
  Elite: "STRONG BET",
  "Strong Bet": "BET",
  "Value Bet": "LEAN BET",
  Watch: "WATCH",
  Avoid: "SKIP",
};

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  league: "all",
  market: "all",
  minScore: 0,
  risk: "all",
  recommendation: "all",
  kickoff: "all",
  favoritesOnly: false,
};

export const DISCOVERY_SORT_OPTIONS: Array<{
  id: DiscoverySort;
  label: string;
}> = [
  { id: "score", label: "Highest APEX Score" },
  { id: "ev", label: "Highest Expected Value" },
  { id: "kelly", label: "Highest Kelly" },
  { id: "risk", label: "Lowest Risk" },
  { id: "kickoff", label: "Soonest Kickoff" },
];

export const DISCOVERY_RECOMMENDATION_OPTIONS: DiscoveryRecommendationLabel[] = [
  "STRONG BET",
  "BET",
  "LEAN BET",
  "WATCH",
  "SKIP",
];

export function discoveryPriority(row: ApexOpportunity): DiscoveryPriority {
  return DISCOVERY_PRIORITY[row.recommendation];
}

export function discoveryRecommendation(
  row: ApexOpportunity,
): DiscoveryRecommendationLabel {
  return DISCOVERY_FROM_TIER[row.recommendation];
}

export function marketDisplayName(market: OpportunityMarket | "all"): string {
  if (market === "all") return "All markets";
  return "1X2";
}

function finite(values: Array<number | null | undefined>): number[] {
  return values.filter((n): n is number => n != null && Number.isFinite(n));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function nullableDesc(a: number | null, b: number | null): number {
  const left = a ?? Number.NEGATIVE_INFINITY;
  const right = b ?? Number.NEGATIVE_INFINITY;
  return right - left;
}

function nullableAsc(a: number | null, b: number | null): number {
  const left = a ?? Number.POSITIVE_INFINITY;
  const right = b ?? Number.POSITIVE_INFINITY;
  return left - right;
}

export function discoveryPassesFilters(
  row: ApexOpportunity,
  filters: DiscoveryFilters,
  watchlistIds: string[] = [],
): boolean {
  if (row.score < filters.minScore) return false;
  if (filters.league !== "all" && row.leagueName !== filters.league) return false;
  if (filters.market !== "all" && row.market !== filters.market) return false;
  if (filters.risk !== "all" && row.riskBand !== filters.risk) return false;
  if (
    filters.recommendation !== "all" &&
    discoveryRecommendation(row) !== filters.recommendation
  ) {
    return false;
  }
  if (
    filters.kickoff !== "all" &&
    kickoffWindow(row.kickoffAt) !== filters.kickoff
  ) {
    return false;
  }
  if (filters.favoritesOnly && !watchlistIds.includes(row.fixtureId)) {
    return false;
  }
  return true;
}

export function sortDiscovery(
  rows: ApexOpportunity[],
  sort: DiscoverySort = "score",
): ApexOpportunity[] {
  return [...rows].sort((a, b) => {
    if (sort === "ev") {
      const ev = nullableDesc(a.expectedValue, b.expectedValue);
      if (ev !== 0) return ev;
    } else if (sort === "kelly") {
      const kelly = nullableDesc(a.kellyPct, b.kellyPct);
      if (kelly !== 0) return kelly;
    } else if (sort === "risk") {
      const risk = a.riskScore - b.riskScore;
      if (risk !== 0) return risk;
    } else if (sort === "kickoff") {
      const kick = nullableAsc(Date.parse(a.kickoffAt), Date.parse(b.kickoffAt));
      if (kick !== 0) return kick;
    } else {
      const score = b.score - a.score;
      if (score !== 0) return score;
    }

    if (b.score !== a.score) return b.score - a.score;
    const ev = nullableDesc(a.expectedValue, b.expectedValue);
    if (ev !== 0) return ev;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
}

export function filterDiscovery(
  rows: ApexOpportunity[],
  filters: DiscoveryFilters = DEFAULT_DISCOVERY_FILTERS,
  watchlistIds: string[] = [],
  sort: DiscoverySort = "score",
): ApexOpportunity[] {
  return sortDiscovery(
    rows.filter((row) => discoveryPassesFilters(row, filters, watchlistIds)),
    sort,
  );
}

export function discoveryDashboardStats(
  analyzed: ApexOpportunity[],
): DiscoveryDashboardStats {
  const kellys = finite(analyzed.map((row) => row.kellyPct));
  return {
    today: analyzed.length,
    elite: analyzed.filter((row) => row.recommendation === "Elite").length,
    averageConfidence: mean(analyzed.map((row) => row.confidence)),
    averageEv: mean(finite(analyzed.map((row) => row.expectedValue))),
    highestKelly: kellys.length === 0 ? null : Math.max(...kellys),
  };
}

export { leagueOptions };
