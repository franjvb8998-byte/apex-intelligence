import { describe, expect, it, vi } from "vitest";
import { DataPlatformHttpError } from "@/lib/data-platform/http";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { createRecordedApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/recorded-fixture";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { withRetry } from "@/lib/data-platform/providers/api-football/retry";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform/providers/api-football/recorded-fixture";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("API-Football retry", () => {
  it("retries transient failures then succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new DataPlatformHttpError({
            message: "temp",
            code: "timeout",
          });
        }
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, sleep: async () => undefined },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry unauthorized", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          throw new DataPlatformHttpError({
            message: "nope",
            code: "unauthorized",
            status: 401,
          });
        },
        { maxAttempts: 3, baseDelayMs: 1, sleep: async () => undefined },
      ),
    ).rejects.toMatchObject({ code: "unauthorized" });
    expect(attempts).toBe(1);
  });
});

describe("API-Football rate limiter", () => {
  it("allows up to maxRequests inside the window", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 1000,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });

    await limiter.acquire();
    await limiter.acquire();
    expect(limiter.pending()).toBe(2);

    const third = limiter.acquire();
    await third;
    expect(sleeps.length).toBeGreaterThan(0);
  });
});

describe("API-Football client endpoints", () => {
  it("calls Sprint 6 endpoints with auth header", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/fixtures/events")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/fixtures/lineups")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/teams/statistics")) {
        return jsonResponse({ response: { fixtures: { played: { total: 0 } } } });
      }
      if (url.includes("/standings")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/players")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/leagues")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/teams")) {
        return jsonResponse({ response: [] });
      }
      if (url.includes("/fixtures")) {
        return jsonResponse(createRecordedApiFootballFixturesResponse());
      }
      return jsonResponse({ response: [] });
    });

    const client = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });

    await client.getFixture("1035089");
    await client.getFixturesByDate("2024-04-23");
    await client.getTeam("42");
    await client.getTeamStatistics(42, 39, 2023);
    await client.getPlayer("1467", 2023);
    await client.getLeague("39");
    await client.getStandings(39, 2023);
    await client.getLineups("1035089");
    await client.getEvents("1035089");

    expect(fetchImpl).toHaveBeenCalled();
    const firstCall = fetchImpl.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit?,
    ];
    const init = firstCall[1];
    expect(init?.headers).toMatchObject({
      "x-apisports-key": "test-key",
    });
  });
});

describe("ApiFootballDataProvider HTTP getMatch", () => {
  it("maps a live fixture response to ApexMatchBundle", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/fixtures/events") || url.includes("/fixtures/lineups")) {
        return jsonResponse({ response: [] });
      }
      return jsonResponse(createRecordedApiFootballFixturesResponse());
    });

    const provider = new ApiFootballDataProvider({
      apiKey: "test-key",
      enrichMatch: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      config: {
        retryMaxAttempts: 1,
        rateLimitMaxRequests: 100,
      },
    });

    const bundle = await provider.getMatch({
      matchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(bundle.homeTeam.name).toBe("Arsenal");
    expect(bundle.awayTeam.name).toBe("Chelsea");
    expect(bundle.provenance.primaryProvider).toBe("api-football");
  });
});
