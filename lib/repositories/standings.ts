import type { ApiFootballStandingsResponse } from "@/lib/data-platform/providers/api-football/types";
import type { FootballSource } from "@/lib/repositories/source";

export type StandingsRepository = {
  getTable(
    leagueId: string,
    season: string,
  ): Promise<ApiFootballStandingsResponse | null>;
};

export function createStandingsRepository(
  source: FootballSource,
): StandingsRepository {
  return {
    async getTable(leagueId, season) {
      if (!source.extras) return null;
      return source.extras.getStandings(leagueId, season);
    },
  };
}
