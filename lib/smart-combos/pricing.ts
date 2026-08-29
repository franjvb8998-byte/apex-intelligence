/**
 * Accumulator pricing on top of Decision Engine probabilities.
 * Uses the same EV / implied / Kelly identities as single bets.
 */

import {
  expectedValue,
  impliedProbability,
  quarterKelly,
} from "@/lib/match-rating/pricing";
import type { ComboLeg } from "@/lib/smart-combos/types";

export function combinedDecimalOdds(legs: ComboLeg[]): number | null {
  if (legs.length === 0) return null;
  let product = 1;
  for (const leg of legs) {
    if (leg.decimalOdds == null || !Number.isFinite(leg.decimalOdds) || leg.decimalOdds <= 1) {
      return null;
    }
    product *= leg.decimalOdds;
  }
  return product;
}

export function productProbability(
  values: Array<number | null | undefined>,
): number | null {
  if (values.length === 0) return null;
  let product = 1;
  for (const value of values) {
    if (value == null || !Number.isFinite(value) || value <= 0 || value >= 1) {
      return null;
    }
    product *= value;
  }
  return product;
}

export function independentApexProbability(legs: ComboLeg[]): number | null {
  return productProbability(legs.map((leg) => leg.apexProbability));
}

export function comboImpliedProbability(legs: ComboLeg[]): number | null {
  return impliedProbability(combinedDecimalOdds(legs));
}

export function comboExpectedValue(
  apexProbability: number | null,
  combinedOdds: number | null,
): number | null {
  return expectedValue(apexProbability ?? 0, combinedOdds);
}

export function comboQuarterKelly(
  apexProbability: number | null,
  combinedOdds: number | null,
): number | null {
  if (apexProbability == null) return null;
  return quarterKelly(apexProbability, combinedOdds);
}

export function weakestLeg(legs: ComboLeg[]): ComboLeg | null {
  if (legs.length === 0) return null;
  return [...legs].sort((a, b) => {
    const pa = a.apexProbability ?? 0;
    const pb = b.apexProbability ?? 0;
    if (pa !== pb) return pa - pb;
    return a.score - b.score;
  })[0]!;
}
