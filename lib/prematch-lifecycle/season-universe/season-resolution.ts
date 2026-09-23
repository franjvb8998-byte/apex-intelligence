/**
 * Authoritative season + competition resolution for PE-3B/C.
 * Never invents season from calendar year.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";

export type SeasonUniverseKey = {
  competitionId: string;
  season: string;
};

export type SeasonResolutionResult =
  | { ok: true; key: SeasonUniverseKey; seasonRaw: string }
  | {
      ok: false;
      reason: "missing_competition" | "missing_season" | "invalid_season";
    };

function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve league+season from an ApexMatchBundle.
 * Uses bundle.league.id and bundle.league.season only.
 */
export function resolveSeasonUniverseKeyFromBundle(
  bundle: ApexMatchBundle,
): SeasonResolutionResult {
  const competitionId = nonEmpty(bundle.league?.id ?? null);
  if (!competitionId) {
    return { ok: false, reason: "missing_competition" };
  }
  const seasonRaw = nonEmpty(bundle.league?.season ?? null);
  if (!seasonRaw) {
    return { ok: false, reason: "missing_season" };
  }
  // Reject obviously non-authoritative placeholders; do not invent.
  if (seasonRaw === "unknown" || seasonRaw === "null") {
    return { ok: false, reason: "invalid_season" };
  }
  return {
    ok: true,
    key: { competitionId, season: seasonRaw },
    seasonRaw,
  };
}

export function seasonUniverseCacheKey(key: SeasonUniverseKey): string {
  return `${key.competitionId}::${key.season}`;
}
