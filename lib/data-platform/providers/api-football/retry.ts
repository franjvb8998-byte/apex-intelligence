/**
 * Exponential backoff retry helper for API-Football HTTP calls.
 */

import {
  isDataPlatformHttpError,
} from "@/lib/data-platform/http/errors";

export type RetryOptions = {
  /** Total attempts including the first (default 3). */
  maxAttempts?: number;
  /** Base delay in ms; doubles each retry (default 250). */
  baseDelayMs?: number;
  /** Optional sleep override (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Decide whether an error is retryable. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function defaultShouldRetry(error: unknown): boolean {
  if (!isDataPlatformHttpError(error)) return false;
  return (
    error.code === "timeout" ||
    error.code === "network" ||
    error.code === "rate_limited" ||
    (error.status != null && error.status >= 500)
  );
}

/**
 * Run `fn` with retries on transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLast = attempt >= maxAttempts;
      if (isLast || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError;
}
