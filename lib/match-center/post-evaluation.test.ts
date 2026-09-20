import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVisionLiveCoordinator,
  createVisionLiveTransport,
  resetVisionLiveCoordinatorForTests,
  setVisionLiveCoordinatorForTests,
  type VisionLiveClient,
} from "@/lib/apex-vision/live";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import type { ApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { createFixtureApiFootballClient } from "@/lib/data-platform/providers/api-football/fixture-client";
import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballOddsResponse,
} from "@/lib/data-platform/providers/api-football/fixtures";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";
import type {
  ApiFootballEvent,
  ApiFootballFixtureItem,
  ApiFootballStatusShort,
} from "@/lib/data-platform/providers/api-football/types";
import { getMatchCenterData } from "@/lib/match-center/load";
import {
  isMatchCenterPostEvaluated,
  unevaluatedMatchCenterPost,
} from "@/lib/match-center/post-evaluation";
import type { MatchCenterPostData } from "@/lib/match-center/types";

afterEach(() => {
  resetVisionLiveCoordinatorForTests();
  resetApiFootballSingleFlightForTests();
  resetApiFootballQuotaCircuitForTests();
  vi.restoreAllMocks();
});

function vendorEvent(): ApiFootballEvent {
  return {
    time: { elapsed: 12, extra: null },
    team: { id: 100, name: "Home FC" },
    player: { id: 7, name: "A. Striker" },
    assist: { id: 8, name: "B. Assist" },
    type: "Goal",
    detail: "Normal Goal",
    comments: null,
  };
}

