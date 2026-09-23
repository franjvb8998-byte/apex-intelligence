/**
 * Season universe acquisition contract for PE-3C/E.
 *
 * Preferred transport: paged GET /fixtures?league&season (complete-fetch),
 * NOT /teams/statistics.
 *
 * PROVIDER TRUST BOUNDARY (residual — not solved by completeness):
 * A complete season envelope proves paging was fully walked. It does not prove
 * that prior fixture scores/status were frozen at historicalCutoffUtc; the
 * provider exposes live-corrected rows without historical snapshot metadata.
 * Tickets therefore store evidenceAcquiredAtUtc (lifecycle clock) + cutoff +
 * optional acceptedEvidenceDigest — never a fake provider snapshot time.
 */

import type {
  SeasonUniverseAcquireResult,
  SeasonUniverseLoader,
} from "@/lib/prematch-lifecycle/season-universe/run-scope-cache";
import type { SeasonUniverseKey } from "@/lib/prematch-lifecycle/season-universe/season-resolution";
import { isQuotaError } from "@/lib/repositories";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength";
import {
  fetchCompleteSeasonUniversePages,
  type SeasonUniversePageTransport,
} from "@/lib/prematch-lifecycle/season-universe/complete-fetch";

export type { SeasonUniverseLoader };
/**
 * Minimal normalized row a provider adapter must supply before PE-3A.
 * Deliberately flat so adapters cannot smuggle post-kickoff stats endpoints.
 */
export type SeasonUniverseProviderRow = {
  fixtureId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  competitionId: string;
  season: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export function normalizeSeasonUniverseRows(
  key: SeasonUniverseKey,
  rows: readonly SeasonUniverseProviderRow[],
  meta?: { httpRequests?: number },
): SeasonUniverseAcquireResult {
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      key,
      reason: "malformed_provider_response",
      httpRequests: meta?.httpRequests ?? 0,
    };
  }

  const fixtures: PrematchStrengthUniverseFixture[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      return {
        ok: false,
        key,
        reason: "malformed_provider_response",
        httpRequests: meta?.httpRequests ?? 0,
      };
    }
    if (
      !row.fixtureId ||
      !row.kickoffUtc ||
      !row.homeTeamId ||
      !row.awayTeamId ||
      !row.status
    ) {
      return {
        ok: false,
        key,
        reason: "malformed_provider_response",
        httpRequests: meta?.httpRequests ?? 0,
      };
    }
    if (row.competitionId !== key.competitionId || row.season !== key.season) {
      // Skip cross-key pollution rather than failing the whole season
      // (provider over-fetch). Rows must still be well-formed.
      continue;
    }
    fixtures.push({
      fixtureId: row.fixtureId,
      kickoffUtc: row.kickoffUtc,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      competitionId: row.competitionId,
      season: row.season,
      status: row.status,
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
    });
  }

  return {
    ok: true,
    key,
    fixtures,
    httpRequests: meta?.httpRequests ?? 0,
  };
}

/**
 * Build a loader that wraps a raw provider fetch.
 * Quota/rate-limit errors propagate; other throws → provider_failure.
 */
export function createSeasonUniverseLoaderFromProviderFetch(
  fetchRows: (key: SeasonUniverseKey) => Promise<readonly SeasonUniverseProviderRow[]>,
): SeasonUniverseLoader {
  return async (key) => {
    try {
      const rows = await fetchRows(key);
      return normalizeSeasonUniverseRows(key, rows, { httpRequests: 1 });
    } catch (error) {
      if (isQuotaError(error)) throw error;
      return {
        ok: false,
        key,
        reason: "provider_failure",
        httpRequests: 1,
      };
    }
  };
}

/**
 * Production-intended loader: bounded page walk with completeness proof.
 * Quota errors propagate from transport / page walk.
 */
export function createSeasonUniverseLoaderFromCompletePages(
  transport: SeasonUniversePageTransport,
): SeasonUniverseLoader {
  return async (key) => {
    try {
      const complete = await fetchCompleteSeasonUniversePages({
        key,
        transport,
      });
      if (!complete.ok) {
        return {
          ok: false,
          key: complete.key,
          reason: complete.reason,
          httpRequests: complete.httpRequests,
        };
      }
      return normalizeSeasonUniverseRows(key, complete.rows, {
        httpRequests: complete.httpRequests,
      });
    } catch (error) {
      if (isQuotaError(error)) throw error;
      return {
        ok: false,
        key,
        reason: "provider_failure",
        httpRequests: 0,
      };
    }
  };
}
