import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVisionLiveCoordinator,
  createVisionLiveTransport,
  getVisionLiveCoordinator,
  peekVisionLiveFixture,
  resetVisionLiveCoordinatorForTests,
  setVisionLiveCoordinatorForTests,
  type VisionLiveClient,
  type VisionLiveCoordinator,
} from "@/lib/apex-vision/live";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform/providers/api-football/fixtures";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";
import type {
  ApiFootballEvent,
  ApiFootballFixtureItem,
  ApiFootballStatusShort,
} from "@/lib/data-platform/providers/api-football/types";
import * as probability from "@/lib/intelligence/modules/probability";
import { getMatchCenterData } from "@/lib/match-center/load";
import { apiFootballPlayerRenderKey } from "@/lib/match-center/player-render-key";
import { lineupsFromVendor } from "@/lib/match-center/team-context";

afterEach(() => {
  resetVisionLiveCoordinatorForTests();
  resetApiFootballSingleFlightForTests();
  resetApiFootballQuotaCircuitForTests();
  vi.restoreAllMocks();
});

const HEAVY_METHODS = [
  "getFixtureOdds",
  "getInjuries",
  "getHeadToHead",
  "getStandings",
  "getTeamLastFixtures",
  "getTeamStatistics",
  "getEvents",
  "getLineups",
  "getFixtureStatistics",
] as const;

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

function cloneLiveItem(id: number, short: ApiFootballStatusShort): ApiFootballFixtureItem {
  const base = createRecordedApiFootballFixturesResponse().response[0]!;
  return {
    ...base,
    fixture: {
      ...base.fixture,
      id,
      status: { long: String(short), short, elapsed: short === "NS" ? null : 38 },
    },
    teams: {
      home: { id: 100, name: "Home FC" },
      away: { id: 101, name: "Away FC" },
    },
    goals: { home: 0, away: 1 },
    events: [vendorEvent()],
  };
}

