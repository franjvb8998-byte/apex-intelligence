/**
 * API-Football configuration (env + defaults).
 * Server-only secrets — never expose via NEXT_PUBLIC_*.
 */

export const API_FOOTBALL_DEFAULT_BASE_URL =
  "https://v3.football.api-sports.io";

export type ApiFootballConfig = {
  apiKey: string | null;
  baseUrl: string;
  defaultFixtureId: string | null;
  /** Max attempts including the first call (default 3). */
  retryMaxAttempts: number;
  /** Base delay for exponential backoff in ms (default 250). */
  retryBaseDelayMs: number;
  /** Max requests allowed in the sliding window (default 10). */
  rateLimitMaxRequests: number;
  /** Sliding window size in ms (default 10_000). */
  rateLimitWindowMs: number;
  /** HTTP timeout in ms (default 12_000). */
  timeoutMs: number;
};

export type ApiFootballEnv = {
  apiKey: string | null;
  baseUrl: string;
  defaultFixtureId: string | null;
};

function readInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Full runtime config for the API-Football HTTP stack.
 */
export function readApiFootballConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ApiFootballConfig {
  const apiKey =
    env.API_FOOTBALL_KEY?.trim() ||
    env.APISPORTS_KEY?.trim() ||
    env.API_KEY?.trim() ||
    null;

  return {
    apiKey,
    baseUrl:
      env.API_FOOTBALL_BASE_URL?.trim() || API_FOOTBALL_DEFAULT_BASE_URL,
    defaultFixtureId:
      env.API_FOOTBALL_DEFAULT_FIXTURE_ID?.trim() || null,
    retryMaxAttempts: readInt(env.API_FOOTBALL_RETRY_MAX_ATTEMPTS, 3),
    retryBaseDelayMs: readInt(env.API_FOOTBALL_RETRY_BASE_DELAY_MS, 250),
    rateLimitMaxRequests: readInt(env.API_FOOTBALL_RATE_LIMIT_MAX, 10),
    rateLimitWindowMs: readInt(env.API_FOOTBALL_RATE_LIMIT_WINDOW_MS, 10_000),
    timeoutMs: readInt(env.API_FOOTBALL_TIMEOUT_MS, 12_000),
  };
}

/** Compact env snapshot (legacy helper). */
export function readApiFootballEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ApiFootballEnv {
  const config = readApiFootballConfig(env);
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    defaultFixtureId: config.defaultFixtureId,
  };
}

export function requireApiFootballKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const { apiKey } = readApiFootballConfig(env);
  if (!apiKey) {
    throw new Error(
      "Missing environment variable: API_FOOTBALL_KEY (or APISPORTS_KEY)",
    );
  }
  return apiKey;
}
