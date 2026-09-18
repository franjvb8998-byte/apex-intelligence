/**
 * Next.js Data Cache (`unstable_cache`) for API-Football responses.
 * Skipped in unit tests so Vitest does not need a Next request scope.
 *
 * Failures from `load` are never retried by this wrapper. The previous
 * `catch { return load() }` path invoked origin a second time when
 * `unstable_cache` rethrew a provider error.
 */

function inUnitTest(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

/**
 * Read-through helper used by production and tests.
 * If `wrap` invokes `load` and that throws, the error is rethrown as-is.
 * `load` is only used as a fallback when `wrap` fails *before* calling it
 * (missing Next runtime, import failure).
 */
export async function readThroughWithCacheWrap<T>(
  load: () => Promise<T>,
  wrap: (load: () => Promise<T>) => Promise<T>,
): Promise<T> {
  let loadInvoked = false;
  const tracked = async (): Promise<T> => {
    loadInvoked = true;
    return load();
  };
  try {
    return await wrap(tracked);
  } catch (error) {
    if (loadInvoked) throw error;
    return load();
  }
}

/**
 * Read-through Next.js Data Cache. On a cache hit, `load` is not invoked
 * (no API-Football call). Throws from `load` are not stored and are not
 * retried here.
 */
export async function readThroughNextDataCache<T>(
  key: string,
  revalidateSeconds: number,
  load: () => Promise<T>,
  enabled = true,
  /** Tests only — inject a cache wrapper without Next's request scope. */
  wrapForTests?: (load: () => Promise<T>) => Promise<T>,
): Promise<T> {
  if (wrapForTests) {
    return readThroughWithCacheWrap(load, wrapForTests);
  }
  if (!enabled || inUnitTest()) {
    return load();
  }

  return readThroughWithCacheWrap(load, async (tracked) => {
    const { unstable_cache } = await import("next/cache");
    const cached = unstable_cache(tracked, ["api-football", key], {
      revalidate: revalidateSeconds,
      tags: ["api-football", key],
    });
    return await cached();
  });
}
