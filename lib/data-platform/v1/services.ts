/**
 * Internal product services — the only API the frontend should call.
 * Implementations read the catalogue (and engines). They do not call vendors.
 */

import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { BankrollData } from "@/lib/bankroll/types";
import type { PortfolioReport } from "@/lib/portfolio/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { ApexId } from "@/lib/data-platform/types/ids";
import type {
  CatalogueListQuery,
  CatalogueStandingRow,
  CatalogueStore,
} from "@/lib/data-platform/v1/catalogue-store";

export interface FixtureService {
  getById(fixtureId: ApexId): Promise<ApexMatchBundle | null>;
  list(query?: CatalogueListQuery): Promise<ApexMatchBundle[]>;
}

export interface OddsService {
  listForFixture(fixtureId: ApexId): Promise<ApexOddsQuote[]>;
}

export interface StandingsService {
  getTable(leagueId: ApexId, season: string): Promise<CatalogueStandingRow[]>;
}

/**
 * Decision Engine output only. Does not re-implement probability, EV, or Kelly.
 */
export interface RecommendationService {
  getForFixture(fixtureId: ApexId): Promise<ApexDecision | null>;
}

export interface OpportunityService {
  listPublished(): Promise<ApexOpportunity[]>;
}

export interface BankrollService {
  getBook(userId: string): Promise<BankrollData | null>;
}

export interface PortfolioService {
  getReport(userId: string): Promise<PortfolioReport | null>;
}

export type PlatformServices = {
  fixtures: FixtureService;
  odds: OddsService;
  standings: StandingsService;
};

/**
 * Catalogue-backed fixture/odds/standings.
 * Recommendation / opportunity / bankroll adapters land when those tables exist.
 */
export function createCataloguePlatformServices(
  store: CatalogueStore,
): PlatformServices {
  return {
    fixtures: {
      getById: (fixtureId) => store.getBundle(fixtureId),
      list: (query) => store.listBundles(query),
    },
    odds: {
      listForFixture: (fixtureId) => store.listOdds(fixtureId),
    },
    standings: {
      getTable: (leagueId, season) => store.listStandings(leagueId, season),
    },
  };
}
