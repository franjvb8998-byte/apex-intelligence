/**
 * Map ApexMatchBundle rows into season-universe provider rows for PE-3C/E loaders.
 * Pure — no provider I/O (except injected fetchBundles / page transport).
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import {
  createSeasonUniverseLoaderFromCompletePages,
  createSeasonUniverseLoaderFromProviderFetch,
  type SeasonUniverseLoader,
  type SeasonUniverseProviderRow,
} from "@/lib/prematch-lifecycle/season-universe/acquisition";
import type { SeasonUniversePageTransport } from "@/lib/prematch-lifecycle/season-universe/complete-fetch";
import type { SeasonUniverseKey } from "@/lib/prematch-lifecycle/season-universe/season-resolution";
import { vendorLeagueIdFromCompetitionId } from "@/lib/prematch-lifecycle/season-universe/vendor-league-id";

export function mapApexBundleToSeasonUniverseRow(
  bundle: ApexMatchBundle,
  key: SeasonUniverseKey,
): SeasonUniverseProviderRow | null {
  const fixtureId = canonicalPrematchFixtureId(
    bundle.match.externalRefs[0]?.externalId ?? bundle.match.id,
  );
  if (!fixtureId) return null;
  const competitionId = bundle.league?.id?.trim();
  const season = bundle.league?.season?.trim();
  if (!competitionId || !season) return null;
  if (competitionId !== key.competitionId || season !== key.season) {
    return null;
  }
  const homeGoals =
    bundle.match.score.periods?.ft?.home ?? bundle.match.score.home;
  const awayGoals =
    bundle.match.score.periods?.ft?.away ?? bundle.match.score.away;
  return {
    fixtureId,
    kickoffUtc: bundle.match.kickoffAt,
    homeTeamId: bundle.homeTeam.id,
    awayTeamId: bundle.awayTeam.id,
    competitionId,
    season,
    status: bundle.match.vendorStatusShort ?? String(bundle.match.status),
    homeGoals: homeGoals == null ? null : homeGoals,
    awayGoals: awayGoals == null ? null : awayGoals,
  };
}

/**
 * Build a SeasonUniverseLoader from an injected fixture-list fetch (single shot).
 * Prefer createSeasonUniverseLoaderFromPagedTransport for production completeness.
 */
export function createSeasonUniverseLoaderFromBundles(
  fetchBundles: (key: SeasonUniverseKey) => Promise<readonly ApexMatchBundle[]>,
): SeasonUniverseLoader {
  return createSeasonUniverseLoaderFromProviderFetch(async (key) => {
    const bundles = await fetchBundles(key);
    const rows: SeasonUniverseProviderRow[] = [];
    for (const bundle of bundles) {
      const row = mapApexBundleToSeasonUniverseRow(bundle, key);
      if (row) rows.push(row);
    }
    return rows;
  });
}

/**
 * Production-capable paged loader: validates APEX→vendor league id mapping
 * before any page fetch (fail closed; no all-leagues fallback).
 */
export function createSeasonUniverseLoaderFromPagedTransport(
  transport: SeasonUniversePageTransport,
): SeasonUniverseLoader {
  const complete = createSeasonUniverseLoaderFromCompletePages(transport);
  return async (key) => {
    const vendorLeagueId = vendorLeagueIdFromCompetitionId(key.competitionId);
    if (!vendorLeagueId) {
      return {
        ok: false,
        key,
        reason: "invalid_vendor_league_id",
        httpRequests: 0,
      };
    }
    return complete(key);
  };
}

/**
 * Resolve vendor league id for a season key or fail closed.
 * Used by adapters before any HTTP call.
 */
export function requireVendorLeagueIdForSeasonKey(
  key: SeasonUniverseKey,
):
  | { ok: true; vendorLeagueId: string }
  | { ok: false; reason: "invalid_vendor_league_id" } {
  const vendorLeagueId = vendorLeagueIdFromCompetitionId(key.competitionId);
  if (!vendorLeagueId) {
    return { ok: false, reason: "invalid_vendor_league_id" };
  }
  return { ok: true, vendorLeagueId };
}
