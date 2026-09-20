import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import type { ApiFootballEvent, ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import {
  classifyProviderEventClass,
  classifyLiveStatus,
  createProcessLiveStore,
  createVisionLiveTransport,
  evaluateDedicatedEventsFallback,
  isHalftimeStatus,
  isLiveStatus,
  isTerminalStatus,
  normalizeLiveEvent,
  normalizeLiveFixture,
  shouldKeepLiveTracking,
  type LiveFixtureState,
  type VisionLiveClient,
} from "@/lib/apex-vision/live";

const LIVE_DIR = dirname(fileURLToPath(import.meta.url));

function vendorEvent(overrides: Partial<ApiFootballEvent> = {}): ApiFootballEvent {
  return {
    time: { elapsed: 12, extra: null },
    team: { id: 100, name: "Ansan Greeners" },
    player: { id: 7, name: "A. Striker" },
    assist: { id: 8, name: "B. Assist" },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
    ...overrides,
  };
}

function vendorFixture(
  overrides: Partial<ApiFootballFixtureItem> & {
    events?: ApiFootballEvent[] | null;
  } = {},
): ApiFootballFixtureItem {
  const { events, ...rest } = overrides;
  return {
    fixture: {
      id: 1510455,
      date: "2026-09-20T07:00:00+00:00",
      status: { short: "1H", elapsed: 14 },
    },
    league: { id: 293, name: "K League 2", season: 2026 },
    teams: {
      home: { id: 100, name: "Ansan Greeners" },
      away: { id: 101, name: "Away FC" },
    },
    goals: { home: 1, away: 0 },
    events: events === undefined ? [] : events,
    ...rest,
  };
}

function asState(
  item: ApiFootballFixtureItem,
  fetchedAtUtc = "2026-09-20T07:14:00.000Z",
): LiveFixtureState {
  return normalizeLiveFixture(item, fetchedAtUtc);
}

describe("Vision live normalization", () => {
  it("7 score normalization preserves provider goals including 0", () => {
    const zero = asState(vendorFixture({ goals: { home: 0, away: 0 }, events: [] }));
    expect(zero.homeGoals).toBe(0);
    expect(zero.awayGoals).toBe(0);
    const scored = asState(vendorFixture({ goals: { home: 1, away: 2 } }));
    expect(scored.homeGoals).toBe(1);
    expect(scored.awayGoals).toBe(2);
  });

  it("8 status normalization preserves vendor short", () => {
    expect(asState(vendorFixture()).statusShort).toBe("1H");
  });

  it("9 elapsed normalization preserves 0 and elapsed minutes", () => {
    expect(asState(vendorFixture()).elapsed).toBe(14);
    const kickoff = asState(
      vendorFixture({
        fixture: {
          id: 1,
          date: "2026-09-20T07:00:00+00:00",
          status: { short: "1H", elapsed: 0 },
        },
      }),
    );
    expect(kickoff.elapsed).toBe(0);
  });

  it("10 Goal normalization keeps type/detail/player/assist", () => {
    const event = normalizeLiveEvent(vendorEvent());
    expect(event.eventClass).toBe("GOAL");
    expect(event.type).toBe("Goal");
    expect(event.detail).toBe("Normal Goal");
    expect(event.playerId).toBe(7);
    expect(event.playerName).toBe("A. Striker");
    expect(event.assistId).toBe(8);
    expect(event.assistName).toBe("B. Assist");
    expect(event.comments).toBeNull();
  });

  it("11 Card normalization", () => {
    const event = normalizeLiveEvent(
      vendorEvent({
        type: "Card",
        detail: "Yellow Card",
        assist: null,
      }),
    );
    expect(event.eventClass).toBe("CARD");
    expect(event.type).toBe("Card");
    expect(event.detail).toBe("Yellow Card");
  });

  it("12 substitution normalization", () => {
    const event = normalizeLiveEvent(
      vendorEvent({
        type: "subst",
        detail: "Substitution 1",
        assist: { id: 9, name: "Off Player" },
      }),
    );
    expect(event.eventClass).toBe("SUBSTITUTION");
    expect(event.type).toBe("subst");
  });

  it("13 VAR normalization", () => {
    const event = normalizeLiveEvent(
      vendorEvent({
        type: "Var",
        detail: "Goal cancelled",
        assist: null,
      }),
    );
    expect(event.eventClass).toBe("VAR");
    expect(event.type).toBe("Var");
  });

  it("14 unknown event remains OTHER and is never pase", () => {
    const event = normalizeLiveEvent(
      vendorEvent({
        type: "Corner",
        detail: "Corner Kick",
        assist: null,
      }),
    );
    expect(event.eventClass).toBe("OTHER");
    expect(event.type).toBe("Corner");
    expect(event.eventClass).not.toBe("pase");
    expect(classifyProviderEventClass("pass")).toBe("OTHER");
    expect(classifyProviderEventClass("pase")).toBe("OTHER");
  });

  it("15 zero events is valid", () => {
    const state = asState(vendorFixture({ goals: { home: 0, away: 0 }, events: [] }));
    expect(state.nestedEventsAvailable).toBe(true);
    expect(state.events).toEqual([]);
    expect(state.eventsSource).toBe("NESTED");
  });
});

describe("Vision live status helpers", () => {
  it("18 terminal status is recognized", () => {
    expect(isTerminalStatus("FT")).toBe(true);
    expect(isTerminalStatus("AET")).toBe(true);
    expect(isTerminalStatus("PEN")).toBe(true);
    expect(shouldKeepLiveTracking("FT")).toBe(false);
    expect(classifyLiveStatus("FT")).toBe("terminal");
  });

  it("19 HT is recognized and remains trackable", () => {
    expect(isHalftimeStatus("HT")).toBe(true);
    expect(isLiveStatus("HT")).toBe(false);
    expect(shouldKeepLiveTracking("HT")).toBe(true);
    expect(classifyLiveStatus("HT")).toBe("halftime");
  });

  it("20 postponed/cancelled/abandoned/suspended are not scheduled", () => {
    expect(classifyLiveStatus("PST")).toBe("postponed");
    expect(classifyLiveStatus("CANC")).toBe("cancelled");
    expect(classifyLiveStatus("ABD")).toBe("abandoned");
    expect(classifyLiveStatus("SUSP")).toBe("suspended");
    expect(shouldKeepLiveTracking("PST")).toBe(false);
    expect(shouldKeepLiveTracking("CANC")).toBe(false);
    expect(shouldKeepLiveTracking("ABD")).toBe(false);
    expect(shouldKeepLiveTracking("SUSP")).toBe(false);
    expect(classifyLiveStatus("NS")).toBe("scheduled");
    expect(isLiveStatus("1H")).toBe(true);
    expect(isLiveStatus("2H")).toBe(true);
    expect(isLiveStatus("ET")).toBe(true);
  });
});

describe("Vision live dedicated-events fallback policy", () => {
  it("16 score-change inconsistency can trigger fallback", () => {
    const previous = asState(vendorFixture({ goals: { home: 0, away: 0 }, events: [] }));
    const current = asState(vendorFixture({ goals: { home: 1, away: 0 }, events: [] }));
    expect(evaluateDedicatedEventsFallback({ current, previous })).toEqual({
      trigger: true,
      reason: "SCORE_CHANGED_WITHOUT_GOAL_EVENT",
    });
  });

  it("17 zero-event 0-0 does NOT automatically trigger fallback", () => {
    const current = asState(vendorFixture({ goals: { home: 0, away: 0 }, events: [] }));
    expect(evaluateDedicatedEventsFallback({ current, previous: null })).toEqual({
      trigger: false,
      reason: null,
    });
    expect(
      evaluateDedicatedEventsFallback({ current, previous: current }),
    ).toEqual({
      trigger: false,
      reason: null,
    });
  });

  it("missing nested events structure triggers fallback", () => {
    const current = asState(vendorFixture({ events: null }));
    expect(current.nestedEventsAvailable).toBe(false);
    expect(evaluateDedicatedEventsFallback({ current, previous: null })).toEqual({
      trigger: true,
      reason: "NESTED_EVENTS_UNAVAILABLE",
    });
  });

  it("previously known events disappearing triggers fallback", () => {
    const previous = asState(
      vendorFixture({
        events: [vendorEvent()],
      }),
    );
    const current = asState(vendorFixture({ events: [] }));
    expect(evaluateDedicatedEventsFallback({ current, previous })).toEqual({
      trigger: true,
      reason: "EVENTS_DISAPPEARED",
    });
  });
});

describe("Vision live transport service", () => {
  it("does not call dedicated events on a legitimate 0-0 empty history", async () => {
    const client: VisionLiveClient = {
      getLiveFixtures: vi.fn(),
      getFixturesByIds: vi.fn(async () => ({
        response: [vendorFixture({ goals: { home: 0, away: 0 }, events: [] })],
      })),
      getLiveEvents: vi.fn(),
    };
    const transport = createVisionLiveTransport({ client });
    await transport.snapshotTrackedFixtures([1510455]);
    expect(client.getLiveEvents).not.toHaveBeenCalled();
  });

  it("calls dedicated events at most once for score-without-goal, then respects cooldown", async () => {
    const client: VisionLiveClient = {
      getLiveFixtures: vi.fn(),
      getFixturesByIds: vi.fn(async () => ({
        response: [vendorFixture({ goals: { home: 1, away: 0 }, events: [] })],
      })),
      getLiveEvents: vi.fn(async () => ({
        response: [vendorEvent()],
      })),
    };
    const nowMs = Date.parse("2026-09-20T07:14:00.000Z");
    const transport = createVisionLiveTransport({
      client,
      now: () => new Date(nowMs),
      fallbackCooldownMs: 60_000,
    });
    const first = await transport.snapshotTrackedFixtures([1510455]);
    expect(client.getLiveEvents).toHaveBeenCalledTimes(1);
    expect(first.fixtures[0]?.eventsSource).toBe("DEDICATED_EVENTS_FALLBACK");
    expect(first.fixtures[0]?.events[0]?.eventClass).toBe("GOAL");

    await transport.snapshotTrackedFixtures([1510455]);
    expect(client.getLiveEvents).toHaveBeenCalledTimes(1);
    expect(client.getLiveEvents).toHaveBeenCalledWith("1510455");
  });

  it("heartbeat uses getLiveFixtures only and drops terminal fixtures from the store", async () => {
    const live = vendorFixture({
      fixture: {
        id: 11,
        date: "2026-09-20T07:00:00+00:00",
        status: { short: "1H", elapsed: 10 },
      },
      goals: { home: 0, away: 0 },
      events: [],
    });
    const finished = vendorFixture({
      fixture: {
        id: 22,
        date: "2026-09-20T05:00:00+00:00",
        status: { short: "FT", elapsed: 90 },
      },
      goals: { home: 2, away: 1 },
      events: [vendorEvent()],
    });
    const client: VisionLiveClient = {
      getLiveFixtures: vi.fn(async () => ({ response: [live, finished] })),
      getFixturesByIds: vi.fn(),
      getLiveEvents: vi.fn(),
    };
    const store = createProcessLiveStore();
    const transport = createVisionLiveTransport({ client, store });
    const snapshot = await transport.heartbeatLiveLeagues([293, 292]);
    expect(client.getLiveFixtures).toHaveBeenCalledWith([293, 292]);
    expect(client.getLiveEvents).not.toHaveBeenCalled();
    expect(snapshot.fixtures.map((row) => row.fixtureId)).toEqual([11, 22]);
    expect(transport.getFixture(11)?.statusShort).toBe("1H");
    expect(transport.getFixture(22)).toBeNull();
    expect(snapshot.source).toBe("API_FOOTBALL");
  });

  it("23 viewers do not appear on the live transport API", () => {
    const transport = createVisionLiveTransport({
      client: {
        getLiveFixtures: vi.fn(),
        getFixturesByIds: vi.fn(),
        getLiveEvents: vi.fn(),
      },
    });
    expect(transport.heartbeatLiveLeagues.length).toBe(1);
    expect(transport.snapshotTrackedFixtures.length).toBe(1);
    expect("viewerCount" in transport).toBe(false);
  });

  it("C dedicated Vision event fallback uses at most one HTTP attempt on failure", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/fixtures/events")) {
        return new Response(JSON.stringify({ message: "fail" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          response: [
            vendorFixture({ goals: { home: 1, away: 0 }, events: [] }),
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    const httpClient = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: true,
      config: { retryBaseDelayMs: 1 },
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });
    const transport = createVisionLiveTransport({ client: httpClient });
    await expect(transport.snapshotTrackedFixtures([1510455])).rejects.toMatchObject({
      status: 500,
    });
    const eventCalls = fetchImpl.mock.calls.filter((call) =>
      String((call as unknown[])[0]).includes("/fixtures/events"),
    );
    const idsCalls = fetchImpl.mock.calls.filter((call) =>
      String((call as unknown[])[0]).includes("ids="),
    );
    expect(idsCalls).toHaveLength(1);
    expect(eventCalls).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("Vision live isolation", () => {
  it("24 no calibration dependency", () => {
    const files = [
      "types.ts",
      "status.ts",
      "normalize.ts",
      "fallback.ts",
      "store.ts",
      "service.ts",
      "index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(LIVE_DIR, file), "utf8");
      expect(source).not.toMatch(/debug\/calibration/);
      expect(source).not.toMatch(/prospective/);
    }
  });

  it("25 no PE/model or auth dependency", () => {
    const files = [
      "types.ts",
      "status.ts",
      "normalize.ts",
      "fallback.ts",
      "store.ts",
      "service.ts",
      "index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(LIVE_DIR, file), "utf8");
      expect(source).not.toMatch(/intelligence\/modules\/probability/);
      expect(source).not.toMatch(/from-probability/);
      expect(source).not.toMatch(/lib\/auth/);
      expect(source).not.toMatch(/setInterval/);
      expect(source).not.toMatch(/return ["']pase["']/);
    }
  });

  it("F no polling/setInterval in live retry control", () => {
    const clientSource = readFileSync(
      join(LIVE_DIR, "../../data-platform/providers/api-football/client.ts"),
      "utf8",
    );
    const querySource = readFileSync(
      join(LIVE_DIR, "../../data-platform/providers/api-football/live-query.ts"),
      "utf8",
    );
    expect(clientSource).not.toMatch(/setInterval/);
    expect(querySource).not.toMatch(/setInterval/);
    expect(querySource).toMatch(/LIVE_TRANSPORT_MAX_ATTEMPTS = 1/);
  });
});
