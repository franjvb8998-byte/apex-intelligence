import { afterEach, describe, expect, it, vi } from "vitest";
import { startMatchCenterLivePoll } from "@/lib/apex-vision/live/browser-poll";
import {
  HT_REFRESH_INTERVAL_MS,
  LIVE_REFRESH_INTERVAL_MS,
  matchCenterLiveApiHref,
  matchCenterLivePollIntervalMs,
  shouldStartMatchCenterLivePoll,
  toMatchCenterLiveView,
  type LiveFreshness,
  type MatchCenterLiveView,
} from "@/lib/apex-vision/live/view";
import { normalizeLiveEvent } from "@/lib/apex-vision/live/normalize";
import type { LiveFixtureState } from "@/lib/apex-vision/live/types";
import { readFileSync } from "node:fs";
import path from "node:path";

afterEach(() => {
  vi.restoreAllMocks();
});

function view(input: {
  statusShort: string;
  freshnessNow: string;
  shouldPoll?: boolean;
}): MatchCenterLiveView {
  const state: LiveFixtureState = {
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
    statusShort: input.statusShort,
    elapsed: 14,
    kickoffUtc: "2026-09-20T07:00:00.000Z",
    fetchedAtUtc: "2026-09-20T07:14:00.000Z",
    source: "API_FOOTBALL",
    nestedEventsAvailable: true,
    eventsSource: "NESTED",
    events: [
      normalizeLiveEvent({
        time: { elapsed: 12, extra: null },
        team: { id: 100, name: "Home FC" },
        player: { id: 7, name: "A. Striker" },
        assist: { id: 8, name: "B. Assist" },
        type: "Goal",
        detail: "Normal Goal",
        comments: null,
      }),
    ],
  };
  const live = toMatchCenterLiveView({
    state,
    nowMs: Date.parse(input.freshnessNow),
    refreshSource: "PROVIDER",
    refreshPerformed: true,
    cacheHit: false,
    lastProviderRefreshAt: state.fetchedAtUtc,
  });
  if (input.shouldPoll != null) {
    return {
      ...live,
      refresh: { ...live.refresh, shouldPoll: input.shouldPoll },
    };
  }
  return live;
}

