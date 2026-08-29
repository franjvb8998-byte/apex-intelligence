/**
 * Pure helpers for Scoring Engine v2. No I/O.
 */

import type { ScoringComponent, ScoringComponentKey } from "@/lib/scoring-engine/types";
import {
  SCORING_COMPONENT_LABELS,
  SCORING_WEIGHTS,
} from "@/lib/scoring-engine/weights";

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

export function component(
  key: ScoringComponentKey,
  value: number | null,
  note: string,
): ScoringComponent {
  if (value == null || !Number.isFinite(value)) {
    return {
      key,
      label: SCORING_COMPONENT_LABELS[key],
      weight: SCORING_WEIGHTS[key],
      score: null,
      available: false,
      note,
    };
  }
  return {
    key,
    label: SCORING_COMPONENT_LABELS[key],
    weight: SCORING_WEIGHTS[key],
    score: roundScore(value),
    available: true,
    note,
  };
}

export function coverageBlend(
  parts: Array<{ score: number | null; weight: number; available?: boolean }>,
): { score: number; coverage: number } {
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  const available = parts.filter(
    (part) =>
      part.score != null &&
      Number.isFinite(part.score) &&
      part.weight > 0 &&
      part.available !== false,
  );
  const used = available.reduce((sum, part) => sum + part.weight, 0);
  const blended =
    used > 0
      ? available.reduce((sum, part) => sum + (part.score ?? 0) * part.weight, 0) /
        used
      : 0;
  return {
    score: blended,
    coverage: total > 0 ? used / total : 0,
  };
}
