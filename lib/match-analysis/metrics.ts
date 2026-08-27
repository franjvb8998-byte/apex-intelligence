/**
 * Parse API-Football standings + fixture statistics for Match Analysis charts.
 * Never invents values — missing vendor fields stay null.
 */

import type {
  ApiFootballFixtureStatisticsItem,
  ApiFootballStandingLeague,
} from "@/lib/data-platform/providers/api-football/types";
import type { MatchAnalysisMatchMetrics } from "@/lib/match-analysis/types";
import type { MatchAnalysisLeaguePosition } from "@/lib/match-analysis/types";

function numericStat(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value).replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function pickStat(
  item: ApiFootballFixtureStatisticsItem | undefined,
  names: string[],
): number | null {
  if (!item?.statistics) return null;
  const rows = item.statistics;
  for (const name of names) {
    const exact = rows.find(
      (row) => (row.type ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (exact) return numericStat(exact.value);
  }
  for (const name of names) {
    if (name.length < 5) continue;
    const fuzzy = rows.find((row) =>
      (row.type ?? "").toLowerCase().includes(name.toLowerCase()),
    );
    if (fuzzy) return numericStat(fuzzy.value);
  }
  return null;
}

export function matchMetricsFromFixtureStatistics(
  item: ApiFootballFixtureStatisticsItem | undefined,
): MatchAnalysisMatchMetrics | null {
  if (!item) return null;
  const metrics: MatchAnalysisMatchMetrics = {
    possession: pickStat(item, ["ball possession", "possession"]),
    shots: pickStat(item, ["total shots", "shots"]),
    shotsOnTarget: pickStat(item, ["shots on goal", "shots on target"]),
    expectedGoals: pickStat(item, ["expected_goals", "expected goals", "xg"]),
  };
  if (
    metrics.possession == null &&
    metrics.shots == null &&
    metrics.shotsOnTarget == null &&
    metrics.expectedGoals == null
  ) {
    return null;
  }
  return metrics;
}

export function positionFromStandings(
  payload: ApiFootballStandingLeague[] | undefined,
  teamExternalId: string,
): MatchAnalysisLeaguePosition | null {
  if (!payload?.length) return null;
  const teamId = Number(teamExternalId);
  for (const row of payload) {
    const table = row.league?.standings?.flat() ?? [];
    const hit = table.find((entry) => entry.team?.id === teamId);
    if (!hit) continue;
    return {
      rank: hit.rank,
      points: hit.points,
      played: hit.all?.played ?? null,
      teamName: hit.team.name,
    };
  }
  return null;
}

export function fixtureStatisticsByTeam(
  items: ApiFootballFixtureStatisticsItem[],
  teamExternalId: string,
): ApiFootballFixtureStatisticsItem | undefined {
  return items.find((item) => String(item.team?.id) === teamExternalId);
}
