/**
 * Match Analysis extras: standings + in-match statistics.
 */

import { ApiFootballDataProvider } from "@/lib/data-platform/api-football-provider";
import type { IDataProvider } from "@/lib/data-platform/provider";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import {
  fixtureStatisticsByTeam,
  matchMetricsFromFixtureStatistics,
  positionFromStandings,
} from "@/lib/match-analysis/metrics";
import type {
  MatchAnalysisLeaguePosition,
  MatchAnalysisMatchMetrics,
} from "@/lib/match-analysis/types";

export type MatchAnalysisCatalogue = {
  positions: {
    home: MatchAnalysisLeaguePosition | null;
    away: MatchAnalysisLeaguePosition | null;
  };
  matchMetrics: {
    home: MatchAnalysisMatchMetrics | null;
    away: MatchAnalysisMatchMetrics | null;
  };
};

export const EMPTY_MATCH_ANALYSIS_CATALOGUE: MatchAnalysisCatalogue = {
  positions: { home: null, away: null },
  matchMetrics: { home: null, away: null },
};

function externalId(
  refs: Array<{ externalId: string }> | undefined,
): string | null {
  return refs?.[0]?.externalId ?? null;
}

function seasonYear(season: string | null | undefined): string | null {
  if (!season) return null;
  const match = season.match(/^(\d{4})/);
  return match?.[1] ?? season;
}

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export async function enrichMatchAnalysisCatalogue(
  provider: IDataProvider,
  bundle: ApexMatchBundle,
): Promise<MatchAnalysisCatalogue> {
  if (!(provider instanceof ApiFootballDataProvider)) {
    return { ...EMPTY_MATCH_ANALYSIS_CATALOGUE };
  }

  const homeId = externalId(bundle.homeTeam.externalRefs);
  const awayId = externalId(bundle.awayTeam.externalRefs);
  const leagueId = externalId(bundle.league?.externalRefs);
  const season = seasonYear(bundle.league?.season);
  const fixtureId = externalId(bundle.match.externalRefs);

  const [standingsPayload, statsPayload] = await Promise.all([
    leagueId && season
      ? safe(() => provider.http.getStandings(leagueId, season), null)
      : Promise.resolve(null),
    fixtureId
      ? safe(() => provider.http.getFixtureStatistics(fixtureId), null)
      : Promise.resolve(null),
  ]);

  const standings = Array.isArray(standingsPayload?.response)
    ? standingsPayload.response
    : [];
  const statItems = Array.isArray(statsPayload?.response)
    ? statsPayload.response
    : [];

  return {
    positions: {
      home: homeId ? positionFromStandings(standings, homeId) : null,
      away: awayId ? positionFromStandings(standings, awayId) : null,
    },
    matchMetrics: {
      home: homeId
        ? matchMetricsFromFixtureStatistics(
            fixtureStatisticsByTeam(statItems, homeId),
          )
        : null,
      away: awayId
        ? matchMetricsFromFixtureStatistics(
            fixtureStatisticsByTeam(statItems, awayId),
          )
        : null,
    },
  };
}
