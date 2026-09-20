import { describe, expect, it, vi } from "vitest";
import { createApiFootballClient, withApiFootballClientCache } from "@/lib/data-platform/providers/api-football/client";
import { createTtlCache } from "@/lib/data-platform/cache";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import {
  API_FOOTBALL_CACHE_TTL_MS,
  ttlForCacheKey,
} from "@/lib/data-platform/providers/api-football/cache-policy";
import {
  MAX_FIXTURES_PER_BATCH,
  LIVE_CACHE_PREFIX,
  PREMATCH_FIXTURES_CACHE_PREFIX,
  LIVE_TRANSPORT_MAX_ATTEMPTS,
  buildFixtureIdsQuery,
  buildLiveLeaguesQuery,
  liveFixturesCacheKey,
  liveLeaguesCacheKey,
  liveEventsCacheKey,
  normalizePositiveIntegerIds,
} from "@/lib/data-platform/providers/api-football/live-query";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function testClient(fetchImpl: ReturnType<typeof vi.fn>) {
  return createApiFootballClient({
    apiKey: "test-key",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    retry: false,
    rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
  });
}

function retryingClient(fetchImpl: ReturnType<typeof vi.fn>) {
  return createApiFootballClient({
    apiKey: "test-key",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    retry: true,
    config: { retryBaseDelayMs: 1 },
    rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
  });
}

function firstFetchUrl(fetchImpl: ReturnType<typeof vi.fn>): string {
  const first = fetchImpl.mock.calls[0] as unknown[] | undefined;
  return first ? String(first[0]) : "";
}

describe("API-Football live query syntax", () => {
  it("1 multi-league syntax is deterministic and sorted", () => {
    expect(buildLiveLeaguesQuery([293, 292])).toBe("292-293");
    expect(buildLiveLeaguesQuery(["293", "292"])).toBe("292-293");
  });

  it("2 fixture-id batch syntax is deterministic and sorted", () => {
    expect(buildFixtureIdsQuery([1507073, 1510455])).toBe("1507073-1510455");
    expect(buildFixtureIdsQuery(["1510455", "1507073"])).toBe("1507073-1510455");
  });

  it("3 duplicate IDs are removed", () => {
    expect(normalizePositiveIntegerIds([292, 292, 293, 292])).toEqual([292, 293]);
    expect(buildFixtureIdsQuery([10, 10, 11])).toBe("10-11");
  });

  it("4 invalid IDs are rejected", () => {
    expect(() => normalizePositiveIntegerIds([])).toThrow(ApiFootballError);
    expect(() => normalizePositiveIntegerIds([0])).toThrow(ApiFootballError);
    expect(() => normalizePositiveIntegerIds([-1])).toThrow(ApiFootballError);
    expect(() => normalizePositiveIntegerIds([1.5])).toThrow(ApiFootballError);
    expect(() => normalizePositiveIntegerIds(["abc"])).toThrow(ApiFootballError);
    expect(() => normalizePositiveIntegerIds(["01"])).toThrow(ApiFootballError);
    try {
      normalizePositiveIntegerIds([0]);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiFootballError);
      expect((error as ApiFootballError).apiFootballCode).toBe("invalid_ids");
    }
  });

  it("5 <=15 fixture batch is accepted", () => {
    const ids = Array.from({ length: MAX_FIXTURES_PER_BATCH }, (_, i) => i + 1);
    expect(buildFixtureIdsQuery(ids)).toBe(ids.join("-"));
  });

  it("6 >15 fixture handling is explicit and does not silently truncate", () => {
    const ids = Array.from({ length: 16 }, (_, i) => i + 1);
    expect(() => buildFixtureIdsQuery(ids)).toThrow(ApiFootballError);
    try {
      buildFixtureIdsQuery(ids);
    } catch (error) {
      expect((error as ApiFootballError).apiFootballCode).toBe("batch_limit_exceeded");
    }
    expect(() => buildFixtureIdsQuery(ids)).toThrow(/MAX_FIXTURES_PER_BATCH/);
  });
});

