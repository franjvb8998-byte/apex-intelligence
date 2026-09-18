/**
 * Process-local single-flight for identical API-Football cache misses.
 *
 * N concurrent callers for the same canonical cache key share one in-flight
 * Promise. Settlement removes the entry — this is not a cache. TTL cache
 * remains responsible for storing successful responses.
 *
 * Different keys do not block each other.
 */

const SLOT = Symbol.for("apex.apiFootball.singleFlight");

type FlightGlobal = typeof globalThis & {
  [SLOT]?: Map<string, Promise<unknown>>;
};

function flights(): Map<string, Promise<unknown>> {
  const g = globalThis as FlightGlobal;
  if (!g[SLOT]) g[SLOT] = new Map();
  return g[SLOT];
}

/**
 * Run `load` once for `key` while in flight. Waiters receive the same
 * success or the same rejection. Failed entries are dropped so a later
 * call may try again.
 */
export function singleFlightApiFootball<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const map = flights();
  const existing = map.get(key);
  if (existing) return existing as Promise<T>;

  const pending = load().finally(() => {
    if (map.get(key) === pending) map.delete(key);
  });
  map.set(key, pending);
  return pending;
}

export function resetApiFootballSingleFlightForTests(): void {
  flights().clear();
}
