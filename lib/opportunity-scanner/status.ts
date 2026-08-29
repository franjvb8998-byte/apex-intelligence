/**
 * Why the desk is quiet — maps existing filters/modes to analyst copy.
 * Does not change gates, scores, or recommendations.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import {
  scannerPassesFilters,
  type ScannerFilters,
} from "@/lib/opportunity-scanner/filters";
import {
  applyScannerMode,
  type ScannerMode,
} from "@/lib/opportunity-scanner/modes";

export type ScannerDeskStatus = {
  analyzed: number;
  qualified: number;
  rejected: number;
  mainReason: ScannerStatusReason | null;
  secondaryReason: ScannerStatusReason | null;
};

export const SCANNER_STATUS_REASONS = [
  "ranked",
  "conservative",
  "value_hunter",
  "high_odds",
  "smart_combo",
  "underdogs",
  "premium",
  "heldCompetition",
  "heldCountry",
  "heldMarket",
  "filteredRisk",
  "confidenceFilter",
  "oddsWindow",
  "evThreshold",
  "favoriteLeagues",
  "favoriteTeams",
  "currentFilters",
  "quotaMain",
  "waitingFixtures",
  "quotaSecondary",
  "publishWhenScored",
  "allQualified",
  "deskSettings",
] as const;

export type ScannerStatusReason = (typeof SCANNER_STATUS_REASONS)[number];

const MODE_REASON: Record<ScannerMode, ScannerStatusReason> = {
  ranked: "ranked",
  conservative: "conservative",
  value_hunter: "value_hunter",
  high_odds: "high_odds",
  smart_combo: "smart_combo",
  underdogs: "underdogs",
  premium: "premium",
};

function filterReason(
  row: ApexOpportunity,
  filters: ScannerFilters,
  favoriteLeagues: string[],
  favoriteTeams: string[],
): ScannerStatusReason | null {
  if (filters.league !== "all" && row.leagueName !== filters.league) {
    return "heldCompetition";
  }
  if (filters.country !== "all" && row.country !== filters.country) {
    return "heldCountry";
  }
  if (filters.market !== "all" && row.market !== filters.market) {
    return "heldMarket";
  }
  if (filters.risk !== "all" && row.riskBand !== filters.risk) {
    return "filteredRisk";
  }
  if (row.confidence < filters.minConfidence) {
    return "confidenceFilter";
  }
  if (filters.oddsMin != null || filters.oddsMax != null) {
    const odds = row.bookmakerOdds;
    if (
      odds == null ||
      !Number.isFinite(odds) ||
      (filters.oddsMin != null && odds < filters.oddsMin) ||
      (filters.oddsMax != null && odds > filters.oddsMax)
    ) {
      return "oddsWindow";
    }
  }
  if (filters.minEv != null) {
    if (
      row.expectedValue == null ||
      !Number.isFinite(row.expectedValue) ||
      (filters.minEv === 0
        ? row.expectedValue <= 0
        : row.expectedValue < filters.minEv)
    ) {
      return "evThreshold";
    }
  }
  if (filters.favoriteLeaguesOnly && !favoriteLeagues.includes(row.leagueName)) {
    return "favoriteLeagues";
  }
  if (filters.favoriteTeamsOnly) {
    const names = [row.home.name, row.away.name];
    if (!names.some((name) => favoriteTeams.includes(name))) {
      return "favoriteTeams";
    }
  }
  return null;
}

export function scannerDropReason(
  row: ApexOpportunity,
  filters: ScannerFilters,
  mode: ScannerMode,
  favoriteLeagues: string[] = [],
  favoriteTeams: string[] = [],
): ScannerStatusReason | null {
  const filter = filterReason(row, filters, favoriteLeagues, favoriteTeams);
  if (filter) return filter;
  if (!scannerPassesFilters(row, filters, favoriteLeagues, favoriteTeams)) {
    return "currentFilters";
  }
  if (applyScannerMode([row], mode).length === 0) {
    return MODE_REASON[mode];
  }
  return null;
}

export function scannerDeskStatus(
  analyzed: ApexOpportunity[],
  qualified: ApexOpportunity[],
  filters: ScannerFilters,
  mode: ScannerMode,
  favoriteLeagues: string[] = [],
  favoriteTeams: string[] = [],
  quotaExhausted = false,
): ScannerDeskStatus {
  const qualifiedIds = new Set(qualified.map((row) => row.fixtureId));
  const counts = new Map<ScannerStatusReason, number>();
  for (const row of analyzed) {
    if (qualifiedIds.has(row.fixtureId)) continue;
    const reason = scannerDropReason(
      row,
      filters,
      mode,
      favoriteLeagues,
      favoriteTeams,
    );
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const analyzedCount = analyzed.length;
  const qualifiedCount = qualified.length;
  const rejected = Math.max(0, analyzedCount - qualifiedCount);

  if (analyzedCount === 0) {
    return {
      analyzed: 0,
      qualified: 0,
      rejected: 0,
      mainReason: quotaExhausted ? "quotaMain" : "waitingFixtures",
      secondaryReason: quotaExhausted ? "quotaSecondary" : "publishWhenScored",
    };
  }

  if (rejected === 0) {
    return {
      analyzed: analyzedCount,
      qualified: qualifiedCount,
      rejected: 0,
      mainReason: "allQualified",
      secondaryReason: null,
    };
  }

  return {
    analyzed: analyzedCount,
    qualified: qualifiedCount,
    rejected,
    mainReason: ranked[0]?.[0] ?? "deskSettings",
    secondaryReason: ranked[1]?.[0] ?? null,
  };
}
