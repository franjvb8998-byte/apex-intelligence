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

const COORD_SLOT = Symbol.for("apex.vision.live.coordinator");
const CACHE_SLOT = Symbol.for("apex.vision.live.httpCache");

type CoordGlobal = typeof globalThis & {
  [COORD_SLOT]?: VisionLiveCoordinator;
  [CACHE_SLOT]?: ReturnType<typeof createTtlCache>;
};

export type VisionLiveCoordinator = {
  refreshFixture(fixtureId: number): Promise<MatchCenterLiveView>;
};

export type VisionLiveCoordinatorOptions = {
  transport: VisionLiveTransport;
  now?: () => Date;
  refreshTtlMs?: number;
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
          });
        }

        const snapshot = await options.transport.snapshotTrackedFixtures([
          fixtureId,
        ]);
        const state =
          snapshot.fixtures.find((row) => row.fixtureId === fixtureId) ??
          options.transport.getFixture(fixtureId);
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
 */
export function getVisionLiveCoordinator(): VisionLiveCoordinator {
  const g = globalThis as CoordGlobal;
  if (!g[COORD_SLOT]) {
    const resolved =
      tryCreateApiFootballClientFromEnv() ?? createFixtureApiFootballClient();
    const client = withApiFootballClientCache(resolved, sharedLiveHttpCache(), {
      logger: () => undefined,
    });
    g[COORD_SLOT] = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({
        client,
        store: createProcessLiveStore(),
      }),
    });
  }
  return g[COORD_SLOT];
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
