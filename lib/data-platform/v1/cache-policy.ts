/**
 * Data Platform v1 — cache policy for the internal catalogue.
 * Distinct from API-Football HTTP TTLs (`providers/api-football/cache-policy.ts`).
 * Those remain vendor-edge until the Collector owns ingestion.
 */

export const PLATFORM_CACHE_TTL_MS = {
  /** Upcoming / today fixture lists. */
  fixtures: 15 * 60 * 1000,
  /** Live and pre-match quotes. */
  odds: 2 * 60 * 1000,
  /** League tables. */
  standings: 6 * 60 * 60 * 1000,
  /** Season team statistics. */
  teamStats: 24 * 60 * 60 * 1000,
  /** Injuries / absences around kickoff. */
  injuries: 30 * 60 * 1000,
  /** Confirmed lineups. */
  lineups: 15 * 60 * 1000,
  /** Head-to-head windows. */
  h2h: 24 * 60 * 60 * 1000,
  /** Last-N form. */
  recentForm: 6 * 60 * 60 * 1000,
  /**
   * Finished matches, settled odds, historical events.
   * null = do not expire.
   */
  historical: null,
} as const;

export type PlatformCacheResource = keyof typeof PLATFORM_CACHE_TTL_MS;

export function isPermanentCache(resource: PlatformCacheResource): boolean {
  return PLATFORM_CACHE_TTL_MS[resource] === null;
}

export function ttlMsForResource(resource: PlatformCacheResource): number | null {
  return PLATFORM_CACHE_TTL_MS[resource];
}
