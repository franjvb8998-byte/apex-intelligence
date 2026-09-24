/**
 * PE-4F — ApiFootballClient team+season / team+season+from/to (mocked transport).
 * No live HTTP.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiFootballClient } from "@/lib/data-platform/providers/api-football/client";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { createRateLimiter } from "@/lib/data-platform/providers/api-football/rate-limiter";
import { resetApiFootballQuotaCircuitForTests } from "@/lib/data-platform/providers/api-football/quota-circuit";
import { resetApiFootballSingleFlightForTests } from "@/lib/data-platform/providers/api-football/single-flight";

afterEach(() => {
  resetApiFootballQuotaCircuitForTests();
  resetApiFootballSingleFlightForTests();
  vi.unstubAllGlobals();
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

function firstUrl(fetchImpl: ReturnType<typeof vi.fn>): URL {
  const arg = fetchImpl.mock.calls[0]![0] as string | URL | Request;
  if (typeof arg === "string") return new URL(arg);
  if (arg instanceof URL) return arg;
  return new URL(arg.url);
}

const emptyOk = {
  get: "fixtures",
  parameters: {},
  errors: [],
  results: 0,
  paging: { current: 1, total: 1 },
  response: [],
};

describe("PE-4F ApiFootballClient team schedule methods", () => {
  it("getTeamFixturesBySeason uses exact team+season shape (no page/last)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(emptyOk));
    const client = testClient(fetchImpl);
    await client.getTeamFixturesBySeason(42, 2024);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = firstUrl(fetchImpl);
    expect(url.pathname).toContain("/fixtures");
    expect(url.searchParams.get("team")).toBe("42");
    expect(url.searchParams.get("season")).toBe("2024");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.has("last")).toBe(false);
    expect(url.searchParams.has("from")).toBe(false);
    expect(url.searchParams.has("to")).toBe(false);
  });

  it("getTeamFixturesBySeasonWindow uses team+season+from+to (no page/last)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(emptyOk));
    const client = testClient(fetchImpl);
    await client.getTeamFixturesBySeasonWindow(
      "42",
      "2024",
      "2024-09-01",
      "2024-09-30",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = firstUrl(fetchImpl);
    expect(url.searchParams.get("team")).toBe("42");
    expect(url.searchParams.get("season")).toBe("2024");
    expect(url.searchParams.get("from")).toBe("2024-09-01");
    expect(url.searchParams.get("to")).toBe("2024-09-30");
    expect(url.searchParams.has("page")).toBe(false);
    expect(url.searchParams.has("last")).toBe(false);
  });

  it("rejects invalid team/season/from/to before HTTP", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(emptyOk));
    const client = testClient(fetchImpl);

    expect(() => {
      void client.getTeamFixturesBySeason("abc", 2024);
    }).toThrow(ApiFootballError);
    expect(() => {
      void client.getTeamFixturesBySeason(42, "20");
    }).toThrow(ApiFootballError);
    expect(() => {
      void client.getTeamFixturesBySeasonWindow(
        42,
        2024,
        "2024/09/01",
        "2024-09-30",
      );
    }).toThrow(ApiFootballError);
    expect(() => {
      void client.getTeamFixturesBySeasonWindow(
        42,
        2024,
        "2024-09-30",
        "2024-09-01",
      );
    }).toThrow(ApiFootballError);
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  it("surfaces provider errors in the response body (observable)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        get: "fixtures",
        parameters: { team: "42", season: "2024" },
        errors: { plan: "blocked" },
        results: 0,
        paging: { current: 1, total: 1 },
        response: [],
      }),
    );
    const client = testClient(fetchImpl);
    const payload = await client.getTeamFixturesBySeason(42, 2024);
    expect(payload.errors).toEqual({ plan: "blocked" });
  });
});
