import { describe, expect, it } from "vitest";
import { ApiFootballDataProvider } from "@/lib/data-platform/providers/api-football/api-football-provider";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import {
  ignoreNonQuotaErrors,
  isApiFootballQuotaError,
  loadUnlessQuota,
} from "@/lib/data-platform/providers/api-football/quota";

function quotaError(overrides: Partial<ConstructorParameters<typeof ApiFootballError>[0]> = {}) {
  return new ApiFootballError({
    message:
      "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
    code: "rate_limited",
    status: 429,
    ...overrides,
  });
}

describe("isApiFootballQuotaError", () => {
  it("detects HTTP 429 and rate_limited codes", () => {
    expect(isApiFootballQuotaError(quotaError())).toBe(true);
    expect(
      isApiFootballQuotaError(
        quotaError({
          message: "Too many requests",
          code: "rate_limited",
          status: 429,
        }),
      ),
    ).toBe(true);
  });

  it("detects vendor request-limit messages even when coded as vendor_error", () => {
    expect(
      isApiFootballQuotaError(
        quotaError({
          message:
            "API-Football fixtures error: You have reached the request limit for the day",
          code: "vendor_error",
          status: null,
        }),
      ),
    ).toBe(true);
  });

  it("does not treat unrelated failures as quota", () => {
    expect(isApiFootballQuotaError(new Error("fixture not found"))).toBe(false);
    expect(
      isApiFootballQuotaError(
        new ApiFootballError({
          message: "API-Football fixture not found: 1",
          code: "empty_response",
          status: 404,
        }),
      ),
    ).toBe(false);
  });
});

describe("loadUnlessQuota", () => {
  it("returns data when the load succeeds", async () => {
    const result = await loadUnlessQuota(async () => 42);
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("returns a quota result instead of throwing", async () => {
    const result = await loadUnlessQuota(async () => {
      throw quotaError();
    });
    expect(result).toEqual({ ok: false, quota: true });
  });

  it("rethrows unexpected errors", async () => {
    await expect(
      loadUnlessQuota(async () => {
        throw new Error("network down");
      }),
    ).rejects.toThrow("network down");
  });
});

describe("ignoreNonQuotaErrors", () => {
  it("rethrows quota errors", async () => {
    await expect(
      ignoreNonQuotaErrors(async () => {
        throw quotaError();
      }, []),
    ).rejects.toSatisfy(isApiFootballQuotaError);
  });

  it("swallows other errors into the fallback", async () => {
    const value = await ignoreNonQuotaErrors(async () => {
      throw new Error("timeout");
    }, ["cached"]);
    expect(value).toEqual(["cached"]);
  });
});

describe("ApiFootballDataProvider quota mapping", () => {
  it("maps vendor request-limit bodies to rate_limited errors", async () => {
    const provider = new ApiFootballDataProvider({
      apiKey: "test-key",
      useCache: false,
      enrichMatch: false,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            errors: {
              requests: "You have reached the request limit for the day",
            },
            response: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });

    await expect(provider.listFixtures({ date: "2026-08-27" })).rejects.toSatisfy(
      (error: unknown) =>
        isApiFootballQuotaError(error) &&
        error instanceof ApiFootballError &&
        error.apiFootballCode === "rate_limited" &&
        error.status === 429,
    );
  });
});
