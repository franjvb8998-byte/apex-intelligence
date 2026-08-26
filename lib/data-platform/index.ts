/**
 * APEX Data Platform — provider-agnostic ingestion infrastructure.
 *
 * v2 access layer: IDataProvider + ProviderFactory (mock by default).
 * Legacy flow: MatchDataProvider → Normalizer → ApexMatchBundle → DataQuality → EventStore
 *
 * See docs/data-platform.md
 */

export type * from "@/lib/data-platform/types/index";
export type * from "@/lib/data-platform/contracts";

export type {
  DataProviderKind,
  DataProviderMatchQuery,
  DataProviderFixturesQuery,
  DataProviderMatch,
  DataProviderConfig,
} from "@/lib/data-platform/types";

export type { IDataProvider } from "@/lib/data-platform/provider";

export {
  MockDataProvider,
  createMockDataProvider,
} from "@/lib/data-platform/mock-provider";

export {
  ApiFootballDataProvider,
  createApiFootballDataProvider,
  type ApiFootballDataProviderOptions,
} from "@/lib/data-platform/api-football-provider";

export {
  ProviderFactory,
  createDataProviderFromEnv,
  readDataProviderConfig,
  getDefaultMatchId,
  type ProviderFactoryOptions,
} from "@/lib/data-platform/provider-factory";

export {
  createDataPlatform,
  type DataPlatform,
  type CreateDataPlatformOptions,
  type IngestMatchResult,
} from "@/lib/data-platform/platform";

export {
  createApiFootballProvider,
  ApiFootballProvider,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  createRecordedApiFootballFixturesResponse,
  createApiFootballClient,
  tryCreateApiFootballClientFromEnv,
  readApiFootballEnv,
  readApiFootballConfig,
  requireApiFootballKey,
  API_FOOTBALL_DEFAULT_BASE_URL,
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballStatus,
  isApiFootballFixturesPayload,
  ApiFootballError,
  isApiFootballError,
  createRateLimiter,
  withRetry,
  createSportMonksProvider,
  SportMonksProvider,
  createFootballDataProvider,
  FootballDataProvider,
  createMockProvider,
  MockProvider,
  DEMO_MATCH_EXTERNAL_ID,
  createDemoFixturePayload,
  type ApiFootballProviderOptions,
  type ApiFootballClient,
  type ApiFootballClientOptions,
} from "@/lib/data-platform/providers";

export {
  createHttpClient,
  DataPlatformHttpError,
  isDataPlatformHttpError,
  type HttpClient,
  type HttpClientOptions,
} from "@/lib/data-platform/http";

export {
  createTtlCache,
  type TtlCache,
  type TtlCacheOptions,
} from "@/lib/data-platform/cache";

export {
  createMatchDataNormalizer,
  DefaultMatchDataNormalizer,
} from "@/lib/data-platform/normalization";
export { createDefaultProviderMappers } from "@/lib/data-platform/normalization/mappers";

export {
  createDataQualityModule,
  DefaultDataQualityModule,
} from "@/lib/data-platform/quality";

export {
  createInMemoryEventStore,
  InMemoryEventStore,
} from "@/lib/data-platform/event-store";
