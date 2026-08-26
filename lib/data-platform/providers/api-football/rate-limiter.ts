/**
 * Simple sliding-window rate limiter for API-Football requests.
 */

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
