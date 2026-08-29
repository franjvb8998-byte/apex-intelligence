/**
 * Quarter-Kelly snapped to 0 / 0.5 / 1 / 2 / 3 / 5%. Never above 5%.
 */

import { clamp } from "@/lib/decision-engine/math";
import type { ApexDecisionVerdictKind, ApexSizingBlock } from "@/lib/decision-engine/types";
import { MAX_STAKE_PCT, STAKE_STEPS } from "@/lib/decision-engine/weights";
import { quarterKelly } from "@/lib/match-rating/pricing";

export function snapStake(pct: number): (typeof STAKE_STEPS)[number] {
  const capped = clamp(pct, 0, MAX_STAKE_PCT);
  let best: (typeof STAKE_STEPS)[number] = 0;
  let dist = Number.POSITIVE_INFINITY;
  for (const step of STAKE_STEPS) {
    const d = Math.abs(step - capped);
    if (d < dist) {
      dist = d;
      best = step;
    }
  }
  return best;
}

export function evaluateSizing(input: {
  modelProbability: number;
  decimalOdds: number | null;
  verdict: ApexDecisionVerdictKind;
  expectedValue: number | null;
}): ApexSizingBlock {
  const kelly = quarterKelly(input.modelProbability, input.decimalOdds);
  const kellyPct = kelly == null ? null : kelly * 100;

  if (
    input.verdict === "avoid" ||
    input.verdict === "pass" ||
    input.expectedValue == null ||
    input.expectedValue <= 0
  ) {
    return {
      kellyFraction: kelly,
      kellyPct,
      stakePct: 0,
      stakeLabel: "0%",
    };
  }

  const raw = kellyPct == null || kellyPct <= 0 ? 0.5 : kellyPct;
  let stakePct = snapStake(raw);
  if (input.verdict === "lean_bet" && stakePct > 2) stakePct = 2;
  if (input.verdict === "strong_bet" && stakePct > 3) stakePct = 3;
  if (stakePct > MAX_STAKE_PCT) stakePct = MAX_STAKE_PCT;

  return {
    kellyFraction: kelly,
    kellyPct,
    stakePct,
    stakeLabel: `${stakePct}%`,
  };
}
