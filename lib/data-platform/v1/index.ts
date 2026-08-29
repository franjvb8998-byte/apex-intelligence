export {
  PLATFORM_CACHE_TTL_MS,
  isPermanentCache,
  ttlMsForResource,
  type PlatformCacheResource,
} from "@/lib/data-platform/v1/cache-policy";

export {
  InMemoryCatalogueStore,
  createInMemoryCatalogueStore,
  type CatalogueListQuery,
  type CatalogueStandingRow,
  type CatalogueStore,
} from "@/lib/data-platform/v1/catalogue-store";

export {
  createFootballCollector,
  type CollectorJob,
  type CollectorResource,
  type CollectorResult,
  type CreateFootballCollectorOptions,
  type FootballCollector,
} from "@/lib/data-platform/v1/collector";

export {
  createCataloguePlatformServices,
  type BankrollService,
  type FixtureService,
  type OddsService,
  type OpportunityService,
  type PlatformServices,
  type PortfolioService,
  type RecommendationService,
  type StandingsService,
} from "@/lib/data-platform/v1/services";
