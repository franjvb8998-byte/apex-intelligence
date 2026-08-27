import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "@/lib/data-platform/cache";
import { createApiFootballClient, withApiFootballClientCache } from "@/lib/data-platform/providers/api-football/client";
import {
  API_FOOTBALL_CACHE_TTL_MS,
  isApiFootballRateLimitPayload,
  ttlForCacheKey,
} from "@/lib/data-platform/providers/api-football/cache-policy";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { createRecordedApiFootballTeamsResponse } from "@/lib/data-platform/providers/api-football/fixtures";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";

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
    expect(ttlForCacheKey("af:fixture:1035089")).toBe(API_FOOTBALL_CACHE_TTL_MS.match);
    expect(ttlForCacheKey("af:team:42")).toBe(API_FOOTBALL_CACHE_TTL_MS.team);
    expect(ttlForCacheKey("af:league:39")).toBe(API_FOOTBALL_CACHE_TTL_MS.league);
    expect(ttlForCacheKey("af:standings:39:2023")).toBe(
      API_FOOTBALL_CACHE_TTL_MS.standings,
    );
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
});