function createHost() {
  let nextId = 1;
  const intervals = new Map<number, { handler: () => void; ms: number }>();
  const listeners = new Map<string, Set<() => void>>();
  let visibility: DocumentVisibilityState = "visible";
  return {
    intervals,
    listeners,
    set visibility(value: DocumentVisibilityState) {
      visibility = value;
    },
    host: {
      setInterval: (handler: () => void, ms: number) => {
        const id = nextId++;
        intervals.set(id, { handler, ms });
        return id;
      },
      clearInterval: (id: number) => {
        intervals.delete(id);
      },
      addEventListener: (type: "pagehide" | "visibilitychange", listener: () => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(listener);
        listeners.set(type, set);
      },
      removeEventListener: (
        type: "pagehide" | "visibilitychange",
        listener: () => void,
      ) => {
        listeners.get(type)?.delete(listener);
      },
      visibilityState: () => visibility,
    },
    fire(type: "pagehide" | "visibilitychange") {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    tick() {
      for (const row of [...intervals.values()]) row.handler();
    },
  };
}

describe("startMatchCenterLivePoll", () => {
  it("starts exactly one interval at >= 60s and does not pull immediately when LIVE", async () => {
    const env = createHost();
    const fetchLive = vi.fn(async () => view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" }));
    const onView = vi.fn();
    const live = view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" });
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: matchCenterLivePollIntervalMs(live),
      shouldStart: shouldStartMatchCenterLivePoll({
        isMock: false,
        fixtureId: 1510455,
        catalogueLive: true,
        providerLive: live,
      }),
      freshness: live.freshness,
      fetchLive,
      onView,
      host: env.host,
    });
    expect(session.activeIntervalCount()).toBe(1);
    expect(env.intervals.size).toBe(1);
    expect([...env.intervals.values()][0]?.ms).toBe(LIVE_REFRESH_INTERVAL_MS);
    expect(fetchLive).not.toHaveBeenCalled();
    env.tick();
    await Promise.resolve();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(fetchLive).toHaveBeenCalledWith(matchCenterLiveApiHref(1510455));
    session.stop();
    expect(session.activeIntervalCount()).toBe(0);
  });

  it("HT cadence is 90s", () => {
    const env = createHost();
    const live = view({ statusShort: "HT", freshnessNow: "2026-09-20T07:14:10.000Z" });
    expect(matchCenterLivePollIntervalMs(live)).toBe(HT_REFRESH_INTERVAL_MS);
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: matchCenterLivePollIntervalMs(live),
      shouldStart: true,
      freshness: "LIVE",
      fetchLive: async () => live,
      onView: () => undefined,
      host: env.host,
    });
    expect([...env.intervals.values()][0]?.ms).toBe(HT_REFRESH_INTERVAL_MS);
    session.stop();
  });

  it("floors a too-small interval at 60s so mock 5s cannot leak here", () => {
    const env = createHost();
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: 5000,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive: async () => null,
      onView: () => undefined,
      host: env.host,
    });
    expect([...env.intervals.values()][0]?.ms).toBe(LIVE_REFRESH_INTERVAL_MS);
    session.stop();
  });

  it("terminal FT does not start a loop", () => {
    const env = createHost();
    const live = view({
      statusShort: "FT",
      freshnessNow: "2026-09-20T07:14:10.000Z",
    });
    const shouldStart = shouldStartMatchCenterLivePoll({
      isMock: false,
      fixtureId: 1510455,
      catalogueLive: false,
      providerLive: live,
    });
    expect(shouldStart).toBe(false);
    const fetchLive = vi.fn(async () => live);
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart,
      freshness: live.freshness,
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    expect(session.activeIntervalCount()).toBe(0);
    expect(env.intervals.size).toBe(0);
    expect(fetchLive).not.toHaveBeenCalled();
    session.stop();
  });

  it("AET and PEN also refuse to start", () => {
    for (const statusShort of ["AET", "PEN"]) {
      const live = view({
        statusShort,
        freshnessNow: "2026-09-20T07:14:10.000Z",
      });
      expect(
        shouldStartMatchCenterLivePoll({
          isMock: false,
          fixtureId: 1510455,
          catalogueLive: false,
          providerLive: live,
        }),
      ).toBe(false);
    }
  });

  it("unmount stop clears the interval and does not pull afterwards", async () => {
    const env = createHost();
    const fetchLive = vi.fn(async () => view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" }));
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    session.stop();
    expect(env.intervals.size).toBe(0);
    env.tick();
    await Promise.resolve();
    expect(fetchLive).not.toHaveBeenCalled();
  });

  it("pagehide (leave Match Center / about:blank) stops polling", async () => {
    const env = createHost();
    const fetchLive = vi.fn(async () => view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" }));
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    expect(env.listeners.get("pagehide")?.size).toBe(1);
    env.fire("pagehide");
    expect(session.activeIntervalCount()).toBe(0);
    expect(env.intervals.size).toBe(0);
    env.tick();
    await Promise.resolve();
    expect(fetchLive).not.toHaveBeenCalled();
  });

  it("visibilitychange pulls on the existing loop and does not create a second interval", async () => {
    const env = createHost();
    const fetchLive = vi.fn(async () => view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" }));
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    expect(env.intervals.size).toBe(1);
    env.fire("visibilitychange");
    await Promise.resolve();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(env.intervals.size).toBe(1);
    session.stop();
  });

  it("Strict Mode remount stop+start leaves exactly one interval", () => {
    const env = createHost();
    const start = () =>
      startMatchCenterLivePoll({
        fixtureId: 1510455,
        intervalMs: LIVE_REFRESH_INTERVAL_MS,
        shouldStart: true,
        freshness: "LIVE",
        fetchLive: async () => null,
        onView: () => undefined,
        host: env.host,
      });
    const first = start();
    expect(env.intervals.size).toBe(1);
    first.stop();
    expect(env.intervals.size).toBe(0);
    const second = start();
    expect(env.intervals.size).toBe(1);
    expect(second.activeIntervalCount()).toBe(1);
    second.stop();
  });

  it("does not rapidly retry on fetch failure", async () => {
    const env = createHost();
    const fetchLive = vi.fn(async () => {
      throw new Error("apex down");
    });
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "STALE" as LiveFreshness,
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    await Promise.resolve();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    session.stop();
  });

  it("shouldPoll false from a pull stops the interval (FT)", async () => {
    const env = createHost();
    const finished = view({
      statusShort: "FT",
      freshnessNow: "2026-09-20T07:14:10.000Z",
      shouldPoll: false,
    });
    const fetchLive = vi.fn(async () => finished);
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    env.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    expect(session.activeIntervalCount()).toBe(0);
    expect(env.intervals.size).toBe(0);
  });

  it("inFlight coalesces overlapping visibility + tick pulls", async () => {
    const env = createHost();
    let resolveFetch: ((value: MatchCenterLiveView | null) => void) | undefined;
    const fetchLive = vi.fn(
      () =>
        new Promise<MatchCenterLiveView | null>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const session = startMatchCenterLivePoll({
      fixtureId: 1510455,
      intervalMs: LIVE_REFRESH_INTERVAL_MS,
      shouldStart: true,
      freshness: "LIVE",
      fetchLive,
      onView: () => undefined,
      host: env.host,
    });
    env.tick();
    env.fire("visibilitychange");
    await Promise.resolve();
    expect(fetchLive).toHaveBeenCalledTimes(1);
    resolveFetch?.(view({ statusShort: "1H", freshnessNow: "2026-09-20T07:14:10.000Z" }));
    await Promise.resolve();
    session.stop();
  });
});

describe("LivePhase wiring isolation", () => {
  it("provider poll uses startMatchCenterLivePoll; mock 5s tick stays separate", () => {
    const livePhase = readFileSync(
      path.join(process.cwd(), "components/match-center/live-phase.tsx"),
      "utf8",
    );
    expect(livePhase).toContain("startMatchCenterLivePoll");
    expect(livePhase).toContain("MOCK_TICK_MS = 5000");
    expect(livePhase).toContain("simulateVisionTick");
    expect(livePhase).toContain("if (!isMock) return");
    expect(livePhase).toContain("schematic={!isMock}");
    expect(livePhase).not.toContain("api-sports.io");
    expect(livePhase).not.toContain("API_FOOTBALL_KEY");
  });
});
