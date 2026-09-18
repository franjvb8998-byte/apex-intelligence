/**
 * API-Football response cache policy: TTLs, rate-limit detection, CACHE/API logs.
 */

import { noteApiFootballCacheEvent } from "@/lib/debug/scanner-profile";

export const API_FOOTBALL_CACHE_TTL_MS = {
  /** Fixtures lists by date / league (live catalogue). */
  fixtures: 10 * 60 * 1000,
  /** Match details (fixture, events, lineups, odds, injuries) while not terminal. */
  match: 10 * 60 * 1000,
  /** Team + player catalogue. */
  team: 24 * 60 * 60 * 1000,
  /** League catalogue. */
  league: 24 * 60 * 60 * 1000,
  /**
   * League table. Matches Data Platform v1 product policy (6h).
   * Pre-match analysis; not a live scoreboard claim.
   */
  standings: 6 * 60 * 60 * 1000,
  /** Head-to-head of completed meetings. */
  h2h: 24 * 60 * 60 * 1000,
  /** Last-N team form. Changes when a match completes, not every few minutes. */
  teamForm: 6 * 60 * 60 * 1000,
  /** Fixture-by-id after a definitive terminal status. */
  finishedMatch: 24 * 60 * 60 * 1000,
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
  if (key.startsWith("af:h2h:")) return API_FOOTBALL_CACHE_TTL_MS.h2h;
  if (key.startsWith("af:fixtures:team:")) return API_FOOTBALL_CACHE_TTL_MS.teamForm;
  if (key.startsWith("af:fixtures:")) return API_FOOTBALL_CACHE_TTL_MS.fixtures;
  return API_FOOTBALL_CACHE_TTL_MS.match;
}

const TERMINAL_VENDOR_SHORT = new Set([
  "FT",
  "AET",
  "PEN",
  "CANC",
  "ABD",
  "AWD",
  "WO",
]);

function fixtureStatusShort(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (!("response" in payload)) return null;
  const response = (payload as { response?: unknown }).response;
  if (!Array.isArray(response) || response.length !== 1) return null;
  const first = response[0];
  if (typeof first !== "object" || first === null || !("fixture" in first)) {
    return null;
  }
  const fixture = (first as { fixture?: { status?: { short?: unknown } } })
    .fixture;
  const short = fixture?.status?.short;
  return typeof short === "string" ? short : null;
}

/**
 * After a successful origin read, lengthen TTL only for a single-fixture
 * payload that is canonically terminal. List keys and live/scheduled
 * matches keep the key policy. Failures never reach this helper.
 */
export function ttlForCachedPayload(
  key: string,
  payload: unknown,
  fallbackMs: number,
): number {
  if (key.startsWith("af:fixtures:")) return fallbackMs;
  if (!key.startsWith("af:fixture:")) return fallbackMs;
  const short = fixtureStatusShort(payload);
  if (!short || !TERMINAL_VENDOR_SHORT.has(short)) return fallbackMs;
  return API_FOOTBALL_CACHE_TTL_MS.finishedMatch;
}

export function logApiFootballCache(
  event: ApiFootballCacheLogEvent,
  logger: ApiFootballCacheLogger = defaultApiFootballCacheLogger,
): void {
  logger(event);
}

export function defaultApiFootballCacheLogger(event: ApiFootballCacheLogEvent): void {
  noteApiFootballCacheEvent({ source: event.source });
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
