import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { FootballSource } from "@/lib/repositories/source";

export type OddsRepository = {
  listForFixture(matchId: string): Promise<ApexOddsQuote[]>;
};

export function createOddsRepository(source: FootballSource): OddsRepository {
  return {
    async listForFixture(matchId) {
      const bundle = await source.getMatch({ matchId });
      return bundle.odds;
    },
  };
}
