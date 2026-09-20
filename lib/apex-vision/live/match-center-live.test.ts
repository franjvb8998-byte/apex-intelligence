import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/match-center/live/[fixtureId]/route";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";
import { liveEventsCacheKey } from "@/lib/data-platform/providers/api-football/live-query";
import {
  API_FOOTBALL_CACHE_TTL_MS,
  ttlForCacheKey,
} from "@/lib/data-platform/providers/api-football/cache-policy";
import {
  classifyLiveFreshness,
  createProcessLiveStore,
  createVisionLiveCoordinator,
  createVisionLiveTransport,
  HT_REFRESH_INTERVAL_MS,
  LIVE_FRESHNESS_WINDOW_MS,
  LIVE_REFRESH_INTERVAL_MS,
  isOrdinaryScheduledStatus,
  liveStatusCopyKey,
  matchCenterLiveApiHref,
  matchCenterLivePollIntervalMs,
  parseTrackedFixtureId,
  getVisionLiveCoordinator,
  peekVisionLiveFixture,
  resetVisionLiveCoordinatorForTests,
  setVisionLiveCoordinatorForTests,
  shouldKeepLiveTracking,
  shouldStartMatchCenterLivePoll,
  toMatchCenterLiveView,
  type LiveFixtureState,
  type VisionLiveClient,
  type VisionLiveCoordinator,
} from "@/lib/apex-vision/live";
import { classifyProviderEventClass, normalizeLiveEvent } from "@/lib/apex-vision/live/normalize";
import { DEFAULT_MAX_FALLBACK_CALLS_PER_REFRESH } from "@/lib/apex-vision/live/service";
import type { ApiFootballEvent } from "@/lib/data-platform/providers/api-football/types";
import { readFileSync } from "node:fs";
import path from "node:path";

afterEach(() => {
  resetApiFootballSingleFlightForTests();
  resetVisionLiveCoordinatorForTests();
});

function vendorEvent(overrides: Partial<ApiFootballEvent> = {}): ApiFootballEvent {
  return {
    time: { elapsed: 12, extra: null },
    team: { id: 100, name: "Home FC" },
    player: { id: 7, name: "A. Striker" },
    assist: { id: 8, name: "B. Assist" },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
    ...overrides,
  };
}

function liveState(
  overrides: Partial<LiveFixtureState> = {},
): LiveFixtureState {
  return {
    fixtureId: 1510455,
    leagueId: 293,
    leagueName: "K League 2",
    season: 2026,
    homeTeamId: 100,
    homeTeamName: "Home FC",
    awayTeamId: 101,
    awayTeamName: "Away FC",
    homeGoals: 1,
    awayGoals: 0,
    statusShort: "1H",
    elapsed: 14,
    kickoffUtc: "2026-09-20T07:00:00.000Z",
    fetchedAtUtc: "2026-09-20T07:14:00.000Z",
    source: "API_FOOTBALL",
    nestedEventsAvailable: true,
    eventsSource: "NESTED",
    events: [normalizeLiveEvent(vendorEvent())],
    ...overrides,
  };
}

function mockClient(
  overrides: Partial<VisionLiveClient> = {},
): VisionLiveClient {
  return {
    getLiveFixtures: vi.fn(),
    getFixturesByIds: vi.fn(async () => ({
      response: [
        {
          fixture: {
            id: 1510455,
            date: "2026-09-20T07:00:00+00:00",
            status: { short: "1H" as const, elapsed: 14 },
          },
          league: { id: 293, name: "K League 2", season: 2026 },
          teams: {
            home: { id: 100, name: "Home FC" },
            away: { id: 101, name: "Away FC" },
          },
          goals: { home: 1, away: 0 },
          events: [vendorEvent()],
        },
      ],
    })),
    getLiveEvents: vi.fn(),
    ...overrides,
  };
}

