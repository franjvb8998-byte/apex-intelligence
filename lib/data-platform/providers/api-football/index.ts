/**
 * API-Football provider package barrel (Sprint 6 — Real Data v1).
 */

export {
  readApiFootballConfig,
  readApiFootballEnv,
  requireApiFootballKey,
  API_FOOTBALL_DEFAULT_BASE_URL,
  type ApiFootballConfig,
  type ApiFootballEnv,
} from "@/lib/data-platform/providers/api-football/config";

export {
  ApiFootballError,
  isApiFootballError,
  toApiFootballError,
  type ApiFootballErrorCode,
} from "@/lib/data-platform/providers/api-football/errors";

export {
  withRetry,
  defaultShouldRetry,
  type RetryOptions,
} from "@/lib/data-platform/providers/api-football/retry";

export {
  createRateLimiter,
  type RateLimiter,
  type RateLimiterOptions,
} from "@/lib/data-platform/providers/api-football/rate-limiter";

export {
  createApiFootballClient,
  tryCreateApiFootballClientFromEnv,
  withApiFootballClientCache,
  type ApiFootballClient,
  type ApiFootballClientOptions,
  type ApiFootballClientCacheOptions,
} from "@/lib/data-platform/providers/api-football/client";

export {
  API_FOOTBALL_CACHE_TTL_MS,
  TEAM_LOGO_CACHE_TTL_SECONDS,
  ttlForCacheKey,
  logApiFootballCache,
  isApiFootballRateLimitPayload,
  isApiFootballRateLimitError,
  type ApiFootballCacheLogger,
  type ApiFootballCacheSource,
} from "@/lib/data-platform/providers/api-football/cache-policy";

export {
  isApiFootballQuotaError,
  loadUnlessQuota,
  ignoreNonQuotaErrors,
  type QuotaLoadResult,
} from "@/lib/data-platform/providers/api-football/quota";

export { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";

export {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
  createRecordedApiFootballTeamsResponse,
  createRecordedApiFootballPlayersResponse,
  createRecordedApiFootballLeaguesResponse,
  createRecordedApiFootballStandingsResponse,
  createRecordedApiFootballTeamStatisticsResponse,
  createRecordedApiFootballTodaysMatchesResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  RECORDED_API_FOOTBALL_TEAM_ID,
  RECORDED_API_FOOTBALL_PLAYER_ID,
  RECORDED_API_FOOTBALL_LEAGUE_ID,
  RECORDED_API_FOOTBALL_SEASON,
} from "@/lib/data-platform/providers/api-football/fixtures";

export {
  mapApiFootballEnvelopeToApexBundle,
  mapApiFootballFixtureItemToApexBundle,
  mapApiFootballStatus,
  isApiFootballFixturesPayload,
  adaptApiFootballTeam,
  adaptApiFootballPlayer,
  adaptApiFootballLeague,
  adaptApiFootballTeamStatistics,
  type ApexTeamStatistics,
} from "@/lib/data-platform/providers/api-football/adapters";

export {
  ApiFootballDataProvider,
  createApiFootballDataProvider,
  type ApiFootballDataProviderOptions,
} from "@/lib/data-platform/providers/api-football/api-football-provider";

export {
  ApiFootballProvider,
  createApiFootballProvider,
  type ApiFootballProviderOptions,
} from "@/lib/data-platform/providers/api-football/match-data-adapter";
