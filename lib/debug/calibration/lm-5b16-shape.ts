/**
 * Sprint 5B.16 local HIGH_EQUAL mass diagnostic.
 * Debug-only. Not a production policy. Not a tuner. No search.
 */

export const LOCAL_MASS_VERSION = "apex.calibration.local-high-equal.5b16.v1";

export const LM_PANELS = ["D0", "D1"] as const;
export type LmPanelId = (typeof LM_PANELS)[number];

export const MULTIPLIER_ARMS = ["M0", "M1", "M2", "M3"] as const;
export type MultiplierArm = (typeof MULTIPLIER_ARMS)[number];

export const TRANSFER_ARMS = ["T1"] as const;
export type TransferArm = (typeof TRANSFER_ARMS)[number];

export const LOCAL_MASS_ARMS = ["M0", "M1", "M2", "M3", "T1"] as const;
export type LocalMassArm = (typeof LOCAL_MASS_ARMS)[number];

/** Predeclared HIGH_EQUAL multipliers. Not a search. M0 is the control. */
export const HIGH_EQUAL_MULTIPLIERS = {
  M0: 1,
  M1: 1.1,
  M2: 1.25,
  M3: 1.5,
} as const;

export const TRANSFER_HIGH_EQUAL_RELATIVE = 0.1;

export const LOW_EQUAL_RATE_FLAG = 0.01;

export function isHighEqualCell(homeGoals: number, awayGoals: number): boolean {
  return homeGoals === awayGoals && homeGoals >= 2;
}

export function isLowEqualCell(homeGoals: number, awayGoals: number): boolean {
  return homeGoals === awayGoals && (homeGoals === 0 || homeGoals === 1);
}

export function isNonDrawCell(homeGoals: number, awayGoals: number): boolean {
  return homeGoals !== awayGoals;
}

export function multiplierFor(arm: LocalMassArm): number | null {
  if (arm === "T1") return null;
  return HIGH_EQUAL_MULTIPLIERS[arm];
}
