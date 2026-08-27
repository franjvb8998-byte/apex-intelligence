/**
 * API-Football response cache policy: TTLs, rate-limit detection, CACHE/API logs.
 */

export const API_FOOTBALL_CACHE_TTL_MS = {
  /** Fixtures lists (by date, league, last N, H2H). */
  fixtures: 10 * 60 * 1000,
  /** Match details (fixture, events, lineups, odds, stats, injuries). */
  match: 10 * 60 * 1000,
  /** Team + player catalogue. */
  team: 24 * 60 * 60 * 1000,
  /** League catalogue. */
  league: 24 * 60 * 60 * 1000,
  standings: 30 * 60 * 1000,
} as const;

/** Next.js Image optimizer: treat team crests as immutable (1 year). */
export const TEAM_LOGO_CACHE_TTL_SECONDS = 31_536_000;

export type ApiFootballCacheSource = "CACHE" | "API";

export type ApiFootballCacheLogEvent = {
  source: ApiFootballCacheSource;
  key: string;
  stale?: boolean;
};

export type ApiFootballCacheLogger = (event: ApiFootballCacheLogEvent) => void;

export function ttlForCacheKey(key: string, overrideTtlMs?: number): number {
  if (overrideTtlMs != null) return overrideTtlMs;
  if (key.startsWith("af:standings:")) return API_FOOTBALL_CACHE_TTL_MS.standings;
  if (key.startsWith("af:league:")) return API_FOOTBALL_CACHE_TTL_MS.league;
  if (key.startsWith("af:team:") || key.startsWith("af:team-stats:") || key.startsWith("af:player:")) {
    return API_FOOTBALL_CACHE_TTL_MS.team;
  }
  if (key.startsWith("af:fixtures:") || key.startsWith("af:h2h:")) {
    return API_FOOTBALL_CACHE_TTL_MS.fixtures;
  }
  return API_FOOTBALL_CACHE_TTL_MS.match;
}

export function logApiFootballCache(
  event: ApiFootballCacheLogEvent,
  logger: ApiFootballCacheLogger = defaultApiFootballCacheLogger,
): void {
  logger(event);
}

export function defaultApiFootballCacheLogger(event: ApiFootballCacheLogEvent): void {
  const source = event.stale ? "CACHE (stale)" : event.source;
  console.info(`[api-football] ${source} ${event.key}`);
}

export function apiFootballVendorErrorText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (!("errors" in payload)) return null;
  const errors = (payload as { errors?: unknown }).errors;
  if (!errors) return null;
  if (Array.isArray(errors)) {
    if (errors.length === 0) return null;
    return errors.map(String).join("; ");
  }
  if (typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>).filter(Boolean);
    if (values.length === 0) return null;
    return values.map(String).join("; ");
  }
  return String(errors);
}

export function isApiFootballRateLimitMessage(message: string): boolean {
  return /request limit|rate limit|too many requests|\bquota\b/i.test(message);
}

export function isApiFootballRateLimitPayload(payload: unknown): boolean {
  const text = apiFootballVendorErrorText(payload);
  return text != null && isApiFootballRateLimitMessage(text);
}

export function isApiFootballRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as {
    code?: unknown;
    apiFootballCode?: unknown;
    status?: unknown;
    message?: unknown;
  };
  if (record.code === "rate_limited" || record.apiFootballCode === "rate_limited") {
    return true;
  }
  if (record.status === 429) return true;
  if (typeof record.message === "string" && isApiFootballRateLimitMessage(record.message)) {
    return true;
  }
  return false;
}
