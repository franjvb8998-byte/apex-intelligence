import { adaptApiFootballTeam } from "@/lib/data-platform/providers/api-football/adapters";
import type { ApexTeam } from "@/lib/data-platform/types/team";
import type {
  ApiFootballInjuriesResponse,
  ApiFootballFixturesResponse,
  ApiFootballLeaguesResponse,
  ApiFootballPlayersResponse,
  ApiFootballTeamDetails,
  ApiFootballTeamsResponse,
} from "@/lib/data-platform/providers/api-football/types";
import type { FootballSource } from "@/lib/repositories/source";

export type TeamsRepository = {
  getById(teamId: string): Promise<ApexTeam | null>;
  getDetails(teamId: string): Promise<ApiFootballTeamDetails | null>;
  getVendorPayload(teamId: string): Promise<ApiFootballTeamsResponse | null>;
  listRecentFixtures(
    teamId: string,
    last?: number,
  ): Promise<ApiFootballFixturesResponse | null>;
  listInjuries(query: {
    fixture?: string | number;
    team?: string | number;
    season?: string | number;
  }): Promise<ApiFootballInjuriesResponse | null>;
  getLeague(leagueId: string): Promise<ApiFootballLeaguesResponse | null>;
  getPlayer(
    playerId: string,
    season?: string | number,
  ): Promise<ApiFootballPlayersResponse | null>;
};

export function createTeamsRepository(source: FootballSource): TeamsRepository {
  return {
    async getVendorPayload(teamId) {
      if (!source.extras) return null;
      return source.extras.getTeam(teamId);
    },

    async getDetails(teamId) {
      const payload = await this.getVendorPayload(teamId);
      return payload?.response[0] ?? null;
    },

    async getById(teamId) {
      const details = await this.getDetails(teamId);
      return details ? adaptApiFootballTeam(details) : null;
    },

    async listRecentFixtures(teamId, last = 5) {
      if (!source.extras) return null;
      return source.extras.getTeamLastFixtures(teamId, last);
    },

    async listInjuries(query) {
      if (!source.extras) return null;
      return source.extras.getInjuries(query);
    },

    async getLeague(leagueId) {
      if (!source.extras) return null;
      return source.extras.getLeague(leagueId);
    },

    async getPlayer(playerId, season) {
      if (!source.extras) return null;
      return source.extras.getPlayer(playerId, season);
    },
  };
}