function withCallLog(
  inner: ApiFootballClient,
  calls: string[],
  overrides: Partial<ApiFootballClient> = {},
): ApiFootballClient {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop in overrides) {
        const value = overrides[prop as keyof ApiFootballClient];
        if (typeof value === "function") {
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...params: unknown[]) => unknown)(...args);
          };
        }
        return value;
      }
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          calls.push(String(prop));
          return (value as (...params: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as ApiFootballClient;
}

function countingProvider(options: {
  items: ApiFootballFixtureItem[];
  calls: string[];
  enrichMatch?: boolean;
}): ApiFootballDataProvider {
  const inner = createFixtureApiFootballClient();
  const byId = new Map(options.items.map((item) => [String(item.fixture.id), item]));
  const client = withCallLog(inner, options.calls, {
    getFixture: async (id) => {
      const item = byId.get(String(id));
      if (item) {
        return {
          ...createRecordedApiFootballFixturesResponse(),
          results: 1,
          response: [item],
        };
      }
      return inner.getFixture(id);
    },
    getFixtureOdds: async () => createRecordedApiFootballOddsResponse(),
  });
  return new ApiFootballDataProvider({
    client,
    enrichMatch: options.enrichMatch ?? false,
    useCache: false,
  });
}

function mockVisionClient(item: ApiFootballFixtureItem): VisionLiveClient {
  return {
    getLiveFixtures: vi.fn(),
    getFixturesByIds: vi.fn(async () => ({
      response: [item],
    })),
    getLiveEvents: vi.fn(),
  };
}

function installCoordinator(item: ApiFootballFixtureItem) {
  const client = mockVisionClient(item);
  const now = () => new Date("2026-09-20T07:14:00.000Z");
  const coordinator = createVisionLiveCoordinator({
    transport: createVisionLiveTransport({ client, now }),
    now,
  });
  setVisionLiveCoordinatorForTests(coordinator);
  return { client, coordinator };
}

describe("getVisionLiveCoordinator peek contract", () => {
  it("exposes peekFixture on the production getter; empty store is null and does not throw", () => {
    resetVisionLiveCoordinatorForTests();
    const coordinator = getVisionLiveCoordinator();
    expect(typeof coordinator.peekFixture).toBe("function");
    expect(coordinator.peekFixture(1507073)).toBeNull();
    expect(peekVisionLiveFixture(1507073)).toBeNull();
  });

  it("peekFixture does not invoke the Vision provider client", async () => {
    const { client, coordinator } = installCoordinator(cloneLiveItem(1507073, "1H"));
    expect(coordinator.peekFixture(1507073)).toBeNull();
    expect(client.getFixturesByIds).not.toHaveBeenCalled();
    expect(client.getLiveEvents).not.toHaveBeenCalled();
    expect(client.getLiveFixtures).not.toHaveBeenCalled();
  });

  it("replaces a 2A.2 refreshFixture-only singleton before Match Center peeks", async () => {
    setVisionLiveCoordinatorForTests({
      refreshFixture: vi.fn(),
    } as unknown as VisionLiveCoordinator);
    const coordinator = getVisionLiveCoordinator();
    expect(typeof coordinator.peekFixture).toBe("function");
    expect(coordinator.peekFixture(1507073)).toBeNull();

    const item = cloneLiveItem(1507073, "NS");
    const calls: string[] = [];
    const data = await getMatchCenterData({
      provider: countingProvider({ items: [item], calls, enrichMatch: true }),
      externalMatchId: "1507073",
      includeFixtureList: false,
      includeLiveRefresh: true,
      env: {},
    });
    expect(data.liveLite).toBeFalsy();
    expect(data.live.loadMode).toBe("rich");
  });
});

describe("Match Center Live Lite budget isolation", () => {
  const liveItem = cloneLiveItem(1637637, "1H");
  const scheduledItem = cloneLiveItem(8005, "NS");

  it("selects Live Lite and does not invoke enrichment / odds / events / lineups / stats", async () => {
    const predict = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const calls: string[] = [];
    const { client } = installCoordinator(liveItem);
    const data = await getMatchCenterData({
      provider: countingProvider({ items: [liveItem], calls, enrichMatch: false }),
      externalMatchId: "1637637",
      includeFixtureList: false,
      includeLiveRefresh: true,
      env: {},
    });

    expect(data.liveLite).toBe(true);
    expect(data.live.loadMode).toBe("live-lite");
    expect(data.match.status).toBe("live");
    expect(data.live.providerLive?.homeGoals).toBe(0);
    expect(data.live.providerLive?.awayGoals).toBe(1);
    expect(data.live.providerLive?.elapsed).toBe(38);
    expect(data.live.providerLive?.statusShort).toBe("1H");
    expect(data.live.providerLive?.events.map((event) => event.eventClass)).toEqual([
      "GOAL",
    ]);
    expect(data.preview.probabilitiesAvailable).toBe(false);
    expect(data.post.evaluationAvailable).toBe(false);
    expect(data.aiAnalysis.source.probabilityEngine).toBe(false);
    expect(data.preview.dashboard.odds).toEqual([]);
    expect(data.preview.dashboard.h2h).toEqual([]);
    expect(data.preview.dashboard.injuries).toEqual([]);
    expect(data.preview.dashboard.standings.home).toBeNull();
    expect(data.live.lineups.home).toBeNull();
    expect(calls.filter((name) => name === "getFixture")).toHaveLength(1);
    for (const method of HEAVY_METHODS) {
      expect(calls.filter((name) => name === method)).toEqual([]);
    }
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    expect(client.getLiveEvents).not.toHaveBeenCalled();
    expect(predict).not.toHaveBeenCalled();
  });

  it("Vision store hit skips identity getById and does not multiply provider work", async () => {
    const calls: string[] = [];
    const { client, coordinator } = installCoordinator(liveItem);
    await coordinator.refreshFixture(1637637);
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);

    const data = await getMatchCenterData({
      provider: countingProvider({ items: [liveItem], calls, enrichMatch: false }),
      externalMatchId: "1637637",
      includeFixtureList: false,
      includeLiveRefresh: true,
      env: {},
    });
    expect(data.liveLite).toBe(true);
    expect(data.live.providerLive?.statusShort).toBe("1H");
    expect(calls.filter((name) => name === "getFixture")).toEqual([]);
    expect(calls).toEqual([]);
    for (const method of HEAVY_METHODS) {
      expect(calls.filter((name) => name === method)).toEqual([]);
    }
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);

    await Promise.all(
      Array.from({ length: 10 }, () =>
        getMatchCenterData({
          provider: countingProvider({ items: [liveItem], calls, enrichMatch: false }),
          externalMatchId: "1637637",
          includeFixtureList: false,
          includeLiveRefresh: true,
          env: {},
        }),
      ),
    );
    expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it.each([
    ["NS", "scheduled"],
    ["TBD", "scheduled"],
    ["PST", "postponed"],
    ["CANC", "cancelled"],
    ["ABD", "cancelled"],
    ["SUSP", "suspended"],
  ] as const)(
    "includeLiveRefresh=%s stays off Live Lite (status %s)",
    async (short, expectedStatus) => {
      const item = cloneLiveItem(9000, short);
      const calls: string[] = [];
      const { client } = installCoordinator(item);
      const data = await getMatchCenterData({
        provider: countingProvider({
          items: [item],
          calls,
          enrichMatch: true,
        }),
        externalMatchId: "9000",
        includeFixtureList: false,
        includeLiveRefresh: true,
        env: {},
      });
      expect(data.liveLite).toBeFalsy();
      expect(data.live.loadMode).toBe("rich");
      expect(data.match.status).toBe(expectedStatus);
      expect(client.getFixturesByIds).not.toHaveBeenCalled();
      expect(client.getLiveEvents).not.toHaveBeenCalled();
    },
  );

  it.each(["1H", "HT", "2H", "ET"] as const)(
    "%s with includeLiveRefresh selects Live Lite",
    async (short) => {
      const item = cloneLiveItem(1637637, short);
      const calls: string[] = [];
      const { client } = installCoordinator(item);
      const data = await getMatchCenterData({
        provider: countingProvider({ items: [item], calls, enrichMatch: false }),
        externalMatchId: "1637637",
        includeFixtureList: false,
        includeLiveRefresh: true,
        env: {},
      });
      expect(data.liveLite).toBe(true);
      expect(data.live.loadMode).toBe("live-lite");
      expect(data.match.status).toBe("live");
      expect(data.live.providerLive?.statusShort).toBe(short);
      expect(client.getFixturesByIds).toHaveBeenCalledTimes(1);
      for (const method of HEAVY_METHODS) {
        expect(calls.filter((name) => name === method)).toEqual([]);
      }
    },
  );

  it("prematch/non-live Match Center keeps the rich enrichment path", async () => {
    const predict = vi.spyOn(probability, "createEloPoissonHybridEngine");
    const calls: string[] = [];
    const { client } = installCoordinator(scheduledItem);
    const data = await getMatchCenterData({
      provider: countingProvider({
        items: [scheduledItem],
        calls,
        enrichMatch: true,
      }),
      externalMatchId: "8005",
      includeFixtureList: false,
      includeLiveRefresh: true,
      env: {},
    });
    expect(data.liveLite).toBeFalsy();
    expect(data.live.loadMode).toBe("rich");
    expect(data.match.status).toBe("scheduled");
    expect(data.preview.probabilitiesAvailable).not.toBe(false);
    expect(data.post.evaluationAvailable).toBe(false);
    expect(predict).toHaveBeenCalled();
    expect(calls.filter((name) => name === "getFixtureOdds").length).toBeGreaterThan(0);
    expect(client.getFixturesByIds).not.toHaveBeenCalled();
  });

  it("does not fabricate optional enrichment when Live Lite omits it", async () => {
    installCoordinator(liveItem);
    const data = await getMatchCenterData({
      provider: countingProvider({
        items: [liveItem],
        calls: [],
        enrichMatch: false,
      }),
      externalMatchId: "1637637",
      includeFixtureList: false,
      includeLiveRefresh: true,
      env: {},
    });
    expect(data.preview.dashboard.form.home).toBeNull();
    expect(data.preview.dashboard.trends.home).toBeNull();
    expect(data.preview.dashboard.valueBet).toBeNull();
    expect(data.live.vision.players).toEqual([]);
  });
});

describe("null player React keys", () => {
  it("duplicate/null provider player ids stay unique and do not invent identity", () => {
    const a = apiFootballPlayerRenderKey({
      teamId: 42,
      slot: "xi",
      index: 0,
      playerId: null,
    });
    const b = apiFootballPlayerRenderKey({
      teamId: 42,
      slot: "xi",
      index: 1,
      playerId: null,
    });
    const c = apiFootballPlayerRenderKey({
      teamId: 49,
      slot: "xi",
      index: 0,
      playerId: null,
    });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe("apex:api-football:player:slot:42:xi:0");
    expect(a).not.toContain(":null");
    expect(
      apiFootballPlayerRenderKey({
        teamId: 42,
        slot: "xi",
        index: 0,
        playerId: 7,
      }),
    ).toBe("apex:api-football:player:7:0");
    const xi = apiFootballPlayerRenderKey({
      teamId: 42,
      slot: "xi",
      index: 0,
      playerId: null,
    });
    const sub = apiFootballPlayerRenderKey({
      teamId: 42,
      slot: "sub",
      index: 0,
      playerId: null,
    });
    expect(xi).not.toBe(sub);
    expect(xi).toContain(":slot:42:xi:0");
    expect(sub).toContain(":slot:42:sub:0");
  });

  it("lineup mapper uses slot keys when vendor player id is null", () => {
    const lineups = lineupsFromVendor(
      [
        {
          team: { id: 42, name: "Arsenal" },
          formation: "4-3-3",
          startXI: [
            { player: { id: null, name: "Unknown A", number: 1, pos: "G" } },
            { player: { id: null, name: "Unknown B", number: 2, pos: "D" } },
          ],
          substitutes: [
            { player: { id: null, name: "Unknown C", number: 12, pos: "M" } },
          ],
        },
      ],
      "42",
      "49",
    );
    const ids = [
      ...(lineups.home?.startXI.map((row) => row.id) ?? []),
      ...(lineups.home?.substitutes.map((row) => row.id) ?? []),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => !id.endsWith(":null") && !id.includes(":null:"))).toBe(
      true,
    );
  });
});

describe("Live Lite does not use recorded calibration/PE fixtures as live", () => {
  it("recorded finished fixture without includeLiveRefresh stays rich", async () => {
    const data = await getMatchCenterData({
      env: {},
      requireProvider: true,
      includeFixtureList: false,
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    expect(data.liveLite).toBeFalsy();
    expect(data.match.status).toBe("finished");
    expect(data.preview.source).toBe("intelligence-core");
  });
});