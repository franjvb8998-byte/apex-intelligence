/**
 * Request-scoped memo for identical DAL reads.
 * Collapses duplicate repository calls in one RSC render (Dashboard +
 * Match Center + Match Analysis + Copilot loaders that each `createRepositories()`).
 */

import { cache } from "react";

function inUnitTest(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

const storeForRequest = cache(() => new Map<string, Promise<unknown>>());

/**
 * Run `load` once per React request for `key`. Concurrent callers share the
 * in-flight promise. Tests skip this so fixtures stay isolated across cases.
 */
export function oncePerRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (inUnitTest()) return load();
  const store = storeForRequest();
  const hit = store.get(key);
  if (hit) return hit as Promise<T>;
  const pending = load();
  store.set(key, pending);
  return pending;
}

export function requestMemoKey(
  prefix: string,
  parts: Array<string | number | boolean | null | undefined>,
): string {
  return `${prefix}:${parts.map((part) => String(part ?? "")).join(":")}`;
}
