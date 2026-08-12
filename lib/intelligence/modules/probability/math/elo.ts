import type { OutcomeProbability } from "@/lib/intelligence/types";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";

/**
 * Classic Elo expected score (two-outcome).
 *
 * E_home = 1 / (1 + 10^((R_away - (R_home + HFA)) / F))
 *
 * where:
 * - R_home, R_away: Elo ratings
 * - HFA: home-field advantage in Elo points
 * - F: rating scale factor (classically 400)
 */
export function eloWinExpectancy(input: {
  homeElo: number;
  awayElo: number;
  homeAdvantageElo: number;
  scale?: number;
}): number {
  const scale = input.scale ?? 400;
  const adjustedHome = input.homeElo + input.homeAdvantageElo;
  const exponent = (input.awayElo - adjustedHome) / scale;
  return 1 / (1 + 10 ** exponent);
}

/**
 * Map Elo ratings to expected goals (λ) for a Poisson goal model.
 *
 * λ_home = μ_home * 10^((R_home - R_away) / S) * γ
 * λ_away = μ_away * 10^((R_away - R_home) / S)
 *
 * where:
 * - μ_home, μ_away: league baseline expected goals (home/away)
 * - S: Elo→goals scale (higher S ⇒ milder effect of rating gaps)
 * - γ: multiplicative home-advantage on goals (typically ~1.05–1.15 if HFA
 *      is not already fully encoded in μ_home)
 *
 * TODO(rating-history): replace static Elo inputs with time-weighted ratings
 * from match results once a rating store exists.
 */
export function eloToExpectedGoals(input: {
  homeElo: number;
  awayElo: number;
  baseHomeGoals: number;
  baseAwayGoals: number;
  eloGoalScale: number;
  homeGoalsAdvantage: number;
}): { lambdaHome: number; lambdaAway: number } {
  const diff = input.homeElo - input.awayElo;
  const ratio = 10 ** (diff / input.eloGoalScale);

  const lambdaHome =
    input.baseHomeGoals * ratio * input.homeGoalsAdvantage;
  const lambdaAway = input.baseAwayGoals / ratio;

  return {
    lambdaHome: clampLambda(lambdaHome),
    lambdaAway: clampLambda(lambdaAway),
  };
}

function clampLambda(lambda: number): number {
  // Keep Poisson mass numerically stable for the truncated score grid.
  return Math.min(Math.max(lambda, 0.05), 6);
}

/**
 * Convert Elo win expectancy into a three-way (1X2) distribution.
 *
 * 1. Two-way: p_home_2 = E_home, p_away_2 = 1 - E_home
 * 2. Insert draw mass that peaks when teams are equal:
 *      P_draw_raw = D_base * exp(-|Δ| / D_decay)
 *    where Δ = R_home + HFA - R_away
 * 3. Scale the two-way win probs into the remaining mass and normalize.
 *
 * This is a pragmatic Elo→1X2 bridge; the hybrid engine blends it with
 * Poisson-marginalized 1X2 for the final output.
 */
export function eloToOneXTwo(input: {
  homeElo: number;
  awayElo: number;
  homeAdvantageElo: number;
  drawBase: number;
  drawDecay: number;
  scale?: number;
}): OutcomeProbability {
  const scale = input.scale ?? 400;
  const winExpectancyHome = eloWinExpectancy({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    homeAdvantageElo: input.homeAdvantageElo,
    scale,
  });

  const delta =
    input.homeElo + input.homeAdvantageElo - input.awayElo;
  const drawRaw =
    input.drawBase * Math.exp(-Math.abs(delta) / input.drawDecay);

  const remaining = Math.max(0, 1 - drawRaw);
  const home = remaining * winExpectancyHome;
  const away = remaining * (1 - winExpectancyHome);

  return normalizeOutcomeProbability({
    home,
    draw: drawRaw,
    away,
  });
}
