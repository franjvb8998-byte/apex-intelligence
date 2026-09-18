import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { isApiFootballQuotaError } from "@/lib/data-platform/providers/api-football/quota";
import {
  classifyApiFootballQuotaSignal,
  getApiFootballOriginCallCountForTests,
  resetApiFootballQuotaCircuitForTests,
} from "@/lib/data-platform/providers/api-football/quota-circuit";
import { DataPlatformHttpError } from "@/lib/data-platform/http";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const dailyBody = {
  errors: {
    requests:
      "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
  },
  response: [],
};

const minuteBody = {
  errors: { requests: "Your rate limit is 10 requests per minute." },
  response: [],
};

function testClient(fetchImpl: ReturnType<typeof vi.fn>) {
  return createApiFootballClient({
    apiKey: "test-key",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    retry: false,
    rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
  });
}

describe("classifyApiFootballQuotaSignal", () => {
  it("treats day/upgrade messages as daily quota", () => {
    expect(
      classifyApiFootballQuotaSignal({
        message:
          "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
        status: 429,
      }),
    ).toBe("daily");
  });

  it("treats per-minute messages as temporary rate_limit", () => {
    expect(
      classifyApiFootballQuotaSignal({
        message: "Your rate limit is 10 requests per minute.",
        status: 429,
      }),
    ).toBe("rate_limit");
    expect(
      classifyApiFootballQuotaSignal({
        message: "Too many requests",
        status: 429,
      }),
    ).toBe("rate_limit");
  });

  it("uses daily remaining header when present", () => {
    const headers = new Headers({ "x-ratelimit-requests-remaining": "0" });
    expect(classifyApiFootballQuotaSignal({ headers, status: 200 })).toBe("daily");
  });

  it("does not classify 5xx or network as quota", () => {
    expect(
      classifyApiFootballQuotaSignal({
        message: "upstream 502",
        status: 502,
      }),
    ).toBeNull();
    expect(
      classifyApiFootballQuotaSignal({
        message: "Request timed out after 12000ms",
        status: null,
      }),
    ).toBeNull();
  });
});

describe("API-Football daily quota circuit", () => {
  afterEach(() => {
    resetApiFootballQuotaCircuitForTests();
  });

  it("allows the first daily-quota origin call and blocks later ones including other endpoints", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(dailyBody));
    const client = testClient(fetchImpl);

    await expect(client.getTeam("42")).rejects.toSatisfy(isApiFootballQuotaError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const afterFirst = getApiFootballOriginCallCountForTests();
    expect(afterFirst).toBe(1);

    await expect(client.getTeam("99")).rejects.toSatisfy(isApiFootballQuotaError);
    await expect(client.getFixtureOdds("1639552")).rejects.toSatisfy(
      isApiFootballQuotaError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getApiFootballOriginCallCountForTests()).toBe(afterFirst);
  });

  it("does not open the daily circuit for a temporary per-minute limit", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(minuteBody, 429))
      .mockResolvedValueOnce(jsonResponse({ response: [{ team: { id: 1 } }] }));
    const client = testClient(fetchImpl);

    await expect(client.getTeam("42")).rejects.toBeInstanceOf(ApiFootballError);
    const second = await client.getTeam("42");
    expect(second.response).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not open the daily circuit for 5xx/network errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(
        new DataPlatformHttpError({
          message: "HTTP 502 from /teams",
          code: "http_status",
          status: 502,
          providerId: "api-football",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ response: [{ team: { id: 1 } }] }));
    const client = createApiFootballClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: false,
      rateLimiter: createRateLimiter({ maxRequests: 100, windowMs: 1000 }),
    });

    await expect(client.getTeam("42")).rejects.toMatchObject({ status: 502 });
    const ok = await client.getTeam("42");
    expect(ok.response).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps fail-fast errors identifiable as quota errors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(dailyBody));
    const client = testClient(fetchImpl);
    await expect(client.getTeam("42")).rejects.toSatisfy(isApiFootballQuotaError);
    await expect(client.getStandings("39", "2025")).rejects.toSatisfy(
      (error: unknown) =>
        isApiFootballQuotaError(error) &&
        error instanceof ApiFootballError &&
        error.apiFootballCode === "rate_limited" &&
        error.status === 429,
    );
  });
});
