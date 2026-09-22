/**
 * Pure filter / sort for the Opportunities board.
 */

import { descPresent } from "@/lib/apex-opportunities/present";
import type {
  ApexOpportunity,
  OpportunityFilters,
  OpportunityKickoffWindow,
} from "@/lib/apex-opportunities/types";
import { DEFAULT_OPPORTUNITY_FILTERS } from "@/lib/apex-opportunities/types";
import { isCurrentActionableOpportunity } from "@/lib/prematch-decision/actionability";

export function kickoffWindow(iso: string): OpportunityKickoffWindow {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "all";
  const hour = new Date(ms).getUTCHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function passesMinEv(ev: number | null, minEv: number): boolean {
  if (ev == null || !Number.isFinite(ev)) return false;
  if (minEv === 0) return ev > 0;
  return ev >= minEv;
}

function passesOddsRange(
  odds: number | null,
  min: number | null,
  max: number | null,
): boolean {
  if (min == null && max == null) return true;
  if (odds == null || !Number.isFinite(odds)) return false;
  if (min != null && odds < min) return false;
  if (max != null && odds > max) return false;
  return true;
}

export function opportunityPassesFilters(
  row: ApexOpportunity,
  filters: OpportunityFilters,
): boolean {
  if (!isCurrentActionableOpportunity(row)) return false;
  if (row.score == null || row.score < filters.minScore) return false;
  if (row.confidence == null || row.confidence < filters.minConfidence) return false;
  if (!passesMinEv(row.expectedValue, filters.minEv)) return false;
  if (filters.league !== "all" && row.leagueName !== filters.league) return false;
  if (filters.market !== "all" && row.market !== filters.market) return false;
  if (filters.risk !== "all" && row.riskBand !== filters.risk) return false;
  if (filters.side !== "all" && row.predicted !== filters.side) return false;
  if (
    filters.kickoff !== "all" &&
    kickoffWindow(row.kickoffAt) !== filters.kickoff
  ) {
    return false;
  }
  if (!passesOddsRange(row.bookmakerOdds, filters.oddsMin, filters.oddsMax)) {
    return false;
  }
  return true;
}

export function sortOpportunities(rows: ApexOpportunity[]): ApexOpportunity[] {
  return [...rows].sort((a, b) => {
    const score = descPresent(a.score, b.score);
    if (score !== 0) return score;
    const ev = descPresent(a.expectedValue, b.expectedValue);
    if (ev !== 0) return ev;
    const confidence = descPresent(a.confidence, b.confidence);
    if (confidence !== 0) return confidence;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
}

export function filterOpportunities(
  rows: ApexOpportunity[],
  filters: OpportunityFilters = DEFAULT_OPPORTUNITY_FILTERS,
): ApexOpportunity[] {
  return sortOpportunities(rows.filter((row) => opportunityPassesFilters(row, filters)));
}

export function leagueOptions(rows: ApexOpportunity[]): string[] {
  return [...new Set(rows.map((row) => row.leagueName).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}
