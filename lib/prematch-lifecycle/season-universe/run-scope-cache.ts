/**
 * Run-scoped season fixture universe cache.
 * One logical acquisition per (competitionId, season) per lifecycle run.
 * That acquisition may issue multiple bounded HTTP page requests (PE-3E).
 */

import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength";
import {
  seasonUniverseCacheKey,
  type SeasonUniverseKey,
} from "@/lib/prematch-lifecycle/season-universe/season-resolution";

export type SeasonUniverseAcquireOk = {
  ok: true;
  key: SeasonUniverseKey;
  fixtures: readonly PrematchStrengthUniverseFixture[];
  /** HTTP page requests spent on this acquisition (0 if synthetic). */
  httpRequests: number;
};

export type SeasonUniverseAcquireErr = {
  ok: false;
  key: SeasonUniverseKey | null;
  reason:
    | "missing_competition"
    | "missing_season"
    | "invalid_season"
    | "invalid_vendor_league_id"
    | "provider_failure"
    | "malformed_provider_response"
    | "incomplete_season_list"
    | "pagination_bound_exceeded"
    | "timeout";
  httpRequests: number;
};

export type SeasonUniverseAcquireResult =
  | SeasonUniverseAcquireOk
  | SeasonUniverseAcquireErr;

export type SeasonUniverseLoader = (
  key: SeasonUniverseKey,
) => Promise<SeasonUniverseAcquireResult>;

export type RunScopedSeasonUniverseCache = {
  getOrLoad: (
    key: SeasonUniverseKey,
    loader: SeasonUniverseLoader,
  ) => Promise<SeasonUniverseAcquireResult>;
  /** Logical acquisitions (loader invocations; not cache hits). */
  readonly loaderInvocations: number;
  /** Alias for loaderInvocations — seasonUniverseAcquisitions. */
  readonly acquisitions: number;
  /** Sum of HTTP page requests across acquisitions in this run. */
  readonly httpRequests: number;
  readonly cachedKeys: readonly string[];
};

export function createRunScopedSeasonUniverseCache(): RunScopedSeasonUniverseCache {
  const inflight = new Map<string, Promise<SeasonUniverseAcquireResult>>();
  let loaderInvocations = 0;
  let httpRequestsTotal = 0;

  return {
    get loaderInvocations() {
      return loaderInvocations;
    },
    get acquisitions() {
      return loaderInvocations;
    },
    get httpRequests() {
      return httpRequestsTotal;
    },
    get cachedKeys() {
      return [...inflight.keys()].sort();
    },
    async getOrLoad(key, loader) {
      const cacheKey = seasonUniverseCacheKey(key);
      const existing = inflight.get(cacheKey);
      if (existing) return existing;

      loaderInvocations += 1;
      const pending = loader(key).then((result) => {
        httpRequestsTotal += result.httpRequests ?? 0;
        return result;
      });
      inflight.set(cacheKey, pending);
      return pending;
    },
  };
}
