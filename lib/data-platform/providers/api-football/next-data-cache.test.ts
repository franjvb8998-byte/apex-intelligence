import { describe, expect, it, vi } from "vitest";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import {
  readThroughNextDataCache,
  readThroughWithCacheWrap,
} from "@/lib/data-platform/providers/api-football/next-data-cache";

describe("readThroughNextDataCache", () => {
  it("returns a successful load", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    await expect(
      readThroughNextDataCache("af:team:1", 60, load, false),
    ).resolves.toEqual({ ok: true });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not invoke load when the wrap returns a cached value", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    const value = await readThroughNextDataCache(
      "af:team:1",
      60,
      load,
      true,
      async () => ({ ok: true, cached: true }),
    );
    expect(value).toEqual({ ok: true, cached: true });
    expect(load).toHaveBeenCalledTimes(0);
  });

  it("invokes a throwing loader exactly once when the cache wrap rethrows", async () => {
    const error = new ApiFootballError({
      message:
        "You have reached the request limit for the day, Go to https://dashboard.api-football.com to upgrade your plan.",
      code: "rate_limited",
      status: 429,
    });
    const load = vi.fn(async () => {
      throw error;
    });
    await expect(
      readThroughWithCacheWrap(load, (tracked) => tracked()),
    ).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back to load once when wrap fails before invoking it", async () => {
    const load = vi.fn(async () => ({ recovered: true }));
    const value = await readThroughWithCacheWrap(load, async () => {
      throw new Error("unstable_cache unavailable");
    });
    expect(value).toEqual({ recovered: true });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("preserves ApiFootballError semantics on daily quota", async () => {
    const error = new ApiFootballError({
      message: "You have reached the request limit for the day",
      code: "rate_limited",
      status: 429,
    });
    const load = vi.fn(async () => {
      throw error;
    });
    await expect(
      readThroughNextDataCache("af:odds:1", 60, load, true, (tracked) =>
        tracked(),
      ),
    ).rejects.toMatchObject({
      apiFootballCode: "rate_limited",
      status: 429,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
