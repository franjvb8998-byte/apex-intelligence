/**
 * Production catalogue (C0) Elo geometry — single shared pure helper.
 *
 * Used by resolveEloWithProvenance and PE-3A prematch reconstruction.
 * Do not tune constants here without an explicit calibration decision.
 */

export const CATALOGUE_ELO_CONSTANT_OFFSET = -80;
export const CATALOGUE_ELO_WIN_RATE_COEFFICIENT = 220;
export const CATALOGUE_ELO_GD_COEFFICIENT = 2.5;
export const CATALOGUE_ELO_GD_CLAMP = 30;

/** Role bases for missing-stat / reconstruction fallback (production). */
export const PRODUCTION_HOME_ELO_BASE = 1580;
export const PRODUCTION_AWAY_ELO_BASE = 1520;

/**
 * Catalogue Elo when played > 0:
 *   Math.round(base - 80 + winRate * 220 + clamp(GD, ±30) * 2.5)
 *
 * Caller must only invoke when played > 0 (base_prior path skips this map).
 */
export function catalogueEloFromPlayedStats(input: {
  base: number;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
}): number {
  const winRate = input.wins / input.played;
  const goalDiff = input.goalsFor - input.goalsAgainst;
  const clampedDiff = Math.max(
    -CATALOGUE_ELO_GD_CLAMP,
    Math.min(CATALOGUE_ELO_GD_CLAMP, goalDiff),
  );
  return Math.round(
    input.base +
      CATALOGUE_ELO_CONSTANT_OFFSET +
      winRate * CATALOGUE_ELO_WIN_RATE_COEFFICIENT +
      clampedDiff * CATALOGUE_ELO_GD_COEFFICIENT,
  );
}
