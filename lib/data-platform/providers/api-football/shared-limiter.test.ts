import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import {
  getSharedApiFootballRateLimiter,
  resetSharedApiFootballRateLimiterForTests,
} from "@/lib/data-platform/providers/api-football/rate-limiter";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { createRecordedApiFootballTeamsResponse } from "@/lib/data-platform/providers/api-football/fixtures";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("shared API-Football rate limiter", () => {
  afterEach(() => {
    resetSharedApiFootballRateLimiterForTests();
    resetApiFootballQuotaCircuitForTests();
  });

  it("returns the same limiter instance for the process", () => {
    expect(getSharedApiFootballRateLimiter()).toBe(
      getSharedApiFootballRateLimiter(),
    );
  });

  it("shares scheduling between the base client and extras (second provider)", async () => {
    const limiter = getSharedApiFootballRateLimiter();
    const fetchImpl = vi.fn(async () =>
      jsonResponse(createRecordedApiFootballTeamsResponse()),
    );
    const clientA = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
    });
    const clientB = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
    });

    expect(limiter.pending()).toBe(0);
    await clientA.getTeam("42");
    await clientB.getTeam("49");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(limiter.pending()).toBe(2);
  });

  it("does not let a second DataProvider instance bypass the shared limiter", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(createRecordedApiFootballTeamsResponse()),
    );
    const providerA = new ApiFootballDataProvider({
      apiKey: "test-key",
      enrichMatch: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useCache: false,
      config: { retryMaxAttempts: 1 },
    });
    const providerB = new ApiFootballDataProvider({
      apiKey: "test-key",
      enrichMatch: false,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useCache: false,
      config: { retryMaxAttempts: 1 },
    });

    await providerA.http.getTeam("42");
    await providerB.http.getTeam("49");
    expect(getSharedApiFootballRateLimiter().pending()).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
