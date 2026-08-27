/**
 * Detect API-Football free-plan quota / rate-limit failures for UI handling.
 */

import { isApiFootballRateLimitError } from "@/lib/data-platform/providers/api-football/cache-policy";

export function isApiFootballQuotaError(error: unknown): boolean {
  return isApiFootballRateLimitError(error);
}

export type QuotaLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; quota: true };

/**
 * Run a Data Platform load. Quota errors become a result; other errors rethrow.
 */
export async function loadUnlessQuota<T>(
  load: () => Promise<T>,
): Promise<QuotaLoadResult<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (isApiFootballQuotaError(error)) {
      return { ok: false, quota: true };
    }
    throw error;
  }
}

/**
 * Swallow unexpected failures, but never hide a quota error.
 */
export async function ignoreNonQuotaErrors<T>(
  load: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (isApiFootballQuotaError(error)) throw error;
    return fallback;
  }
}
