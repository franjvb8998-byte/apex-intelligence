/**
 * Pricing helpers for Match Rating. Same definitions as Match Center / Copilot.
 */

import { expectedValue } from "@/lib/match-center/markets";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function fairOdds(modelProbability: number | null | undefined): number | null {
  if (
    modelProbability == null ||
    !Number.isFinite(modelProbability) ||
    modelProbability <= 0
  ) {
    return null;
  }
  return 1 / modelProbability;
}

export function impliedProbability(
  decimalOdds: number | null | undefined,
): number | null {
  if (decimalOdds == null || !Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    return null;
  }
  return 1 / decimalOdds;
}

/**
 * Quarter-Kelly: ((p × odds − 1) / (odds − 1)) × 0.25, clamped to [0, 1].
 * Null when odds are missing or not a valid betting price.
 */
export function quarterKelly(
  modelProbability: number,
  decimalOdds: number | null | undefined,
): number | null {
  if (
    decimalOdds == null ||
    !Number.isFinite(decimalOdds) ||
    decimalOdds <= 1 ||
    !Number.isFinite(modelProbability) ||
    modelProbability <= 0 ||
    modelProbability >= 1
  ) {
    return null;
  }
  const full = (modelProbability * decimalOdds - 1) / (decimalOdds - 1);
  if (!Number.isFinite(full) || full <= 0) return 0;
  return clamp(full * 0.25, 0, 1);
}

/** Map EV (−15% … +20%) onto a 0–10 value rating. Null without a price. */
export function valueRatingFromEv(ev: number | null): number | null {
  if (ev == null || !Number.isFinite(ev)) return null;
  return Math.round(clamp((ev + 0.15) / 0.35, 0, 1) * 100) / 10;
}

export { expectedValue };
