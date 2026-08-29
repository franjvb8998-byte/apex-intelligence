/**
 * Betting math for Copilot — same definitions as Match Center EV.
 * Fair odds = 1 / model probability. Never invent a price.
 */

import { expectedValue } from "@/lib/match-center/markets";

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

/** Model probability − implied probability. */
export function edgePp(
  modelProbability: number | null | undefined,
  decimalOdds: number | null | undefined,
): number | null {
  const implied = impliedProbability(decimalOdds);
  if (
    implied == null ||
    modelProbability == null ||
    !Number.isFinite(modelProbability)
  ) {
    return null;
  }
  return modelProbability - implied;
}

export { expectedValue };
