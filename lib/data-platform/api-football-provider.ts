/**
 * Data Platform v2 entry for API-Football IDataProvider.
 * Implementation lives under providers/api-football/ (HTTP integration v1).
 */

export {
  ApiFootballDataProvider,
  createApiFootballDataProvider,
  type ApiFootballDataProviderOptions,
} from "@/lib/data-platform/providers/api-football/api-football-provider";

/** Alias used by ProviderFactory (IDataProvider, not MatchDataProvider). */
export {
  ApiFootballDataProvider as ApiFootballProvider,
} from "@/lib/data-platform/providers/api-football/api-football-provider";
