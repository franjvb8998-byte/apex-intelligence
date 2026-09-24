/**
 * PE-4F — Competition load classification (conservative).
 * Does not invent taxonomy from display names.
 */

import type { Pe4CompetitionLoadClass } from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

/**
 * Classify a schedule row relative to the target fixture's competition.
 * Without reliable provider competition-type metadata, non-target comps
 * are UNKNOWN (not counted as competitive congestion/rest load).
 */
export function classifyPe4CompetitionLoad(input: {
  rowCompetitionId: string | null;
  targetCompetitionId: string;
}): Pe4CompetitionLoadClass {
  if (!input.rowCompetitionId) return "unknown";
  if (input.rowCompetitionId === input.targetCompetitionId) {
    return "target_competition";
  }
  // Explicit seam for future known-competition allowlists.
  // Until a canonical competition-type registry exists, treat as unknown.
  return "unknown";
}

/** Rows that may contribute to PE-4F semantic congestion/rest metrics. */
export function pe4LoadClassCountsTowardSemanticSchedule(
  loadClass: Pe4CompetitionLoadClass,
): boolean {
  return loadClass === "target_competition" || loadClass === "other_known_competition";
}
