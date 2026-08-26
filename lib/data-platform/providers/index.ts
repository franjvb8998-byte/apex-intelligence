export {
  createApiFootballProvider,
  ApiFootballProvider,
  ApiFootballDataProvider,
  createApiFootballDataProvider,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  createRecordedApiFootballFixturesResponse,
  type ApiFootballProviderOptions,
  type ApiFootballDataProviderOptions,
} from "@/lib/data-platform/providers/api-football";
export {
  createApiFootballClient,
  tryCreateApiFootballClientFromEnv,
  type ApiFootballClient,
  type ApiFootballClientOptions,
} from "@/lib/data-platform/providers/api-football/client";
export {
  readApiFootballEnv,
  readApiFootballConfig,
  requireApiFootballKey,
  API_FOOTBALL_DEFAULT_BASE_URL,
} from "@/lib/data-platform/providers/api-football/config";
export {
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballStatus,
  isApiFootballFixturesPayload,
} from "@/lib/data-platform/providers/api-football/mapper";
export {
  ApiFootballError,
  isApiFootballError,
} from "@/lib/data-platform/providers/api-football/errors";
export { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
export { withRetry } from "@/lib/data-platform/providers/api-football/retry";
export { createSportMonksProvider, SportMonksProvider } from "@/lib/data-platform/providers/sportmonks";
export { createFootballDataProvider, FootballDataProvider } from "@/lib/data-platform/providers/football-data";
export { createMockProvider, MockProvider } from "@/lib/data-platform/providers/mock";
export {
  DEMO_MATCH_EXTERNAL_ID,
  createDemoFixturePayload,
} from "@/lib/data-platform/providers/_shared/demo-fixture";
