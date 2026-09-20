/**
 * Deterministic live query syntax for API-Football C1 transport.
 * Validates IDs before any HTTP request is made.
 */

import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";

/**
 * Conservative Phase 2A.1 batch cap.
 * Vendor docs mention 20; Vision initially tracks <=15 fixtures.
 */
export const MAX_FIXTURES_PER_BATCH = 15;

export const LIVE_CACHE_PREFIX = "af:live:";
export const PREMATCH_FIXTURES_CACHE_PREFIX = "af:fixtures:";

/**
 * One scheduled live refresh may produce at most one HTTP attempt
 * for that live endpoint. A later cycle can try again.
 */
export const LIVE_TRANSPORT_MAX_ATTEMPTS = 1;

export type NormalizeIdOptions = {
  /** When set, unique sorted length above this throws `batch_limit_exceeded`. */
  maxCount?: number;
};

function parsePositiveIntegerId(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw <= 0) {
      throw new ApiFootballError({
        message: `Invalid provider id: ${raw}`,
        code: "invalid_ids",
        details: { raw },
      });
    }
    return raw;
  }
  if (typeof raw !== "string" || !raw.trim()) {
    throw new ApiFootballError({
      message: `Invalid provider id: ${String(raw)}`,
      code: "invalid_ids",
      details: { raw },
    });
  }
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    throw new ApiFootballError({
      message: `Invalid provider id: ${raw}`,
      code: "invalid_ids",
      details: { raw },
    });
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ApiFootballError({
      message: `Invalid provider id: ${raw}`,
      code: "invalid_ids",
      details: { raw },
    });
  }
  return value;
}

/**
 * Non-empty, positive integer, unique, deterministically ascending.
 */
export function normalizePositiveIntegerIds(
  ids: Array<string | number>,
  options: NormalizeIdOptions = {},
): number[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiFootballError({
      message: "Provider id list must be a non-empty array",
      code: "invalid_ids",
    });
  }
  const unique = new Set<number>();
  for (const raw of ids) {
    unique.add(parsePositiveIntegerId(raw));
  }
  const sorted = [...unique].sort((a, b) => a - b);
  if (options.maxCount != null && sorted.length > options.maxCount) {
    throw new ApiFootballError({
      message: `Fixture batch exceeds MAX_FIXTURES_PER_BATCH (${options.maxCount}); got ${sorted.length}`,
      code: "batch_limit_exceeded",
      details: {
        max: options.maxCount,
        count: sorted.length,
      },
    });
  }
  return sorted;
}

/** `live=292-293` */
export function buildLiveLeaguesQuery(leagueIds: Array<string | number>): string {
  return normalizePositiveIntegerIds(leagueIds).join("-");
}

/** `ids=idA-idB` with the Phase 2A.1 batch cap. */
export function buildFixtureIdsQuery(
  fixtureIds: Array<string | number>,
): string {
  return normalizePositiveIntegerIds(fixtureIds, {
    maxCount: MAX_FIXTURES_PER_BATCH,
  }).join("-");
}

export function liveLeaguesCacheKey(leagueIds: Array<string | number>): string {
  return `${LIVE_CACHE_PREFIX}leagues:${buildLiveLeaguesQuery(leagueIds)}`;
}

export function liveFixturesCacheKey(
  fixtureIds: Array<string | number>,
): string {
  return `${LIVE_CACHE_PREFIX}fixtures:${buildFixtureIdsQuery(fixtureIds)}`;
}

export function liveEventsCacheKey(fixtureId: string | number): string {
  const [id] = normalizePositiveIntegerIds([fixtureId], { maxCount: 1 });
  return `${LIVE_CACHE_PREFIX}events:${id}`;
}
