import type {
  ApiFootballFixtureStatisticsResponse,
  ApiFootballTeamStatisticsResponse,
} from "@/lib/data-platform/providers/api-football/types";
import type { FootballSource } from "@/lib/repositories/source";

export type StatisticsRepository = {
  getTeamStatistics(
    teamId: string,
    leagueId: string,
    season: string,
  ): Promise<ApiFootballTeamStatisticsResponse | null>;
  getFixtureStatistics(
    fixtureId: string,
  ): Promise<ApiFootballFixtureStatisticsResponse | null>;
};

export function createStatisticsRepository(
  source: FootballSource,
): StatisticsRepository {
  return {
    async getTeamStatistics(teamId, leagueId, season) {
      if (!source.extras) return null;
      return source.extras.getTeamStatistics(teamId, leagueId, season);
    },

    async getFixtureStatistics(fixtureId) {
      if (!source.extras) return null;
      return source.extras.getFixtureStatistics(fixtureId);
    },
  };
}
