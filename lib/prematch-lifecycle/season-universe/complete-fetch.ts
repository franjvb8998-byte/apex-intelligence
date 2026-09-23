/**
 * Bounded complete league+season fixture acquisition (PE-3E).
 *
 * Provider trust residual (documented, not solved):
 * API-Football season lists expose current fixture state only — there is no
 * historical snapshot timestamp proving a prior row was never corrected after
 * a target kickoff. Completeness proves the list envelope is fully fetched;
 * it does NOT prove historical immutability of scores/status.
 *
 * Missing paging metadata → fail closed (never silently accept page 1 of N).
 */

import type { SeasonUniverseProviderRow } from "@/lib/prematch-lifecycle/season-universe/acquisition";
import type { SeasonUniverseKey } from "@/lib/prematch-lifecycle/season-universe/season-resolution";

/** Hard maximum HTTP pages per logical season-universe acquisition. */
export const SEASON_UNIVERSE_MAX_PAGES = 20;

export type SeasonUniversePaging = {
  current: number;
  total: number;
};

export type SeasonUniversePageEnvelope = {
  paging: SeasonUniversePaging | null | undefined;
  rows: readonly SeasonUniverseProviderRow[];
};

export type SeasonUniversePageTransport = {
  fetchPage: (
    key: SeasonUniverseKey,
    page: number,
  ) => Promise<SeasonUniversePageEnvelope>;
};

export type CompleteSeasonUniverseOk = {
  ok: true;
  key: SeasonUniverseKey;
  rows: SeasonUniverseProviderRow[];
  httpRequests: number;
  pagesFetched: number;
  pagingTotal: number;
};

export type CompleteSeasonUniverseErr = {
  ok: false;
  key: SeasonUniverseKey;
  reason:
    | "malformed_provider_response"
    | "incomplete_season_list"
    | "pagination_bound_exceeded"
    | "provider_failure"
    | "timeout";
  httpRequests: number;
};

export type CompleteSeasonUniverseResult =
  | CompleteSeasonUniverseOk
  | CompleteSeasonUniverseErr;

function readPaging(
  paging: SeasonUniversePaging | null | undefined,
): SeasonUniversePaging | null {
  if (
    paging == null ||
    !Number.isInteger(paging.current) ||
    !Number.isInteger(paging.total) ||
    paging.current < 1 ||
    paging.total < 1
  ) {
    return null;
  }
  return { current: paging.current, total: paging.total };
}

/**
 * Walk pages 1..total with a hard bound. Deterministic merge by append order;
 * callers dedupe/conflict-check afterward.
 */
export async function fetchCompleteSeasonUniversePages(input: {
  key: SeasonUniverseKey;
  transport: SeasonUniversePageTransport;
  maxPages?: number;
}): Promise<CompleteSeasonUniverseResult> {
  const maxPages = input.maxPages ?? SEASON_UNIVERSE_MAX_PAGES;
  let httpRequests = 0;
  const merged: SeasonUniverseProviderRow[] = [];

  httpRequests += 1;
  const first = await input.transport.fetchPage(input.key, 1);
  const paging = readPaging(first.paging);
  if (!paging) {
    return {
      ok: false,
      key: input.key,
      reason: "malformed_provider_response",
      httpRequests,
    };
  }
  if (paging.current !== 1) {
    return {
      ok: false,
      key: input.key,
      reason: "incomplete_season_list",
      httpRequests,
    };
  }
  if (paging.total > maxPages) {
    return {
      ok: false,
      key: input.key,
      reason: "pagination_bound_exceeded",
      httpRequests,
    };
  }

  merged.push(...first.rows);

  for (let page = 2; page <= paging.total; page += 1) {
    httpRequests += 1;
    const next = await input.transport.fetchPage(input.key, page);
    const nextPaging = readPaging(next.paging);
    if (!nextPaging) {
      return {
        ok: false,
        key: input.key,
        reason: "malformed_provider_response",
        httpRequests,
      };
    }
    if (nextPaging.current !== page || nextPaging.total !== paging.total) {
      return {
        ok: false,
        key: input.key,
        reason: "incomplete_season_list",
        httpRequests,
      };
    }
    merged.push(...next.rows);
  }

  return {
    ok: true,
    key: input.key,
    rows: merged,
    httpRequests,
    pagesFetched: paging.total,
    pagingTotal: paging.total,
  };
}
