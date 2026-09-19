import { afterEach, describe, expect, it, vi } from "vitest";
import { createTtlCache } from "@/lib/data-platform/cache";
import { createApiFootballClient, withApiFootballClientCache } from "@/lib/data-platform/providers/api-football/client";
import {
  API_FOOTBALL_CACHE_TTL_MS,
  isApiFootballRateLimitPayload,
  ttlForCacheKey,
  ttlForCachedPayload,
} from "@/lib/data-platform/providers/api-football/cache-policy";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import {
  createRecordedApiFootballFixturesResponse,
  createRecordedApiFootballTeamsResponse,
} from "@/lib/data-platform/providers/api-football/fixtures";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";

afterEach(() => {
  resetApiFootballQuotaCircuitForTests();
  resetApiFootballSingleFlightForTests();
});

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

describe("API-Football cache policy", () => {
  it("assigns resource TTLs", () => {
    expect(ttlForCacheKey("af:fixtures:date:2024-04-23")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.fixtures,
    );
    expect(ttlForCacheKey("af:fixtures:league:39:2025")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.fixtures,
    );
    expect(ttlForCacheKey("af:fixtures:team:42:last:5")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.teamForm,
    );
    expect(ttlForCacheKey("af:h2h:42:49:5")).toBe(API_FOOTBALL_CACHE_TTL_MS.h2h);
    expect(ttlForCacheKey("af:fixture:1035089")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(ttlForCacheKey("af:odds:1035089")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(ttlForCacheKey("af:lineups:1035089")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(ttlForCacheKey("af:events:1035089")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(ttlForCacheKey("af:injuries:1035089::")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.match,
    );
    expect(ttlForCacheKey("af:team:42")).toBe(API_FOOTBALL_CACHE_TTL_MS.team);
    expect(ttlForCacheKey("af:league:39")).toBe(API_FOOTBALL_CACHE_TTL_MS.league);
    expect(ttlForCacheKey("af:standings:39:2023")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.standings,
    );
  });

  it("lengthens TTL only for a terminal single-fixture payload", () => {
    const finished = createRecordedApiFootballFixturesResponse();
    expect(
      ttlForCachedPayload(
        "af:fixture:1035089",
        finished,
        API_FOOTBALL_CACHE_TTL_MS.match,
      ),
    ).toBe(API_FOOTBALL_CACHE_TTL_MS.finishedMatch);
    const scheduled = structuredClone(finished);
    scheduled.response[0]!.fixture.status.short = "NS";
    expect(
      ttlForCachedPayload(
        "af:fixture:1035089",
        scheduled,
        API_FOOTBALL_CACHE_TTL_MS.match,
      ),
    ).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(
      ttlForCachedPayload(
        "af:odds:1035089",
        finished,
        API_FOOTBALL_CACHE_TTL_MS.match,
      ),
    ).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(
      ttlForCachedPayload(
        "af:fixtures:date:2024-04-23",
        finished,
        API_FOOTBALL_CACHE_TTL_MS.fixtures,
      ),
    ).toBe(API_FOOTBALL_CACHE_TTL_MS.fixtures);
  });

  it("detects vendor daily quota payloads", () => {
    expect(
      isApiFootballRateLimitPayload({
        errors: {
          requests:
            "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
        },
      }),
    ).toBe(true);
    expect(isApiFootballRateLimitPayload({ errors: [] })).toBe(false);
  });
});

describe("withApiFootballClientCache", () => {
  it("does not call API-Football again while a fresh entry exists", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(createRecordedApiFootballTeamsResponse()),
    );
    const logs: string[] = [];
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      {
        logger: (event) => logs.push(event.stale ? "CACHE (stale)" : event.source),
      },
    );

    await client.getTeam("42");
    await client.getTeam("42");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(logs).toEqual(["API", "CACHE"]);
  });

  it("serves stale cache when API-Football returns HTTP 429", async () => {
    let now = 1_000;
    const cache = createTtlCache({ now: () => now, defaultTtlMs: 100 });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createRecordedApiFootballTeamsResponse()))
      .mockResolvedValueOnce(
        jsonResponse({ message: "Too many requests" }, 429),
      );
    const logs: Array<{ source: string; stale?: boolean }> = [];
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      ttlMs: 100,
      logger: (event) => logs.push({ source: event.source, stale: event.stale }),
    });

    const first = await client.getTeam("42");
    now = 1_500;
    const stale = await client.getTeam("42");

    expect(stale).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(logs.some((entry) => entry.stale)).toBe(true);
  });

  it("serves stale cache when the vendor body reports a request limit", async () => {
    let now = 1_000;
    const cache = createTtlCache({ now: () => now });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(createRecordedApiFootballTeamsResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          errors: {
            requests: "You have reached the request limit for the day",
          },
          response: [],
        }),
      );
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      ttlMs: 50,
      logger: () => undefined,
    });

    const first = await client.getTeam("42");
    now = 1_200;
    const served = await client.getTeam("42");
    expect(served).toEqual(first);
  });

  it("throws when rate-limited and no cached value exists", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: { requests: "You have reached the request limit for the day" },
        response: [],
      }),
    );
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined },
    );

    await expect(client.getTeam("42")).rejects.toBeInstanceOf(ApiFootballError);
  });

  it("does not cache a rate-limit failure as empty fixture odds", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: { requests: "Your rate limit is 10 requests per minute." },
        response: [],
      }),
    );
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined, useNextDataCache: false },
    );

    await expect(client.getFixtureOdds("1035089")).rejects.toBeInstanceOf(
      ApiFootballError,
    );
    await expect(client.getFixtureOdds("1035089")).rejects.toBeInstanceOf(
      ApiFootballError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("coalesces three concurrent same-key cold misses into one origin call", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await gate;
      return jsonResponse(createRecordedApiFootballTeamsResponse());
    });
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined, useNextDataCache: false },
    );

    const pending = Promise.all([
      client.getTeam("42"),
      client.getTeam("42"),
      client.getTeam("42"),
    ]);
    release();
    const results = await pending;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);

    await client.getTeam("42");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("runs different keys independently", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const id = url.includes("id=49") ? "49" : "42";
      return jsonResponse(createRecordedApiFootballTeamsResponse(id));
    });
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined, useNextDataCache: false },
    );

    const [home, away] = await Promise.all([
      client.getTeam("42"),
      client.getTeam("49"),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(home.response[0]?.team.id).toBe(42);
    expect(away.response[0]?.team.id).toBe(49);
  });

  it("shares a rejected miss and lets a later call try origin again", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "upstream 502" }, 502))
      .mockResolvedValueOnce(jsonResponse(createRecordedApiFootballTeamsResponse()));
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined, useNextDataCache: false },
    );

    const first = await Promise.allSettled([
      client.getTeam("42"),
      client.getTeam("42"),
      client.getTeam("42"),
    ]);
    expect(first.every((row) => row.status === "rejected")).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const recovered = await client.getTeam("42");
    expect(recovered.response[0]?.team.id).toBe(42);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not issue another origin call after daily quota fail-fast", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        errors: {
          requests:
            "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
        },
        response: [],
      }),
    );
    const client = withApiFootballClientCache(
      testClient(fetchImpl),
      createTtlCache(),
      { logger: () => undefined, useNextDataCache: false },
    );

    await expect(client.getTeam("42")).rejects.toBeInstanceOf(ApiFootballError);
    await expect(client.getTeam("42")).rejects.toBeInstanceOf(ApiFootballError);
    await expect(client.getFixtureOdds("1035089")).rejects.toBeInstanceOf(
      ApiFootballError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a finished fixture-by-id in process cache past the live match TTL", async () => {
    let now = 1_000;
    const cache = createTtlCache({ now: () => now });
    const fetchImpl = vi.fn(async () =>
      jsonResponse(createRecordedApiFootballFixturesResponse()),
    );
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      logger: () => undefined,
      useNextDataCache: false,
    });

    await client.getFixture("1035089");
    now += API_FOOTBALL_CACHE_TTL_MS.match + 1;
    await client.getFixture("1035089");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    now += API_FOOTBALL_CACHE_TTL_MS.finishedMatch;
    await client.getFixture("1035089");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not lengthen odds TTL", async () => {
    let now = 1_000;
    const cache = createTtlCache({ now: () => now });
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ response: [], errors: [], results: 0 }),
    );
    const client = withApiFootballClientCache(testClient(fetchImpl), cache, {
      logger: () => undefined,
      useNextDataCache: false,
    });

    await client.getFixtureOdds("1035089");
    now += API_FOOTBALL_CACHE_TTL_MS.match + 1;
    await client.getFixtureOdds("1035089");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("getFixturesByLeague unpaged production contract", () => {
  it("sends only league and season and uses the unpaged cache key", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        get: "fixtures",
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      }),
    );
    const keys: string[] = [];
    const client = withApiFootballClientCache(testClient(fetchImpl), createTtlCache(), {
      logger: (event) => keys.push(event.key),
      useNextDataCache: false,
    });

    await client.getFixturesByLeague("39", "2024");
    const firstCall = fetchImpl.mock.calls[0] as unknown as [RequestInfo | URL];
    const url = new URL(String(firstCall[0]));
    expect(url.pathname.endsWith("/fixtures")).toBe(true);
    expect(url.searchParams.get("league")).toBe("39");
    expect(url.searchParams.get("season")).toBe("2024");
    expect(url.searchParams.has("page")).toBe(false);
    expect([...url.searchParams.keys()].sort()).toEqual(["league", "season"]);
    expect(keys).toEqual(["af:fixtures:league:39:2024"]);
  });
});
