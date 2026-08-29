import { ignoreNonQuotaErrors } from "@/lib/repositories/quota";
import type { FootballSource } from "@/lib/repositories/source";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { DataProviderFixturesQuery } from "@/lib/data-platform/types";
import type {
  ApiFootballEventsResponse,
  ApiFootballHeadToHeadResponse,
  ApiFootballLineupsResponse,
} from "@/lib/data-platform/providers/api-football/types";

const PREMIER_LEAGUE_ID = "39";
const PREMIER_LEAGUE_SEASON = "2025";
const CATALOGUE_LIMIT = 20;

export type FixturesRepository = {
  getById(matchId: string): Promise<ApexMatchBundle>;
  list(query?: DataProviderFixturesQuery): Promise<ApexMatchBundle[]>;
  /** Today, then Premier League 2025 fallback — Match Center catalogue. */
  listCatalogue(limit?: number): Promise<ApexMatchBundle[]>;
  listHeadToHead(
    homeTeamId: string,
    awayTeamId: string,
    last?: number,
  ): Promise<ApiFootballHeadToHeadResponse | null>;
  getLineups(fixtureId: string): Promise<ApiFootballLineupsResponse | null>;
  getEvents(fixtureId: string): Promise<ApiFootballEventsResponse | null>;
};

function rankFixtures(items: ApexMatchBundle[]): ApexMatchBundle[] {
  const rank = (status: ApexMatchBundle["match"]["status"]) => {
    if (status === "live") return 0;
    if (status === "scheduled") return 1;
    if (status === "finished") return 2;
    return 3;
  };
  return [...items].sort(
    (a, b) =>
      rank(a.match.status) - rank(b.match.status) ||
      a.match.kickoffAt.localeCompare(b.match.kickoffAt),
  );
}

export function createFixturesRepository(
  source: FootballSource,
): FixturesRepository {
  return {
    getById(matchId) {
      return source.getMatch({ matchId });
    },

    list(query = {}) {
      return source.listFixtures(query);
    },

    async listCatalogue(limit = CATALOGUE_LIMIT) {
      const today = new Date().toISOString().slice(0, 10);
      let list = await ignoreNonQuotaErrors(
        () => source.listFixtures({ date: today }),
        [],
      );

      if (list.length === 0) {
        list = await ignoreNonQuotaErrors(
          () =>
            source.listFixtures({
              leagueId: PREMIER_LEAGUE_ID,
              season: PREMIER_LEAGUE_SEASON,
              limit,
            }),
          [],
        );
      }

      return rankFixtures(list).slice(0, limit);
    },

    async listHeadToHead(homeTeamId, awayTeamId, last = 5) {
      if (!source.extras) return null;
      return source.extras.getHeadToHead(homeTeamId, awayTeamId, last);
    },

    async getLineups(fixtureId) {
      if (!source.extras) return null;
      return source.extras.getLineups(fixtureId);
    },

    async getEvents(fixtureId) {
      if (!source.extras) return null;
      return source.extras.getEvents(fixtureId);
    },
  };
}
