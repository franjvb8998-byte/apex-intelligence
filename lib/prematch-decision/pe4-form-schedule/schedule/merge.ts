/**
 * PE-4F — Pure offline merge of competition-scoped PE-4 evidence with
 * cross-competition schedule evidence.
 *
 * Does NOT change recent-form WDL/GF/GA, opponent-adjusted form, or PE-3 C0.
 * Affects schedule/rest/congestion interpretation only.
 * Not wired into production lifecycle.
 */

import type { Pe4FormScheduleContextLayer } from "@/lib/prematch-decision/pe4-form-schedule/types";
import type { Pe4CrossCompScheduleSideEvidence } from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

export const PE4_CROSS_COMP_SCHEDULE_SOURCE =
  "cross_competition_team_schedule_pe4f" as const;

export const PE4_COMPETITION_SCOPED_SCHEDULE_SOURCE =
  "competition_season_universe_pe4b" as const;

export type Pe4ScheduleEvidenceSource =
  | typeof PE4_CROSS_COMP_SCHEDULE_SOURCE
  | typeof PE4_COMPETITION_SCOPED_SCHEDULE_SOURCE
  | "mixed_fallback";

export type Pe4MergedFormScheduleEvidence = {
  /** Unchanged competition-scoped PE-4B/C/D layer (form + opponent intact). */
  competitionScopedLayer: Pe4FormScheduleContextLayer;
  homeSchedule: Pe4CrossCompScheduleSideEvidence | null;
  awaySchedule: Pe4CrossCompScheduleSideEvidence | null;
  /**
   * False only when BOTH sides have congestionWindowComplete and
   * crossCompetitionBlind === false on each side.
   */
  crossCompetitionBlind: boolean;
  scheduleEvidenceSource: Pe4ScheduleEvidenceSource;
  /** True when at least one side fell back to competition-scoped blindness. */
  usedCompetitionScopedFallback: boolean;
  mergeNotes: {
    recentFormUnchanged: true;
    opponentAdjustedUnchanged: true;
    pe3C0Unchanged: true;
    scheduleOnlyMerge: true;
  };
};

function sideBlind(
  side: Pe4CrossCompScheduleSideEvidence | null,
): boolean {
  if (side == null) return true;
  return side.crossCompetitionBlind;
}

/**
 * Combine competition-scoped layer with optional per-side cross-comp schedule.
 * Missing/failed cross-comp sides keep blindness=true (competition-scoped fallback).
 */
export function mergePe4CompetitionScopedWithCrossCompSchedule(input: {
  competitionScopedLayer: Pe4FormScheduleContextLayer;
  homeSchedule: Pe4CrossCompScheduleSideEvidence | null;
  awaySchedule: Pe4CrossCompScheduleSideEvidence | null;
}): Pe4MergedFormScheduleEvidence {
  const { competitionScopedLayer, homeSchedule, awaySchedule } = input;
  const homeBlind = sideBlind(homeSchedule);
  const awayBlind = sideBlind(awaySchedule);
  const crossCompetitionBlind = homeBlind || awayBlind;
  const usedCompetitionScopedFallback =
    homeSchedule == null ||
    awaySchedule == null ||
    homeBlind ||
    awayBlind;

  let scheduleEvidenceSource: Pe4ScheduleEvidenceSource;
  if (homeSchedule != null && awaySchedule != null && !crossCompetitionBlind) {
    scheduleEvidenceSource = PE4_CROSS_COMP_SCHEDULE_SOURCE;
  } else if (homeSchedule == null && awaySchedule == null) {
    scheduleEvidenceSource = PE4_COMPETITION_SCOPED_SCHEDULE_SOURCE;
  } else {
    scheduleEvidenceSource = "mixed_fallback";
  }

  return {
    competitionScopedLayer,
    homeSchedule,
    awaySchedule,
    crossCompetitionBlind,
    scheduleEvidenceSource,
    usedCompetitionScopedFallback,
    mergeNotes: {
      recentFormUnchanged: true,
      opponentAdjustedUnchanged: true,
      pe3C0Unchanged: true,
      scheduleOnlyMerge: true,
    },
  };
}

/**
 * Compact provenance fragment for pe4_form_schedule_v1 extension (offline).
 * Does not include secrets or raw provider payloads.
 */
export type Pe4CrossCompScheduleProvenanceFragment = {
  sourceTransition: Pe4ScheduleEvidenceSource;
  crossCompetitionBlind: boolean;
  usedCompetitionScopedFallback: boolean;
  home: Pe4CrossCompScheduleSideEvidence | null;
  away: Pe4CrossCompScheduleSideEvidence | null;
};

export function buildPe4CrossCompScheduleProvenanceFragment(
  merged: Pe4MergedFormScheduleEvidence,
): Pe4CrossCompScheduleProvenanceFragment {
  return {
    sourceTransition: merged.scheduleEvidenceSource,
    crossCompetitionBlind: merged.crossCompetitionBlind,
    usedCompetitionScopedFallback: merged.usedCompetitionScopedFallback,
    home: merged.homeSchedule,
    away: merged.awaySchedule,
  };
}
