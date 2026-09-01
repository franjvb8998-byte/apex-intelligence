/**
 * Request-scoped memo for identical DAL reads and repository graphs.
 * Collapses duplicate repository calls in one RSC render (Dashboard +
 * Match Center + Match Analysis + Copilot loaders that each `createRepositories()`).
 */

import { cache } from "react";

function inUnitTest(): boolean {
  return process.env.VITEST === "true" || process.env.NODE_ENV === "test";
}

const storeForRequest = cache(() => new Map<string, Promise<unknown>>());
const syncStoreForRequest = cache(() => new Map<string, unknown>());

const identities = new WeakMap<object, number>();
let nextIdentity = 1;

/**
 * Stable identity for a provider / env object within this process.
 * Used to key request-scoped repository graphs without serializing secrets.
 */
export function requestIdentityKey(value: object): string {
  const hit = identities.get(value);
  if (hit != null) return String(hit);
  const id = nextIdentity++;
  identities.set(value, id);
  return String(id);
}

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

/**
 * Synchronous counterpart of {@link oncePerRequest} for factory functions
 * (`createRepositories`, providers). Tests skip this so cases stay isolated.
 */
export function oncePerRequestSync<T>(key: string, load: () => T): T {
  if (inUnitTest()) return load();
  const store = syncStoreForRequest();
  const hit = store.get(key);
  if (hit !== undefined) return hit as T;
  const value = load();
  store.set(key, value);
  return value;
}

export function requestMemoKey(
  prefix: string,
  parts: Array<string | number | boolean | null | undefined>,
): string {
  return `${prefix}:${parts.map((part) => String(part ?? "")).join(":")}`;
}