function cloneItem(
  id: number,
  short: ApiFootballStatusShort,
  goals: { home: number; away: number } = { home: 0, away: 0 },
): ApiFootballFixtureItem {
  const base = createRecordedApiFootballFixturesResponse().response[0]!;
  return {
    ...base,
    fixture: {
      ...base.fixture,
      id,
      status: {
        long: String(short),
        short,
        elapsed: short === "NS" || short === "FT" || short === "AET" || short === "PEN"
          ? short === "NS"
            ? null
            : 90
          : 88,
      },
    },
    teams: {
      home: { id: 100, name: "Home FC" },
      away: { id: 101, name: "Away FC" },
    },
    goals,
    events: short === "NS" ? [] : [vendorEvent()],
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

function countingProvider(
  items: ApiFootballFixtureItem[],
  calls: string[],
  enrichMatch: boolean,
): ApiFootballDataProvider {
  const inner = createFixtureApiFootballClient();
  const byId = new Map(items.map((item) => [String(item.fixture.id), item]));
  const client = withCallLog(inner, calls, {
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
    enrichMatch,
    useCache: false,
  });
}

function installCoordinator(item: ApiFootballFixtureItem) {
  const client: VisionLiveClient = {
    getLiveFixtures: vi.fn(),
    getFixturesByIds: vi.fn(async () => ({ response: [item] })),
    getLiveEvents: vi.fn(),
  };
  const now = () => new Date("2026-09-20T07:14:00.000Z");
  const coordinator = createVisionLiveCoordinator({
    transport: createVisionLiveTransport({ client, now }),
    now,
  });
  setVisionLiveCoordinatorForTests(coordinator);
  return { client, coordinator };
}

async function loadPost(item: ApiFootballFixtureItem) {
  const calls: string[] = [];
  installCoordinator(item);
  const data = await getMatchCenterData({
    provider: countingProvider(
      [item],
      calls,
      item.fixture.status.short === "1H" ||
        item.fixture.status.short === "HT" ||
        item.fixture.status.short === "2H" ||
        item.fixture.status.short === "ET"
        ? false
        : true,
    ),
    externalMatchId: String(item.fixture.id),
    includeFixtureList: false,
    includeLiveRefresh: true,
    env: {},
  });
  return { data, calls };
}

function fillerEvaluationFields(post: MatchCenterPostData) {
  return {
    predictedDraw: post.preMatch.predictedOutcome === "draw",
    resultDraw: post.actualOutcome === "draw",
    zeroBrier: post.metrics.brierScore === 0,
    zeroOutcomeError: post.metrics.outcomeError === 0,
    zeroProbs:
      post.preMatch.oneXTwo.home === 0 &&
      post.preMatch.oneXTwo.draw === 0 &&
      post.preMatch.oneXTwo.away === 0,
  };
}

describe("Post Match evaluation contract", () => {
  it("treats omitted filler Draw / 0.000 / 0% as not evaluated", () => {
    const post = unevaluatedMatchCenterPost({
      at: "2026-09-20T07:00:00.000Z",
      score: { home: 0, away: 0 },
      summary: "pending",
    });
    expect(isMatchCenterPostEvaluated(post)).toBe(false);
    expect(fillerEvaluationFields(post)).toEqual({
      predictedDraw: true,
      resultDraw: true,
      zeroBrier: true,
      zeroOutcomeError: true,
      zeroProbs: true,
    });
  });

  it.each(["1H", "HT", "2H", "ET"] as const)(
    "live %s 0-0 is not a completed evaluation",
    async (short) => {
      const { data } = await loadPost(cloneItem(1556073, short, { home: 0, away: 0 }));
      expect(data.match.status).toBe("live");
      expect(data.liveLite).toBe(true);
      expect(data.post.evaluationAvailable).toBe(false);
      expect(isMatchCenterPostEvaluated(data.post)).toBe(false);
      expect(fillerEvaluationFields(data.post).zeroBrier).toBe(true);
      expect(fillerEvaluationFields(data.post).resultDraw).toBe(true);
    },
  );

  it("prematch 0-0 does not become a Draw result evaluation", async () => {
    const { data } = await loadPost(cloneItem(8005, "NS", { home: 0, away: 0 }));
    expect(data.match.status).toBe("scheduled");
    expect(data.liveLite).toBeFalsy();
    expect(isMatchCenterPostEvaluated(data.post)).toBe(false);
    expect(data.preview.probabilitiesAvailable).not.toBe(false);
  });

  it.each(["FT", "AET", "PEN"] as const)(
    "terminal %s with 2-1 produces finalized metrics from score and PE",
    async (short) => {
      const { data } = await loadPost(cloneItem(1556073, short, { home: 2, away: 1 }));
      expect(data.match.status).toBe("finished");
      expect(data.liveLite).toBeFalsy();
      expect(isMatchCenterPostEvaluated(data.post)).toBe(true);
      expect(data.post.evaluationAvailable).toBe(true);
      expect(data.post.finalScore).toEqual({ home: 2, away: 1 });
      expect(data.post.actualOutcome).toBe("home");
      expect(data.post.preMatch.oneXTwo.home).toBeGreaterThan(0);
      expect(
        data.post.preMatch.oneXTwo.home +
          data.post.preMatch.oneXTwo.draw +
          data.post.preMatch.oneXTwo.away,
      ).toBeCloseTo(1, 5);
      expect(data.post.metrics.brierScore).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(data.post.metrics.outcomeError)).toBe(true);
    },
  );

  it("terminal FT 0-0 may be Draw only because the finished score is 0-0", async () => {
    const { data } = await loadPost(cloneItem(1556073, "FT", { home: 0, away: 0 }));
    expect(isMatchCenterPostEvaluated(data.post)).toBe(true);
    expect(data.post.actualOutcome).toBe("draw");
    expect(data.post.preMatch.oneXTwo.draw).toBeGreaterThan(0);
    expect(data.post.preMatch.oneXTwo.home + data.post.preMatch.oneXTwo.away).not.toBe(0);
  });

  it("missing prediction/probabilities/metrics stay unevaluated, not defaults", () => {
    const post = unevaluatedMatchCenterPost({
      at: "2026-09-20T07:00:00.000Z",
      score: { home: 0, away: 0 },
      summary: "missing",
    });
    expect(isMatchCenterPostEvaluated(post)).toBe(false);
    expect(post.preMatch.modelVersion).toBe("unevaluated");
    expect(post.markets).toEqual([]);
  });
});
