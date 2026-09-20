/**
 * Server-side Vision live refresh coordinator.
 *
 * Many Match Center viewers → one refresh per fixture per ~60s window →
 * API-Football via Phase 2A.1 transport.
 *
 * Dedup layers (process-local only — not cross-instance):
 * 1. Browser cadence (>=60s, HT >= live) to /api/match-center/live/:id
 * 2. Coordinator single-flight `vision-live:refresh:{fixtureId}`
 * 3. Vision store freshness skip if fetchedAt < 60s
 * 4. API-Football `af:live:*` HTTP cache TTL 60s
 *
 * LIMITATION: process-local store + single-flight. This is not cross-instance
 * locking. Multiple server instances would each talk to the provider.
 */

import { createTtlCache } from "@/lib/data-platform/cache";
import {
  tryCreateApiFootballClientFromEnv,
  withApiFootballClientCache,
} from "@/lib/data-platform/providers/api-football/client";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import { liveFixturesCacheKey } from "@/lib/data-platform/providers/api-football/live-query";
import { singleFlightApiFootball } from "@/lib/data-platform/providers/api-football/single-flight";
import { createProcessLiveStore } from "@/lib/apex-vision/live/store";
import {
  createVisionLiveTransport,
  type VisionLiveTransport,
} from "@/lib/apex-vision/live/service";
import {
  LIVE_REFRESH_INTERVAL_MS,
  toMatchCenterLiveView,
  unavailableLiveView,
  type MatchCenterLiveView,
} from "@/lib/apex-vision/live/view";
import type { LiveFixtureState } from "@/lib/apex-vision/live/types";

const COORD_SLOT = Symbol.for("apex.vision.live.coordinator");
const CACHE_SLOT = Symbol.for("apex.vision.live.httpCache");

type CoordGlobal = typeof globalThis & {
  [COORD_SLOT]?: VisionLiveCoordinator;
  [CACHE_SLOT]?: ReturnType<typeof createTtlCache>;
};

export type VisionLiveCoordinator = {
  refreshFixture(fixtureId: number): Promise<MatchCenterLiveView>;
  /** Process-local store read. Never talks to the provider. */
  peekFixture(fixtureId: number): LiveFixtureState | null;
};

function hasZeroCallPeek(
  value: VisionLiveCoordinator | undefined,
): value is VisionLiveCoordinator {
  return (
    typeof value?.refreshFixture === "function" &&
    typeof value.peekFixture === "function"
  );
}

export type VisionLiveCoordinatorOptions = {
  transport: VisionLiveTransport;
  now?: () => Date;
  refreshTtlMs?: number;
  /**
   * True when `af:live:fixtures:{id}` is already in the process live HTTP cache
   * before snapshot. Metadata only — not proof of a subsequent origin skip.
   */
  hasLiveHttpCache?: (fixtureId: number) => boolean;
};

function isFresh(
  fetchedAtUtc: string,
  nowMs: number,
  ttlMs: number,
): boolean {
  const fetched = Date.parse(fetchedAtUtc);
  if (!Number.isFinite(fetched)) return false;
  return nowMs - fetched < ttlMs;
}

export function createVisionLiveCoordinator(
  options: VisionLiveCoordinatorOptions,
): VisionLiveCoordinator {
  const now = options.now ?? (() => new Date());
  const refreshTtlMs = options.refreshTtlMs ?? LIVE_REFRESH_INTERVAL_MS;

  return {
    peekFixture(fixtureId) {
      return options.transport.getFixture(fixtureId);
    },
    async refreshFixture(fixtureId) {
      const key = `vision-live:refresh:${fixtureId}`;
      return singleFlightApiFootball(key, async () => {
        const nowMs = now().getTime();
        const nowUtc = now().toISOString();
        const existing = options.transport.getFixture(fixtureId);
        if (existing && isFresh(existing.fetchedAtUtc, nowMs, refreshTtlMs)) {
          return toMatchCenterLiveView({
            state: existing,
            nowMs,
            refreshSource: "CACHE",
            refreshPerformed: false,
            cacheHit: true,
            lastProviderRefreshAt: existing.fetchedAtUtc,
            httpOrigin: "VISION_STORE_CACHE",
          });
        }

        const liveHttpCached = options.hasLiveHttpCache?.(fixtureId) === true;
        const snapshot = await options.transport.snapshotTrackedFixtures([
          fixtureId,
        ]);
        const state =
          snapshot.fixtures.find((row) => row.fixtureId === fixtureId) ??
          options.transport.getFixture(fixtureId);
        const httpOrigin = liveHttpCached
          ? "LIVE_CACHE_REUSE"
          : "PROVIDER_REFRESH";
        if (!state) {
          const empty = unavailableLiveView(fixtureId, nowUtc);
          return {
            ...empty,
            refresh: {
              ...empty.refresh,
              lastProviderRefreshAt: nowUtc,
              refreshSource: "PROVIDER",
              refreshPerformed: true,
              cacheHit: false,
              httpOrigin,
            },
          };
        }
        return toMatchCenterLiveView({
          state,
          nowMs: now().getTime(),
          refreshSource: "PROVIDER",
          refreshPerformed: true,
          cacheHit: false,
          lastProviderRefreshAt: nowUtc,
          httpOrigin,
        });
      });
    },
  };
}

function sharedLiveHttpCache() {
  const g = globalThis as CoordGlobal;
  if (!g[CACHE_SLOT]) {
    g[CACHE_SLOT] = createTtlCache({
      defaultTtlMs: LIVE_REFRESH_INTERVAL_MS,
      maxEntries: 200,
    });
  }
  return g[CACHE_SLOT];
}

/**
 * Process-local production coordinator.
 * Documented limitation: not a multi-instance lock.
 *
 * `Symbol.for("apex.vision.live.coordinator")` survives Turbopack HMR.
 * A 2A.2 singleton only had `refreshFixture`. Replace that shape so Match
 * Center never calls a missing `peekFixture`.
 */
export function getVisionLiveCoordinator(): VisionLiveCoordinator {
  const g = globalThis as CoordGlobal;
  const existing = g[COORD_SLOT];
  if (hasZeroCallPeek(existing)) {
    return existing;
  }
  const resolved =
    tryCreateApiFootballClientFromEnv() ?? createFixtureApiFootballClient();
  const cache = sharedLiveHttpCache();
  const client = withApiFootballClientCache(resolved, cache, {
    logger: () => undefined,
  });
  const coordinator = createVisionLiveCoordinator({
    transport: createVisionLiveTransport({
      client,
      store: createProcessLiveStore(),
    }),
    hasLiveHttpCache: (fixtureId) =>
      cache.get(liveFixturesCacheKey([fixtureId])) !== undefined,
  });
  g[COORD_SLOT] = coordinator;
  return coordinator;
}

/**
 * Zero-provider-call Vision store read used by Match Center Live Lite routing.
 * Goes through {@link getVisionLiveCoordinator} so a stale singleton is upgraded
 * before the read. Empty store returns null.
 */
export function peekVisionLiveFixture(
  fixtureId: number,
): LiveFixtureState | null {
  return getVisionLiveCoordinator().peekFixture(fixtureId);
}

export function resetVisionLiveCoordinatorForTests(): void {
  const g = globalThis as CoordGlobal;
  delete g[COORD_SLOT];
  g[CACHE_SLOT]?.clear();
}

export function setVisionLiveCoordinatorForTests(
  coordinator: VisionLiveCoordinator | null,
): void {
  const g = globalThis as CoordGlobal;
  if (coordinator) g[COORD_SLOT] = coordinator;
  else delete g[COORD_SLOT];
}
