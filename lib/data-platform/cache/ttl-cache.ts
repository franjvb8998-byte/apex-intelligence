/**
 * Basic in-memory TTL cache for provider responses.
 * Process-local only — swap for Redis later without changing callers.
 */

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type TtlCacheOptions = {
  /** Default TTL in milliseconds (default 60_000). */
  defaultTtlMs?: number;
  /** Max entries before oldest eviction (default 200). */
  maxEntries?: number;
  now?: () => number;
};

export type TtlCache = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  size(): number;
};

export function createTtlCache(options: TtlCacheOptions = {}): TtlCache {
  const defaultTtlMs = options.defaultTtlMs ?? 60_000;
  const maxEntries = options.maxEntries ?? 200;
  const now = options.now ?? (() => Date.now());
  const store = new Map<string, CacheEntry<unknown>>();

  function pruneExpired(): void {
    const t = now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= t) store.delete(key);
    }
  }

  function evictIfNeeded(): void {
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
      if (entry.expiresAt <= now()) {
        store.delete(key);
        return undefined;
      }
      // Refresh insertion order for simple LRU-ish eviction.
      store.delete(key);
      store.set(key, entry);
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs = defaultTtlMs): void {
      pruneExpired();
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
      pruneExpired();
      return store.size;
    },
  };
}
