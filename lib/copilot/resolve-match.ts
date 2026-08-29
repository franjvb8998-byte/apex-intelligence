/**
 * Resolve a catalogue fixture from a free-text team query.
 */

import { fixtureSearchText, matchLabel } from "@/lib/bankroll/match-search";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

export function scoreFixtureMatch(
  fixture: DashboardMatchSummary,
  query: string,
): number {
  const haystack = fixtureSearchText(fixture);
  const label = matchLabel(fixture).toLowerCase();
  const folded = query.toLowerCase();
  if (!folded.trim()) return 0;
  if (haystack.includes(folded) || label.includes(folded)) return 100;
  const bits = tokens(query);
  if (bits.length === 0) return 0;
  return bits.filter((token) => haystack.includes(token)).length;
}

export function resolveFixtureFromQuery(
  fixtures: DashboardMatchSummary[],
  query: string | null,
): DashboardMatchSummary | null {
  if (!query || fixtures.length === 0) return null;
  let best: DashboardMatchSummary | null = null;
  let bestScore = 0;
  for (const fixture of fixtures) {
    const score = scoreFixtureMatch(fixture, query);
    if (score > bestScore) {
      best = fixture;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function fixtureExternalId(fixture: DashboardMatchSummary): string | null {
  return fixtureIdFromMatch(fixture);
}
