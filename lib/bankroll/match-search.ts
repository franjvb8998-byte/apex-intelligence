/**
 * Filter Match Center fixtures for the Add Bet picker.
 */

import type { DashboardMatchSummary } from "@/lib/dashboard/types";

export function matchLabel(match: DashboardMatchSummary): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

export function fixtureSearchText(match: DashboardMatchSummary): string {
  return [
    match.homeTeam.name,
    match.homeTeam.shortName,
    match.awayTeam.name,
    match.awayTeam.shortName,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

export function filterFixturesByTeam(
  fixtures: DashboardMatchSummary[],
  query: string,
): DashboardMatchSummary[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return fixtures;
  return fixtures.filter((match) => fixtureSearchText(match).includes(needle));
}
