export {
  createSeasonUniverseLoaderFromCompletePages,
  createSeasonUniverseLoaderFromProviderFetch,
  normalizeSeasonUniverseRows,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe/acquisition";

export {
  SEASON_UNIVERSE_MAX_PAGES,
  fetchCompleteSeasonUniversePages,
  type CompleteSeasonUniverseResult,
  type SeasonUniversePageEnvelope,
  type SeasonUniversePageTransport,
  type SeasonUniversePaging,
} from "@/lib/prematch-lifecycle/season-universe/complete-fetch";

export {
  createRunScopedSeasonUniverseCache,
  type RunScopedSeasonUniverseCache,
  type SeasonUniverseAcquireErr,
  type SeasonUniverseAcquireOk,
  type SeasonUniverseAcquireResult,
  type SeasonUniverseLoader,
} from "@/lib/prematch-lifecycle/season-universe/run-scope-cache";

export {
  resolveSeasonUniverseKeyFromBundle,
  seasonUniverseCacheKey,
  type SeasonResolutionResult,
  type SeasonUniverseKey,
} from "@/lib/prematch-lifecycle/season-universe/season-resolution";

export {
  createSeasonUniverseLoaderFromBundles,
  createSeasonUniverseLoaderFromPagedTransport,
  mapApexBundleToSeasonUniverseRow,
  requireVendorLeagueIdForSeasonKey,
} from "@/lib/prematch-lifecycle/season-universe/from-bundles";

export { vendorLeagueIdFromCompetitionId } from "@/lib/prematch-lifecycle/season-universe/vendor-league-id";

export {
  createProductionSeasonUniverseLoader,
  createSeasonUniversePageTransportFromApiFootballClient,
  mapApiFootballFixtureItemToSeasonUniverseRow,
} from "@/lib/prematch-lifecycle/season-universe/api-football-paged-transport";