describe("API-Football live HTTP methods", () => {
  it("sends live=<sorted league ids> and never viewer count", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: [] }));
    const client = testClient(fetchImpl);
    await client.getLiveFixtures([293, 292, 292]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = firstFetchUrl(fetchImpl);
    expect(url).toContain("live=292-293");
    expect(url).not.toContain("viewer");
    expect(url).not.toContain("ids=");
    expect(client.getLiveFixtures.length).toBe(1);
  });

  it("sends ids=<sorted fixture ids> and rejects oversized batches before HTTP", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: [] }));
    const client = testClient(fetchImpl);
    await client.getFixturesByIds([1510455, 1507073]);
    const url = firstFetchUrl(fetchImpl);
    expect(url).toContain("ids=1507073-1510455");
    expect(url).not.toContain("viewer");
    expect(client.getFixturesByIds.length).toBe(1);

    await expect(
      client.getFixturesByIds(Array.from({ length: 16 }, (_, i) => i + 1)),
    ).rejects.toMatchObject({ apiFootballCode: "batch_limit_exceeded" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("live cache isolation vs prematch", () => {
  it("21 live cache keys are separate from prematch fixture cache", () => {
    const liveLeagues = liveLeaguesCacheKey([293, 292]);
    const liveFixtures = liveFixturesCacheKey([2, 1]);
    expect(liveLeagues).toBe("af:live:leagues:292-293");
    expect(liveFixtures).toBe("af:live:fixtures:1-2");
    expect(liveLeagues.startsWith(LIVE_CACHE_PREFIX)).toBe(true);
    expect(liveFixtures.startsWith(LIVE_CACHE_PREFIX)).toBe(true);
    expect(liveLeagues.startsWith(PREMATCH_FIXTURES_CACHE_PREFIX)).toBe(false);
    expect(liveFixtures.startsWith(PREMATCH_FIXTURES_CACHE_PREFIX)).toBe(false);
    expect(liveLeagues).not.toBe("af:fixtures:league:292-293");
  });

  it("22 live TTL is ~60s and does not change prematch TTLs", () => {
    expect(API_FOOTBALL_CACHE_TTL_MS.live).toBe(60_000);
    expect(API_FOOTBALL_CACHE_TTL_MS.fixtures).toBe(10 * 60 * 1000);
    expect(API_FOOTBALL_CACHE_TTL_MS.match).toBe(10 * 60 * 1000);
    expect(ttlForCacheKey("af:live:leagues:292-293")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.live,
    );
    expect(ttlForCacheKey("af:live:fixtures:1-2")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.live,
    );
    expect(ttlForCacheKey("af:fixtures:date:2024-04-23")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.fixtures,
    );
    expect(ttlForCacheKey("af:fixture:1035089")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.match,
    );
    expect(ttlForCacheKey("af:live:events:1510455")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.live,
    );
    expect(ttlForCacheKey("af:events:1510455")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.match,
    );
  });

  it("cached live heartbeat does not use the prematch fixtures key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: [] }));
    const cache = createTtlCache();
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      logger: () => undefined,
      useNextDataCache: false,
    });
    await client.getLiveFixtures([292, 293]);
    await client.getLiveFixtures([293, 292]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.has("af:live:leagues:292-293")).toBe(true);
    expect(cache.has("af:fixtures:league:292:293")).toBe(false);
  });
});

describe("Vision live retry budget", () => {
  it("A live heartbeat uses at most one HTTP attempt on failure", async () => {
    expect(LIVE_TRANSPORT_MAX_ATTEMPTS).toBe(1);
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "fail" }, 500));
    const client = retryingClient(fetchImpl);
    await expect(client.getLiveFixtures([292, 293])).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl(fetchImpl)).toContain("live=292-293");
  });

  it("B ids batch uses at most one HTTP attempt on failure", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "fail" }, 500));
    const client = retryingClient(fetchImpl);
    await expect(client.getFixturesByIds([1510455, 1507073])).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl(fetchImpl)).toContain("ids=1507073-1510455");
  });

  it("D generic non-live API-Football retry remains 3 attempts", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "fail" }, 500));
    const client = retryingClient(fetchImpl);
    await expect(client.getFixture("1035089")).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const eventsFetch = vi.fn(async () => jsonResponse({ message: "fail" }, 500));
    const eventsClient = retryingClient(eventsFetch);
    await expect(eventsClient.getEvents("1035089")).rejects.toMatchObject({
      status: 500,
    });
    expect(eventsFetch).toHaveBeenCalledTimes(3);
  });

  it("C Vision getLiveEvents uses at most one HTTP attempt and the live events cache key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "fail" }, 500));
    const client = retryingClient(fetchImpl);
    await expect(client.getLiveEvents("1510455")).rejects.toMatchObject({
      status: 500,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstFetchUrl(fetchImpl)).toContain("/fixtures/events");
    expect(firstFetchUrl(fetchImpl)).toContain("fixture=1510455");
    expect(liveEventsCacheKey(1510455)).toBe("af:live:events:1510455");
    expect(liveEventsCacheKey(1510455)).not.toBe("af:events:1510455");
  });

  it("cached getLiveEvents does not share the prematch events key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: [] }));
    const cache = createTtlCache();
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      logger: () => undefined,
      useNextDataCache: false,
    });
    await client.getLiveEvents("1510455");
    await client.getLiveEvents("1510455");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.has("af:live:events:1510455")).toBe(true);
    expect(cache.has("af:events:1510455")).toBe(false);
  });
});
