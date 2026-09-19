/**
 * Deterministic target selection. Not result- or APEX-aware.
 */

import { eligibleTargetGoals } from "@/lib/debug/calibration/reconstruct";
import { compareFixturesDeterministically } from "@/lib/debug/calibration/reconstruct";
import {
  MICROCOLLECTION_SELECTION_RULE,
  MICROCOLLECTION_TARGET_COUNT,
} from "@/lib/debug/calibration/micro-shape";
import type { ReconstructionFixture } from "@/lib/debug/calibration/types";

export function eligibleTargetFixtures(
  fixtures: readonly ReconstructionFixture[],
): ReconstructionFixture[] {
  return [...fixtures]
    .filter((fixture) => eligibleTargetGoals(fixture) != null)
    .sort(compareFixturesDeterministically);
}

export function evenlySpacedIndices(length: number, count: number): number[] {
  if (length <= 0 || count <= 0) return [];
  if (count >= length) {
    return Array.from({ length }, (_, index) => index);
  }
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    indices.push(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...new Set(indices)];
}

export function selectMicrocollectionTargets(
  fixtures: readonly ReconstructionFixture[],
  targetCount = MICROCOLLECTION_TARGET_COUNT,
): {
  targets: ReconstructionFixture[];
  selectionRule: string;
  eligibleCount: number;
} {
  const eligible = eligibleTargetFixtures(fixtures);
  const skip = Math.floor(eligible.length * 0.2);
  const window = eligible.slice(skip);
  const indices = evenlySpacedIndices(window.length, targetCount);
  return {
    targets: indices.map((index) => window[index]!),
    selectionRule: MICROCOLLECTION_SELECTION_RULE,
    eligibleCount: eligible.length,
  };
}
