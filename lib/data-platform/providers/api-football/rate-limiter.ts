/**
 * Simple sliding-window rate limiter for API-Football requests.
 *
 * Process-wide default: `getSharedApiFootballRateLimiter()`.
 * Env `API_FOOTBALL_RATE_LIMIT_MAX` / `API_FOOTBALL_RATE_LIMIT_WINDOW_MS`
 * (defaults 10 / 10_000ms). That is looser than API-Football Free's typical
 * 10 requests/minute contract — do not silently tighten to a paid-plan
 * default in this sprint. Override via env, or pass `rateLimiter` in tests.
 */

import { readApiFootballConfig } from "@/lib/data-platform/providers/api-football/config";

export type RateLimiterOptions = {
  /** Max requests allowed inside the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type RateLimiter = {
  /** Wait until a slot is available, then consume it. */
  acquire(): Promise<void>;
  /** Current number of timestamps retained in the window. */
  pending(): number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const timestamps: number[] = [];
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const { maxRequests, windowMs } = options;

  function prune(current: number): void {
    while (timestamps.length > 0 && current - timestamps[0]! >= windowMs) {
      timestamps.shift();
    }
  }

  return {
    async acquire(): Promise<void> {
      for (;;) {
        const current = now();
        prune(current);
        if (timestamps.length < maxRequests) {
          timestamps.push(current);
          return;
        }
        const oldest = timestamps[0]!;
        const waitMs = Math.max(1, windowMs - (current - oldest));
        await sleep(waitMs);
      }
    },
    pending(): number {
      prune(now());
      return timestamps.length;
    },
  };
}

const SHARED_SLOT = Symbol.for("apex.apiFootball.sharedRateLimiter");

type LimiterGlobal = typeof globalThis & {
  [SHARED_SLOT]?: RateLimiter;
};

/**
 * One scheduling authority for every live API-Football origin call in this process.
 * Tests that need an isolated window must pass `rateLimiter` into the client.
 */
export function getSharedApiFootballRateLimiter(): RateLimiter {
  const g = globalThis as LimiterGlobal;
  if (!g[SHARED_SLOT]) {
    const config = readApiFootballConfig();
    g[SHARED_SLOT] = createRateLimiter({
      maxRequests: config.rateLimitMaxRequests,
      windowMs: config.rateLimitWindowMs,
    });
  }
  return g[SHARED_SLOT];
}

export function resetSharedApiFootballRateLimiterForTests(): void {
  delete (globalThis as LimiterGlobal)[SHARED_SLOT];
}
