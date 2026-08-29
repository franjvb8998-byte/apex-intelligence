import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { MatchAnalysisCatalogue } from "@/lib/match-analysis/catalogue";
import {
  fixtureStatisticsByTeam,
  matchMetricsFromFixtureStatistics,
  positionFromStandings,
} from "@/lib/match-analysis/metrics";
import type { FootballSource } from "@/lib/repositories/source";
import type { StandingsRepository } from "@/lib/repositories/standings";
import type { StatisticsRepository } from "@/lib/repositories/statistics";

export type MatchAnalysisRepository = {
  getCatalogue(bundle: ApexMatchBundle): Promise<MatchAnalysisCatalogue>;
};

const EMPTY_CATALOGUE: MatchAnalysisCatalogue = {
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

export function createMatchAnalysisRepository(
  source: FootballSource,
  standings: StandingsRepository,
  statistics: StatisticsRepository,
): MatchAnalysisRepository {
  return {
    async getCatalogue(bundle) {
      if (!source.extras) {
        return { ...EMPTY_CATALOGUE };
      }

      const homeId = externalId(bundle.homeTeam.externalRefs);
      const awayId = externalId(bundle.awayTeam.externalRefs);
      const leagueId = externalId(bundle.league?.externalRefs);
      const season = seasonYear(bundle.league?.season);
      const fixtureId = externalId(bundle.match.externalRefs);

      const [standingsPayload, statsPayload] = await Promise.all([
        leagueId && season
          ? safe(() => standings.getTable(leagueId, season), null)
          : Promise.resolve(null),
        fixtureId
          ? safe(() => statistics.getFixtureStatistics(fixtureId), null)
          : Promise.resolve(null),
      ]);

      const table = Array.isArray(standingsPayload?.response)
        ? standingsPayload.response
        : [];
      const statItems = Array.isArray(statsPayload?.response)
        ? statsPayload.response
        : [];

      return {
        positions: {
          home: homeId ? positionFromStandings(table, homeId) : null,
          away: awayId ? positionFromStandings(table, awayId) : null,
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
    },
  };
}