describe("Vision live coordinator + Match Center view", () => {
  it("getVisionLiveCoordinator exposes zero-call peekFixture", () => {
    resetVisionLiveCoordinatorForTests();
    const coordinator = getVisionLiveCoordinator();
    expect(typeof coordinator.peekFixture).toBe("function");
    expect(coordinator.peekFixture(1507073)).toBeNull();
    expect(peekVisionLiveFixture(1507073)).toBeNull();
  });

  it("upgrades a refreshFixture-only singleton before peek", () => {
    setVisionLiveCoordinatorForTests({
      refreshFixture: vi.fn(),
    } as unknown as VisionLiveCoordinator);
    expect(typeof getVisionLiveCoordinator().peekFixture).toBe("function");
    expect(peekVisionLiveFixture(1507073)).toBeNull();
  });

  it("peekFixture reads store without provider calls", async () => {
    const client = mockClient();
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client }),
      now: () => new Date("2026-09-20T07:14:00.000Z"),
    });
    expect(coordinator.peekFixture(1510455)).toBeNull();
    expect(client.getFixturesByIds).not.toHaveBeenCalled();
    await coordinator.refreshFixture(1510455);
    expect(coordinator.peekFixture(1510455)?.statusShort).toBe("1H");
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    coordinator.peekFixture(1510455);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
  });

  it("1 concurrent refresh requests deduplicate provider work", async () => {
    const client = mockClient();
    const transport = createVisionLiveTransport({ client });
    const coordinator = createVisionLiveCoordinator({
      transport,
      now: () => new Date("2026-09-20T07:14:00.000Z"),
    });
    const [a, b] = await Promise.all([
      coordinator.refreshFixture(1510455),
      coordinator.refreshFixture(1510455),
    ]);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    expect(a.homeGoals).toBe(1);
    expect(b.homeGoals).toBe(1);
    expect(a.refresh.httpOrigin).toBe("PROVIDER_REFRESH");
  });

  it("httpOrigin is coordinator-layer inference, not wire-level HTTP", async () => {
    const client = mockClient();
    const now = () => new Date("2026-09-20T07:14:00.000Z");
    const cached = new Set<number>();
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now }),
      now,
      hasLiveHttpCache: (id) => cached.has(id),
    });
    const origin = await coordinator.refreshFixture(1510455);
    expect(origin.refresh.httpOrigin).toBe("PROVIDER_REFRESH");
    cached.add(1510455);
    const store = await coordinator.refreshFixture(1510455);
    expect(store.refresh.httpOrigin).toBe("VISION_STORE_CACHE");
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);

    const later = () => new Date("2026-09-20T07:16:00.000Z");
    const afterTtl = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now: later }),
      now: later,
      hasLiveHttpCache: (id) => cached.has(id),
    });
    const liveCache = await afterTtl.refreshFixture(1510455);
    expect(liveCache.refresh.refreshSource).toBe("PROVIDER");
    expect(liveCache.refresh.httpOrigin).toBe("LIVE_CACHE_REUSE");
  });

  it("40 many viewers do not multiply provider calls within the window", async () => {
    const client = mockClient();
    let nowMs = Date.parse("2026-09-20T07:14:00.000Z");
    const now = () => new Date(nowMs);
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now }),
      now,
    });
    await coordinator.refreshFixture(1510455);
    await coordinator.refreshFixture(1510455);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    nowMs += LIVE_REFRESH_INTERVAL_MS + 1;
    await coordinator.refreshFixture(1510455);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(2);
  });

  it("9 10 concurrent same-fixture refreshes share one provider snapshot", async () => {
    const client = mockClient();
    const now = () => new Date("2026-09-20T07:14:00.000Z");
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now }),
      now,
    });
    const views = await Promise.all(
      Array.from({ length: 10 }, () => coordinator.refreshFixture(1510455)),
    );
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    expect(client.getLiveFixtures).not.toHaveBeenCalled();
    expect(new Set(views.map((row) => row.homeGoals))).toEqual(new Set([1]));
  });

  it("10 100 concurrent same-fixture refreshes share one provider snapshot", async () => {
    const client = mockClient();
    const now = () => new Date("2026-09-20T07:14:00.000Z");
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now }),
      now,
    });
    await Promise.all(
      Array.from({ length: 100 }, () => coordinator.refreshFixture(1510455)),
    );
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
  });

  it("11 different fixture IDs remain independent", async () => {
    const getFixturesByIds = vi.fn(async (ids: Array<string | number>) => ({
      response: [
        {
          fixture: {
            id: Number(ids[0]),
            date: "2026-09-20T07:00:00+00:00",
            status: { short: "1H" as const, elapsed: 14 },
          },
          league: { id: 293, name: "K League 2", season: 2026 },
          teams: {
            home: { id: 100, name: "Home FC" },
            away: { id: 101, name: "Away FC" },
          },
          goals: { home: Number(ids[0]) === 11 ? 1 : 0, away: Number(ids[0]) === 11 ? 0 : 1 },
          events: [
            vendorEvent({
              team: {
                id: Number(ids[0]) === 11 ? 100 : 101,
                name: Number(ids[0]) === 11 ? "Home FC" : "Away FC",
              },
            }),
          ],
        },
      ],
    }));
    const client = mockClient({ getFixturesByIds });
    const now = () => new Date("2026-09-20T07:14:00.000Z");
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client, now }),
      now,
    });
    const [a, b] = await Promise.all([
      coordinator.refreshFixture(11),
      coordinator.refreshFixture(22),
    ]);
    expect(getFixturesByIds).toHaveBeenCalledTimes(2);
    expect(a.fixtureId).toBe(11);
    expect(b.fixtureId).toBe(22);
    expect(a.homeGoals).toBe(1);
    expect(b.awayGoals).toBe(1);
    expect(a.homeGoals).not.toBe(b.homeGoals);
  });

  it("4-7 live fixture returns score, elapsed, status, fetchedAt", async () => {
    const view = toMatchCenterLiveView({
      state: liveState(),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.homeGoals).toBe(1);
    expect(view.awayGoals).toBe(0);
    expect(view.elapsed).toBe(14);
    expect(view.statusShort).toBe("1H");
    expect(view.fetchedAtUtc).toBe("2026-09-20T07:14:00.000Z");
  });

  it("8 LIVE freshness classification", () => {
    expect(
      classifyLiveFreshness({
        fetchedAtUtc: "2026-09-20T07:14:00.000Z",
        nowMs: Date.parse("2026-09-20T07:14:00.000Z") + 30_000,
      }),
    ).toBe("LIVE");
  });

  it("9 STALE classification", () => {
    expect(
      classifyLiveFreshness({
        fetchedAtUtc: "2026-09-20T07:14:00.000Z",
        nowMs: Date.parse("2026-09-20T07:14:00.000Z") + LIVE_FRESHNESS_WINDOW_MS + 1,
      }),
    ).toBe("STALE");
  });

  it("10 UNAVAILABLE classification", () => {
    expect(classifyLiveFreshness({ fetchedAtUtc: null, nowMs: 1 })).toBe(
      "UNAVAILABLE",
    );
  });

  it("11 terminal fixture stops refresh behavior", () => {
    const view = toMatchCenterLiveView({
      state: liveState({ statusShort: "FT", elapsed: 90 }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.refresh.shouldPoll).toBe(false);
    expect(shouldKeepLiveTracking("FT")).toBe(false);
  });

  it("12 HT remains trackable", () => {
    const view = toMatchCenterLiveView({
      state: liveState({ statusShort: "HT", elapsed: 45 }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "CACHE",
      refreshPerformed: false,
      cacheHit: true,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.refresh.shouldPoll).toBe(true);
    expect(view.refresh.intervalMs).toBe(HT_REFRESH_INTERVAL_MS);
    expect(view.statusKind).toBe("halftime");
  });

  it("13-16 PST/CANC/ABD/SUSP are honest and not scheduled", () => {
    const nowMs = Date.parse("2026-09-20T07:14:10.000Z");
    const asView = (statusShort: string) =>
      toMatchCenterLiveView({
        state: liveState({ statusShort }),
        nowMs,
        refreshSource: "PROVIDER",
        refreshPerformed: true,
        cacheHit: false,
        lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
      });
    const pst = asView("PST");
    const canc = asView("CANC");
    const abd = asView("ABD");
    const susp = asView("SUSP");
    expect(pst.statusKind).toBe("postponed");
    expect(pst.statusCopyKey).toBe("statusPST");
    expect(canc.statusKind).toBe("cancelled");
    expect(canc.statusCopyKey).toBe("statusCANC");
    expect(abd.statusKind).toBe("abandoned");
    expect(abd.statusCopyKey).toBe("statusABD");
    expect(susp.statusKind).toBe("suspended");
    expect(susp.statusCopyKey).toBe("statusSUSP");
    for (const view of [pst, canc, abd, susp]) {
      expect(view.statusKind).not.toBe("scheduled");
      expect(view.refresh.shouldPoll).toBe(false);
    }
  });

  it("17-23 Goal/Card/Sub/VAR/OTHER timeline; unknown never pase", () => {
    const events = [
      normalizeLiveEvent(vendorEvent()),
      normalizeLiveEvent(vendorEvent({ type: "Card", detail: "Yellow Card", assist: null })),
      normalizeLiveEvent(vendorEvent({ type: "Card", detail: "Red Card", assist: null, player: { id: 9, name: "C. Back" } })),
      normalizeLiveEvent(vendorEvent({ type: "subst", detail: "Substitution 1" })),
      normalizeLiveEvent(vendorEvent({ type: "Var", detail: "Goal cancelled", assist: null })),
      normalizeLiveEvent(vendorEvent({ type: "Corner", detail: "Corner Kick", player: { id: null, name: null }, assist: null })),
    ];
    const view = toMatchCenterLiveView({
      state: liveState({ events }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.events.map((e) => e.eventClass)).toEqual([
      "GOAL",
      "CARD",
      "CARD",
      "SUBSTITUTION",
      "VAR",
      "OTHER",
    ]);
    expect(view.events[1]?.detail).toBe("Yellow Card");
    expect(view.events[2]?.detail).toBe("Red Card");
    expect(JSON.stringify(view.events)).not.toContain("pase");
  });

  it("24 missing player is not invented", () => {
    const view = toMatchCenterLiveView({
      state: liveState({
        events: [
          normalizeLiveEvent(
            vendorEvent({ player: { id: null, name: null }, assist: null }),
          ),
        ],
      }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.events[0]?.playerName).toBeNull();
    expect(view.events[0]?.playerId).toBeNull();
  });

  it("26-28 prematch + schematic flags", () => {
    const view = toMatchCenterLiveView({
      state: liveState(),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.marketsOrigin).toBe("PREMATCH");
    expect(view.heuristicOrigin).toBe("APEX_HEURISTIC");
    expect(view.tracking.exactBallTracking).toBe(false);
    expect(view.tracking.exactPlayerTracking).toBe(false);
    expect(view.tracking.schematic).toBe(true);
  });

  it("31 live events fallback uses af:live:events not af:events", () => {
    expect(liveEventsCacheKey(1510455)).toBe("af:live:events:1510455");
    expect(ttlForCacheKey("af:live:events:1510455")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.live,
    );
    expect(ttlForCacheKey("af:events:1510455")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.match,
    );
  });

  it("33 zero-event 0-0 does not trigger fallback", async () => {
    const client = mockClient({
      getFixturesByIds: vi.fn(async () => ({
        response: [
          {
            fixture: {
              id: 1510455,
              date: "2026-09-20T07:00:00+00:00",
              status: { short: "1H" as const, elapsed: 14 },
            },
            league: { id: 293, name: "K League 2", season: 2026 },
            teams: {
              home: { id: 100, name: "Home FC" },
              away: { id: 101, name: "Away FC" },
            },
            goals: { home: 0, away: 0 },
            events: [],
          },
        ],
      })),
      getLiveEvents: vi.fn(),
    });
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({ client }),
    });
    await coordinator.refreshFixture(1510455);
    expect(client.getLiveEvents).not.toHaveBeenCalled();
  });

  it("34-38 coordinator client has no odds/H2H/standings/injuries/enrich", () => {
    const client = mockClient();
    expect("getFixtureOdds" in client).toBe(false);
    expect("getHeadToHead" in client).toBe(false);
    expect("getStandings" in client).toBe(false);
    expect("getInjuries" in client).toBe(false);
    expect("getTeamStatistics" in client).toBe(false);
  });

  it("39 browser refresh hits APEX not API-Football", () => {
    const href = matchCenterLiveApiHref(1510455);
    expect(href).toBe("/api/match-center/live/1510455");
    expect(href).not.toContain("api-sports");
    expect(href).not.toContain("api-football");
  });

  it("3 invalid fixture ID rejected", () => {
    expect(parseTrackedFixtureId("")).toBeNull();
    expect(parseTrackedFixtureId("abc")).toBeNull();
    expect(parseTrackedFixtureId("0")).toBeNull();
    expect(parseTrackedFixtureId("-1")).toBeNull();
    expect(parseTrackedFixtureId("1510455")).toBe(1510455);
  });
});

describe("Match Center live API route", () => {
  it("2/3 invalid id is 400 and body has no credentials", async () => {
    const response = await GET(new Request("http://localhost/api/match-center/live/nope"), {
      params: Promise.resolve({ fixtureId: "nope" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/x-apisports-key/i);
    expect(JSON.stringify(body)).not.toMatch(/API_FOOTBALL_KEY/);
    expect(body.ok).toBe(false);
    expect(body.meta.provider).toBe("apex-vision-live");
    expect(body.meta.provider).not.toBe("api-football");
  });

  it("returns coordinator view without provider secrets", async () => {
    const client = mockClient();
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({
        client,
        store: createProcessLiveStore(),
      }),
      now: () => new Date("2026-09-20T07:14:00.000Z"),
    });
    setVisionLiveCoordinatorForTests(coordinator);
    const response = await GET(
      new Request("http://localhost/api/match-center/live/1510455"),
      { params: Promise.resolve({ fixtureId: "1510455" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.homeGoals).toBe(1);
    expect(body.data.elapsed).toBe(14);
    expect(body.data.statusShort).toBe("1H");
    expect(body.meta.provider).toBe("apex-vision-live");
    expect(JSON.stringify(body)).not.toMatch(/x-apisports-key/i);
    expect(JSON.stringify(body)).not.toMatch(/API_FOOTBALL_KEY/);
  });

  it("ignores extra query batching and still refreshes only the path id", async () => {
    const client = mockClient();
    const coordinator = createVisionLiveCoordinator({
      transport: createVisionLiveTransport({
        client,
        store: createProcessLiveStore(),
      }),
    });
    setVisionLiveCoordinatorForTests(coordinator);
    const response = await GET(
      new Request(
        "http://localhost/api/match-center/live/1510455?ids=1-2-3&live=292-293",
      ),
      { params: Promise.resolve({ fixtureId: "1510455" }) },
    );
    expect(response.status).toBe(200);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    expect(client.getFixturesByIds).toHaveBeenCalledWith([1510455]);
    expect(client.getLiveFixtures).not.toHaveBeenCalled();
  });
});

describe("Match Center live poll policy", () => {
  it("11 terminal fixture does not start browser poll", () => {
    const view = toMatchCenterLiveView({
      state: liveState({ statusShort: "FT", elapsed: 90 }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(
      shouldStartMatchCenterLivePoll({
        isMock: false,
        fixtureId: 1510455,
        catalogueLive: false,
        providerLive: view,
      }),
    ).toBe(false);
  });

  it("12 HT poll interval is slower but still trackable", () => {
    const view = toMatchCenterLiveView({
      state: liveState({ statusShort: "HT", elapsed: 45 }),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "CACHE",
      refreshPerformed: false,
      cacheHit: true,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(
      shouldStartMatchCenterLivePoll({
        isMock: false,
        fixtureId: 1510455,
        catalogueLive: true,
        providerLive: view,
      }),
    ).toBe(true);
    expect(matchCenterLivePollIntervalMs(view)).toBe(HT_REFRESH_INTERVAL_MS);
    expect(matchCenterLivePollIntervalMs(view)).toBeGreaterThanOrEqual(
      LIVE_REFRESH_INTERVAL_MS,
    );
  });

  it("catalogue-live UNAVAILABLE keeps polling; mock never polls APEX", () => {
    expect(
      shouldStartMatchCenterLivePoll({
        isMock: false,
        fixtureId: 1510455,
        catalogueLive: true,
        providerLive: null,
      }),
    ).toBe(true);
    expect(
      shouldStartMatchCenterLivePoll({
        isMock: true,
        fixtureId: 1510455,
        catalogueLive: true,
        providerLive: null,
      }),
    ).toBe(false);
  });
});

describe("Phase 2A.2 honesty + isolation", () => {
  it("23 unknown event class is OTHER and never pase", () => {
    expect(classifyProviderEventClass("Corner")).toBe("OTHER");
    expect(classifyProviderEventClass("pase")).toBe("OTHER");
    expect(classifyProviderEventClass("unknown-xyz")).toBe("OTHER");
  });

  it("26-27 prematch origin is labeled and live view does not carry PE values", () => {
    const view = toMatchCenterLiveView({
      state: liveState(),
      nowMs: Date.parse("2026-09-20T07:14:10.000Z"),
      refreshSource: "PROVIDER",
      refreshPerformed: true,
      cacheHit: false,
      lastProviderRefreshAt: "2026-09-20T07:14:00.000Z",
    });
    expect(view.marketsOrigin).toBe("PREMATCH");
    expect(view).not.toHaveProperty("homeWin");
    expect(view).not.toHaveProperty("over25");
    expect(view).not.toHaveProperty("btts");
  });

  it("32 fallback bound remains one dedicated events call per refresh", () => {
    expect(DEFAULT_MAX_FALLBACK_CALLS_PER_REFRESH).toBe(1);
  });

  it("41-42 live coordinator has no calibration or PE imports", () => {
    const coordinatorSrc = readFileSync(
      path.join(process.cwd(), "lib/apex-vision/live/coordinator.ts"),
      "utf8",
    );
    const viewSrc = readFileSync(
      path.join(process.cwd(), "lib/apex-vision/live/view.ts"),
      "utf8",
    );
    const routeSrc = readFileSync(
      path.join(process.cwd(), "app/api/match-center/live/[fixtureId]/route.ts"),
      "utf8",
    );
    for (const src of [coordinatorSrc, viewSrc, routeSrc]) {
      expect(src).not.toMatch(/lib\/debug\/calibration/);
      expect(src).not.toMatch(/createEloPoissonHybridEngine/);
      expect(src).not.toMatch(/ProbabilityEngine/);
    }
  });

  it("29/39/55 live Match Center does not use Math.random or API-Football URLs", () => {
    const livePhase = readFileSync(
      path.join(process.cwd(), "components/match-center/live-phase.tsx"),
      "utf8",
    );
    const timeline = readFileSync(
      path.join(process.cwd(), "components/match-center/provider-live-timeline.tsx"),
      "utf8",
    );
    expect(livePhase).toContain("matchCenterLiveApiHref");
    expect(livePhase).toContain("schematic={!isMock}");
    expect(livePhase).not.toContain("api-sports.io");
    expect(livePhase).toContain("simulateVisionTick");
    expect(livePhase).toContain("if (!isMock) return");
    expect(livePhase).toContain("inFlight");
    expect(livePhase).toContain("window.clearInterval(timer)");
    expect(livePhase).not.toContain("API_FOOTBALL_KEY");
    expect(livePhase).not.toContain("x-apisports-key");
    expect(livePhase).not.toContain("v3.football.api-sports.io");
    expect(timeline).not.toContain("pase");
    expect(timeline).not.toContain("Math.random");
  });

  it("explicit 1H/2H copy keys stay distinct", () => {
    expect(liveStatusCopyKey("1H")).toBe("status1H");
    expect(liveStatusCopyKey("2H")).toBe("status2H");
    expect(liveStatusCopyKey("HT")).toBe("statusHT");
    expect(isOrdinaryScheduledStatus("NS")).toBe(true);
    expect(isOrdinaryScheduledStatus("PST")).toBe(false);
    expect(isOrdinaryScheduledStatus("CANC")).toBe(false);
    expect(isOrdinaryScheduledStatus("ABD")).toBe(false);
    expect(isOrdinaryScheduledStatus("SUSP")).toBe(false);
  });
});
