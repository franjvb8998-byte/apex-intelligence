/**
 * Next.js Data Cache (`unstable_cache`) for API-Football responses.
 * Skipped in unit tests so Vitest does not need a Next request scope.
 */

function inUnitTest(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * Read-through Next.js Data Cache. On a cache hit, `load` is not invoked
 * (no API-Football call). Throws from `load` are not stored.
 */
export async function readThroughNextDataCache<T>(
  key: string,
  revalidateSeconds: number,
  load: () => Promise<T>,
  enabled = true,
): Promise<T> {
  if (!enabled || inUnitTest()) {
    return load();
  }

  try {
    const { unstable_cache } = await import("next/cache");
    const cached = unstable_cache(load, ["api-football", key], {
      revalidate: revalidateSeconds,
      tags: ["api-football", key],
    });
    return await cached();
  } catch {
    return load();
  }
}
