/**
 * Basic in-memory TTL cache for provider responses.
 * Process-local only — swap for Redis later without changing callers.
 *
 * Fresh entries expire after TTL. Expired entries are kept so callers can
 * serve stale data when the origin is rate-limited.
 */

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type TtlCacheOptions = {
  /** Default TTL in milliseconds (default 60_000). */
  defaultTtlMs?: number;
  /** Max entries before oldest eviction (default 1000). */
  maxEntries?: number;
  now?: () => number;
};

export type TtlCache = {
  /** Fresh value only. Expired entries stay stored for {@link getStale}. */
  get<T>(key: string): T | undefined;
  /** Last stored value, even if TTL has elapsed. */
  getStale<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size(): number;
};

export function createTtlCache(options: TtlCacheOptions = {}): TtlCache {
  const defaultTtlMs = options.defaultTtlMs ?? 60_000;
  const maxEntries = options.maxEntries ?? 1_000;
  const now = options.now ?? (() => Date.now());
  const store = new Map<string, CacheEntry<unknown>>();

  function evictIfNeeded(): void {
    if (store.size <= maxEntries) return;
    const t = now();
    for (const [key, entry] of store) {
      if (store.size <= maxEntries) return;
      if (entry.expiresAt <= t) store.delete(key);
    }
    while (store.size > maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }

  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) return undefined;
      store.delete(key);
      store.set(key, entry);
      return entry.value as T;
    },
    getStale<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs = defaultTtlMs): void {
      store.delete(key);
      store.set(key, { value, expiresAt: now() + ttlMs });
      evictIfNeeded();
    },
    has(key: string): boolean {
      return this.get(key) !== undefined;
    },
    delete(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    size(): number {
      return store.size;
    },
  };
}
