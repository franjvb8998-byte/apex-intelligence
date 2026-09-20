/**
 * Central server-side APEX Vision live transport.
 *
 * Architecture C1:
 *   multi-league heartbeat + tracked fixture ids snapshot
 *   + nested events primary + dedicated events safety fallback
 *
 * Browsers must never call this against API-Football directly.
 * Viewer count is not an input and cannot multiply provider traffic.
 *
 * Phase 2A.1 does not start a background poller. Callers invoke refresh
 * methods explicitly. Process-local store/singleFlight is not cross-instance
 * coordination — a shared store / single-writer can replace the store later.
 */

import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import {
  LIVE_TRANSPORT_MAX_ATTEMPTS,
} from "@/lib/data-platform/providers/api-football/live-query";
import {
  createDedicatedEventsFallbackGuard,
  evaluateDedicatedEventsFallback,
  type DedicatedEventsFallbackGuard,
} from "@/lib/apex-vision/live/fallback";
import { normalizeLiveEvent, normalizeLiveFixture } from "@/lib/apex-vision/live/normalize";
import { createProcessLiveStore, type LiveStore } from "@/lib/apex-vision/live/store";
import {
  LIVE_TRANSPORT_SOURCE,
  type LiveFixtureState,
  type LiveTransportSnapshot,
} from "@/lib/apex-vision/live/types";

export const DEFAULT_LIVE_FALLBACK_COOLDOWN_MS = 60_000;
export const DEFAULT_MAX_FALLBACK_CALLS_PER_REFRESH = 1;

export type VisionLiveClient = Pick<
  ApiFootballClient,
  "getLiveFixtures" | "getFixturesByIds" | "getEvents"
>;

export type VisionLiveTransportOptions = {
  client: VisionLiveClient;
  store?: LiveStore;
  now?: () => Date;
  fallbackCooldownMs?: number;
  maxFallbackCallsPerRefresh?: number;
  fallbackGuard?: DedicatedEventsFallbackGuard;
};

export type VisionLiveTransport = {
  heartbeatLiveLeagues(leagueIds: Array<string | number>): Promise<LiveTransportSnapshot>;
  snapshotTrackedFixtures(
    fixtureIds: Array<string | number>,
  ): Promise<LiveTransportSnapshot>;
  getCurrentState(): LiveTransportSnapshot;
  getFixture(fixtureId: number): LiveFixtureState | null;
};

function toSnapshot(
  fixtures: LiveFixtureState[],
  fetchedAtUtc: string,
): LiveTransportSnapshot {
  return {
    source: LIVE_TRANSPORT_SOURCE,
    fetchedAtUtc,
    fixtures,
  };
}

export function createVisionLiveTransport(
  options: VisionLiveTransportOptions,
): VisionLiveTransport {
  const store = options.store ?? createProcessLiveStore();
  const now = options.now ?? (() => new Date());
  const maxFallbackCalls =
    options.maxFallbackCallsPerRefresh ?? DEFAULT_MAX_FALLBACK_CALLS_PER_REFRESH;
  const fallbackGuard =
    options.fallbackGuard ??
    createDedicatedEventsFallbackGuard({
      cooldownMs: options.fallbackCooldownMs ?? DEFAULT_LIVE_FALLBACK_COOLDOWN_MS,
    });

  async function applyDedicatedEventsFallback(
    fixtures: LiveFixtureState[],
    fetchedAtUtc: string,
  ): Promise<LiveFixtureState[]> {
    let used = 0;
    const nowMs = Date.parse(fetchedAtUtc);
    const next: LiveFixtureState[] = [];
    for (const fixture of fixtures) {
      const previous = store.read(fixture.fixtureId);
      const decision = evaluateDedicatedEventsFallback({
        current: fixture,
        previous,
      });
      if (
        !decision.trigger ||
        used >= maxFallbackCalls ||
        !fallbackGuard.shouldAllow(fixture.fixtureId, nowMs)
      ) {
        next.push(fixture);
        continue;
      }
      const payload = await options.client.getEvents(
        String(fixture.fixtureId),
        { maxAttempts: LIVE_TRANSPORT_MAX_ATTEMPTS },
      );
      used += 1;
      fallbackGuard.mark(fixture.fixtureId, nowMs);
      next.push({
        ...fixture,
        nestedEventsAvailable: true,
        eventsSource: "DEDICATED_EVENTS_FALLBACK",
        events: (payload.response ?? []).map((event) => normalizeLiveEvent(event)),
      });
    }
    return next;
  }

  return {
    async heartbeatLiveLeagues(leagueIds) {
      const fetchedAtUtc = now().toISOString();
      const payload = await options.client.getLiveFixtures(leagueIds);
      const fixtures = (payload.response ?? []).map((item) =>
        normalizeLiveFixture(item, fetchedAtUtc),
      );
      store.writeMany(fixtures);
      store.dropTerminalAndNonLive();
      return toSnapshot(fixtures, fetchedAtUtc);
    },

    async snapshotTrackedFixtures(fixtureIds) {
      const fetchedAtUtc = now().toISOString();
      const payload = await options.client.getFixturesByIds(fixtureIds);
      const fixtures = (payload.response ?? []).map((item) =>
        normalizeLiveFixture(item, fetchedAtUtc),
      );
      const withFallback = await applyDedicatedEventsFallback(
        fixtures,
        fetchedAtUtc,
      );
      store.writeMany(withFallback);
      store.dropTerminalAndNonLive();
      return toSnapshot(withFallback, fetchedAtUtc);
    },

    getCurrentState() {
      const fixtures = store.readAll();
      const fetchedAtUtc =
        fixtures.reduce<string | null>((latest, fixture) => {
          if (!latest || fixture.fetchedAtUtc > latest) return fixture.fetchedAtUtc;
          return latest;
        }, null) ?? now().toISOString();
      return toSnapshot(fixtures, fetchedAtUtc);
    },

    getFixture(fixtureId) {
      return store.read(fixtureId);
    },
  };
}
