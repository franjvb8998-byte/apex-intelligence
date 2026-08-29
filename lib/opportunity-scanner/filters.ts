/**
 * Scanner filters — gates only. Scores stay as published by the Decision Engine.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexRiskBand } from "@/lib/decision-engine/types";
import { applyScannerMode, type ScannerMode } from "@/lib/opportunity-scanner/modes";
import { scannerRecommendation } from "@/lib/opportunity-scanner/recommend";

export type ScannerFilters = {
  league: string;
  country: string;
  market: "1x2" | "all";
  oddsMin: number | null;
  oddsMax: number | null;
  minEv: number | null;
  minConfidence: number;
  risk: "all" | ApexRiskBand;
  favoriteLeaguesOnly: boolean;
  favoriteTeamsOnly: boolean;
};

export const DEFAULT_SCANNER_FILTERS: ScannerFilters = {
  league: "all",
  country: "all",
  market: "all",
  oddsMin: null,
  oddsMax: null,
  minEv: null,
  minConfidence: 0,
  risk: "all",
  favoriteLeaguesOnly: false,
  favoriteTeamsOnly: false,
};

function passesOdds(row: ApexOpportunity, filters: ScannerFilters): boolean {
  if (filters.oddsMin == null && filters.oddsMax == null) return true;
  const odds = row.bookmakerOdds;
  if (odds == null || !Number.isFinite(odds)) return false;
  if (filters.oddsMin != null && odds < filters.oddsMin) return false;
  if (filters.oddsMax != null && odds > filters.oddsMax) return false;
  return true;
}

function passesEv(row: ApexOpportunity, minEv: number | null): boolean {
  if (minEv == null) return true;
  if (row.expectedValue == null || !Number.isFinite(row.expectedValue)) {
    return false;
  }
  if (minEv === 0) return row.expectedValue > 0;
  return row.expectedValue >= minEv;
}

export function scannerPassesFilters(
  row: ApexOpportunity,
  filters: ScannerFilters,
  favoriteLeagues: string[],
  favoriteTeams: string[],
): boolean {
  if (filters.league !== "all" && row.leagueName !== filters.league) return false;
  if (filters.country !== "all" && row.country !== filters.country) return false;
  if (filters.market !== "all" && row.market !== filters.market) return false;
  if (filters.risk !== "all" && row.riskBand !== filters.risk) return false;
  if (row.confidence < filters.minConfidence) return false;
  if (!passesOdds(row, filters)) return false;
  if (!passesEv(row, filters.minEv)) return false;
  if (filters.favoriteLeaguesOnly && !favoriteLeagues.includes(row.leagueName)) {
    return false;
  }
  if (filters.favoriteTeamsOnly) {
    const names = [row.home.name, row.away.name];
    if (!names.some((name) => favoriteTeams.includes(name))) return false;
  }
  return true;
}

export function filterScanner(
  rows: ApexOpportunity[],
  filters: ScannerFilters,
  mode: ScannerMode,
  favoriteLeagues: string[] = [],
  favoriteTeams: string[] = [],
): ApexOpportunity[] {
  const gated = rows.filter((row) =>
    scannerPassesFilters(row, filters, favoriteLeagues, favoriteTeams),
  );
  return applyScannerMode(gated, mode);
}

export function teamOptions(rows: ApexOpportunity[]): string[] {
  const names = rows.flatMap((row) => [row.home.name, row.away.name]);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export { scannerRecommendation };
