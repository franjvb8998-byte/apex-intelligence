/**
 * GOALS-1E — Opponent-quality normalization and adjustment factors.
 *
 * Common-baseline strength is a GENERIC team-quality index (not separate
 * attack/defense). Used as a proxy for opponent quality only.
 *
 * Orientation (beta >= 0):
 * - ATTACK: scoring vs stronger opponents inflates contribution (exp(+beta*z))
 * - DEFENSE: conceding vs stronger opponents deflates penalty (exp(-beta*z))
 *
 * Neutral z=0 or beta=0 => factor = 1.
 * base_prior / unavailable => factor = 1 (explicit low-info policy).
 */

import {
  GOALS_G3_NORMALIZATION_SCALE,
  type GoalsG3Beta,
} from "@/lib/debug/calibration/goals/g3/protocol";
import type { GoalsG3OpponentStrengthSource } from "@/lib/debug/calibration/goals/g3/opponent-attach";

export type GoalsG3Normalization = {
  reconstructionBase: 1580;
  empiricalCenter: number;
  scale: typeof GOALS_G3_NORMALIZATION_SCALE;
  centerSource: "mean_catalogue_opponent_strength_dev_2023";
  catalogueN: number;
};

export function normalizeOpponentQuality(
  strength: number,
  center: number,
  scale: number = GOALS_G3_NORMALIZATION_SCALE,
): number {
  if (!Number.isFinite(strength) || !Number.isFinite(center) || scale <= 0) {
    throw new Error("Invalid normalizeOpponentQuality inputs");
  }
  return (strength - center) / scale;
}

/**
 * Attack factor: >1 when opponent stronger than empirical center (beta>0).
 */
export function attackAdjustmentFactor(input: {
  strength: number | null;
  source: GoalsG3OpponentStrengthSource;
  beta: number;
  center: number;
  scale?: number;
}): number {
  if (input.source !== "catalogue" || input.strength == null) {
    return 1;
  }
  if (input.beta === 0) return 1;
  const z = normalizeOpponentQuality(
    input.strength,
    input.center,
    input.scale ?? GOALS_G3_NORMALIZATION_SCALE,
  );
  const f = Math.exp(input.beta * z);
  if (!Number.isFinite(f) || f <= 0) {
    throw new Error(`Non-finite attack adjustment: ${f}`);
  }
  return f;
}

/**
 * Defense factor: <1 when opponent stronger (conceding less damning).
 */
export function defenseAdjustmentFactor(input: {
  strength: number | null;
  source: GoalsG3OpponentStrengthSource;
  beta: number;
  center: number;
  scale?: number;
}): number {
  if (input.source !== "catalogue" || input.strength == null) {
    return 1;
  }
  if (input.beta === 0) return 1;
  const z = normalizeOpponentQuality(
    input.strength,
    input.center,
    input.scale ?? GOALS_G3_NORMALIZATION_SCALE,
  );
  const f = Math.exp(-input.beta * z);
  if (!Number.isFinite(f) || f <= 0) {
    throw new Error(`Non-finite defense adjustment: ${f}`);
  }
  return f;
}

export function makeAdjustmentFns(input: {
  beta: GoalsG3Beta | number;
  center: number;
  scale?: number;
}): {
  attackAdjustmentFn: (opp: {
    strength: number | null;
    source: GoalsG3OpponentStrengthSource;
  }) => number;
  defenseAdjustmentFn: (opp: {
    strength: number | null;
    source: GoalsG3OpponentStrengthSource;
  }) => number;
} {
  const scale = input.scale ?? GOALS_G3_NORMALIZATION_SCALE;
  return {
    attackAdjustmentFn: (opp) =>
      attackAdjustmentFactor({
        ...opp,
        beta: input.beta,
        center: input.center,
        scale,
      }),
    defenseAdjustmentFn: (opp) =>
      defenseAdjustmentFactor({
        ...opp,
        beta: input.beta,
        center: input.center,
        scale,
      }),
  };
}

/** Mean of catalogue-source opponent strengths (development audit). */
export function computeEmpiricalOpponentCenter(
  strengths: readonly number[],
): { center: number; n: number } {
  if (strengths.length === 0) {
    // Fallback only if no catalogue evidence — still distinct from 1580 claim.
    return { center: 1580, n: 0 };
  }
  const sum = strengths.reduce((a, b) => a + b, 0);
  return { center: sum / strengths.length, n: strengths.length };
}
