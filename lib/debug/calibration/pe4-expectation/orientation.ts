/**
 * PE-4G.5 — Expected points (derived from 1X2) + venue-role orientation.
 */

import type { OneXTwoProb } from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { Pe4VenueRole } from "@/lib/prematch-decision/pe4-form-schedule/types";

export type TargetOrientedOneXTwo = {
  targetWinP: number;
  targetDrawP: number;
  targetLossP: number;
};

export function expectedHomePoints(p: OneXTwoProb): number {
  return 3 * p.HOME + 1 * p.DRAW;
}

export function expectedAwayPoints(p: OneXTwoProb): number {
  return 3 * p.AWAY + 1 * p.DRAW;
}

/**
 * Orient canonical HOME-row 1X2 to target team venue role.
 * Orientation only — no new venue coefficients.
 */
export function orientToTarget(
  homeOriented: OneXTwoProb,
  targetVenueRole: Pe4VenueRole,
): TargetOrientedOneXTwo {
  if (targetVenueRole === "HOME") {
    return {
      targetWinP: homeOriented.HOME,
      targetDrawP: homeOriented.DRAW,
      targetLossP: homeOriented.AWAY,
    };
  }
  return {
    targetWinP: homeOriented.AWAY,
    targetDrawP: homeOriented.DRAW,
    targetLossP: homeOriented.HOME,
  };
}

export function expectedTargetPoints(oriented: TargetOrientedOneXTwo): number {
  return 3 * oriented.targetWinP + 1 * oriented.targetDrawP;
}

export type RealizedResult = "WIN" | "DRAW" | "LOSS";

export function realizedTargetPoints(result: RealizedResult): number {
  if (result === "WIN") return 3;
  if (result === "DRAW") return 1;
  return 0;
}

/**
 * Dimensionally coherent points residual.
 * GD residual remains UNAVAILABLE for 1X2-only expectation.
 */
export function resultResidualPoints(
  realized: RealizedResult,
  expectedPoints: number,
): number {
  return realizedTargetPoints(realized) - expectedPoints;
}

export const GOAL_DIFFERENCE_RESIDUAL_STATUS = "UNAVAILABLE" as const;
export const GOAL_DIFFERENCE_RESIDUAL_REASON =
  "expectation_is_1x2_based_no_expected_gd" as const;
