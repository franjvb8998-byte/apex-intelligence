/**
 * PE-4F — Run-scope cache for team schedule acquisitions.
 * Does not touch PE-3 season-universe cache.
 */

import type {
  Pe4TeamScheduleAcquireKey,
  Pe4TeamScheduleAcquireResult,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

export type Pe4TeamScheduleLoader = (
  key: Pe4TeamScheduleAcquireKey,
) => Promise<Pe4TeamScheduleAcquireResult>;

export function pe4TeamScheduleCacheKey(key: Pe4TeamScheduleAcquireKey): string {
  if (key.kind === "team_season") {
    return `team_season::${key.teamId}::${key.season}`;
  }
  return `team_season_window::${key.teamId}::${key.season}::${key.fromDate}::${key.toDate}`;
}

export type RunScopedPe4TeamScheduleCache = {
  getOrLoad: (
    key: Pe4TeamScheduleAcquireKey,
    loader: Pe4TeamScheduleLoader,
  ) => Promise<Pe4TeamScheduleAcquireResult>;
  readonly loaderInvocations: number;
  readonly cachedKeys: readonly string[];
};

export function createRunScopedPe4TeamScheduleCache(): RunScopedPe4TeamScheduleCache {
  const inflight = new Map<string, Promise<Pe4TeamScheduleAcquireResult>>();
  let loaderInvocations = 0;

  return {
    get loaderInvocations() {
      return loaderInvocations;
    },
    get cachedKeys() {
      return [...inflight.keys()].sort();
    },
    async getOrLoad(key, loader) {
      const cacheKey = pe4TeamScheduleCacheKey(key);
      const existing = inflight.get(cacheKey);
      if (existing) return existing;
      loaderInvocations += 1;
      const promise = loader(key);
      inflight.set(cacheKey, promise);
      return promise;
    },
  };
}
