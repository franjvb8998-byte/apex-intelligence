/**
 * PE-4I.16 — Combine Path A + optional Path B + schedule/rest + provenance.
 */

import {
  digestFeatureVectorProvenance,
  type Pe4I15FeatureAvailabilitySummary,
  type Pe4I15FeatureVectorProvenance,
} from "@/lib/debug/calibration/pe4-as-of-t-features/provenance";
import { classifyHoldoutForResearch } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import { PE4I15_PROTOCOL_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PROTOCOL_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import {
  selectAsOfTHistory,
  type Pe4I16HistorySelection,
  type Pe4I16VenueFilter,
} from "@/lib/debug/calibration/pe4-as-of-t-features/history-selector";
import { buildUniversalNonXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import type { Pe4I16UniversalNonXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import { buildOptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import type { Pe4I16OptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import { buildScheduleRestFeatures } from "@/lib/debug/calibration/pe4-as-of-t-features/schedule-rest-features";
import type { Pe4I16ScheduleRestFeatures } from "@/lib/debug/calibration/pe4-as-of-t-features/schedule-rest-features";
import { joinOpponentStrengthAsOfKickoffM } from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";
import type { Pe4I16OpponentStrengthJoin } from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";
import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import type { Pe4I15WindowSpec } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";
import { getFeatureFamilySpec } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";

export type Pe4I16HomeAwaySplitVectors = {
  home: Pe4I16UniversalNonXgVector | null;
  away: Pe4I16UniversalNonXgVector | null;
  homeSelection: Pe4I16HistorySelection | null;
  awaySelection: Pe4I16HistorySelection | null;
};

export type Pe4I16AsOfTFeatureVector = {
  protocolVersion: typeof PE4I16_PROTOCOL_VERSION;
  teamId: string;
  targetFixtureId: string;
  targetKickoffUtc: string;
  windowId: Pe4I16HistorySelection["windowId"];
  venueFilter: Pe4I16VenueFilter;
  pathA: Pe4I16UniversalNonXgVector;
  pathB: Pe4I16OptionalXgVector;
  homeAwaySplits: Pe4I16HomeAwaySplitVectors;
  scheduleRest: Pe4I16ScheduleRestFeatures;
  opponentStrength: Pe4I16OpponentStrengthJoin;
  historySelection: Pe4I16HistorySelection;
  provenance: Pe4I15FeatureVectorProvenance;
  noMetricsComputed: true;
  providerCallsMade: 0;
};

function availabilityFor(
  selection: Pe4I16HistorySelection,
  familyId: Pe4I15FeatureAvailabilitySummary["familyId"],
  missingCount: number,
): Pe4I15FeatureAvailabilitySummary {
  const minObs = getFeatureFamilySpec(familyId).minObservations;
  const status =
    selection.observationCount >= minObs
      ? "AVAILABLE"
      : selection.observationCount > 0
        ? "PARTIAL"
        : "UNAVAILABLE";
  return {
    familyId,
    status,
    observationCount: selection.observationCount,
    missingCount,
  };
}

/**
 * Build a full as-of-T feature vector for one team/target/window.
 */
export function buildAsOfTFeatureVector(input: {
  teamId: string;
  teamHistory: readonly Pe4I16TeamPerspectiveRow[];
  target: { fixtureId: string; kickoffUtc: string };
  window: Pe4I15WindowSpec;
  venueFilter?: Pe4I16VenueFilter;
  minObservations?: number;
}): Pe4I15Result<Pe4I16AsOfTFeatureVector> {
  const minObs = input.minObservations ?? 3;
  const venueFilter = input.venueFilter ?? "all";

  const selection = selectAsOfTHistory({
    teamId: input.teamId,
    teamHistory: input.teamHistory,
    target: input.target,
    window: input.window,
    minObservations: minObs,
    venueFilter,
    rejectRegulationAmbiguous: true,
    excludeCalendar2025HoldoutOutcomes: true,
  });
  if (!selection.ok) return selection;

  const pathA = buildUniversalNonXgVector(selection.value.selected);
  const pathB = buildOptionalXgVector(selection.value.selected);

  const homeSel = selectAsOfTHistory({
    teamId: input.teamId,
    teamHistory: input.teamHistory,
    target: input.target,
    window: input.window,
    minObservations: minObs,
    venueFilter: "home",
    rejectRegulationAmbiguous: true,
    excludeCalendar2025HoldoutOutcomes: true,
  });
  const awaySel = selectAsOfTHistory({
    teamId: input.teamId,
    teamHistory: input.teamHistory,
    target: input.target,
    window: input.window,
    minObservations: minObs,
    venueFilter: "away",
    rejectRegulationAmbiguous: true,
    excludeCalendar2025HoldoutOutcomes: true,
  });

  const homeAwaySplits: Pe4I16HomeAwaySplitVectors = {
    home: homeSel.ok
      ? buildUniversalNonXgVector(homeSel.value.selected)
      : null,
    away: awaySel.ok
      ? buildUniversalNonXgVector(awaySel.value.selected)
      : null,
    homeSelection: homeSel.ok ? homeSel.value : null,
    awaySelection: awaySel.ok ? awaySel.value : null,
  };

  const scheduleRest = buildScheduleRestFeatures({
    teamHistory: input.teamHistory,
    targetKickoffUtc: input.target.kickoffUtc,
    targetFixtureId: input.target.fixtureId,
  });

  const opponentStrength = joinOpponentStrengthAsOfKickoffM({
    selectedHistory: selection.value.selected,
    targetKickoffUtc: input.target.kickoffUtc,
  });

  const holdoutClassification = classifyHoldoutForResearch({
    kickoffUtc: input.target.kickoffUtc,
  });

  const availability: Pe4I15FeatureAvailabilitySummary[] = [
    availabilityFor(
      selection.value,
      "recent_results",
      pathA.results.goalsMissingOrAmbiguous,
    ),
    availabilityFor(
      selection.value,
      "recent_performance",
      pathA.shotsFor.missingCount,
    ),
    {
      familyId: "home_away_splits",
      status:
        (homeAwaySplits.home?.observationCount ?? 0) >= minObs ||
        (homeAwaySplits.away?.observationCount ?? 0) >= minObs
          ? "AVAILABLE"
          : (homeAwaySplits.home?.observationCount ?? 0) +
                (homeAwaySplits.away?.observationCount ?? 0) >
              0
            ? "PARTIAL"
            : "UNAVAILABLE",
      observationCount:
        (homeAwaySplits.home?.observationCount ?? 0) +
        (homeAwaySplits.away?.observationCount ?? 0),
      missingCount: 0,
    },
    {
      familyId: "schedule_rest",
      status:
        scheduleRest.status === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
      observationCount: scheduleRest.priorMatchCount,
      missingCount: scheduleRest.status === "AVAILABLE" ? 0 : 1,
    },
    {
      familyId: "opponent_strength_join",
      status: opponentStrength.status,
      observationCount: opponentStrength.observationCount,
      missingCount:
        opponentStrength.status === "UNAVAILABLE"
          ? selection.value.observationCount
          : 0,
    },
    {
      familyId: "competition_context",
      status:
        selection.value.observationCount >= 1 ? "AVAILABLE" : "UNAVAILABLE",
      observationCount: selection.value.observationCount,
      missingCount: 0,
    },
  ];

  const provenance = digestFeatureVectorProvenance({
    targetFixtureId: input.target.fixtureId,
    targetKickoffUtc: input.target.kickoffUtc,
    evidenceCutoffUtc: input.target.kickoffUtc,
    historyFixtureIds: selection.value.selected.map((r) => r.fixtureId),
    windowId: selection.value.windowId,
    observationCount: selection.value.observationCount,
    competitionCounts: selection.value.competitionCounts,
    availability,
    holdoutClassification,
    protocolVersion: `${PE4I15_PROTOCOL_VERSION}+${PE4I16_PROTOCOL_VERSION}`,
  });

  return pe4I15Ok({
    protocolVersion: PE4I16_PROTOCOL_VERSION,
    teamId: input.teamId,
    targetFixtureId: input.target.fixtureId,
    targetKickoffUtc: input.target.kickoffUtc,
    windowId: selection.value.windowId,
    venueFilter,
    pathA,
    pathB,
    homeAwaySplits,
    scheduleRest,
    opponentStrength,
    historySelection: selection.value,
    provenance,
    noMetricsComputed: true,
    providerCallsMade: 0,
  });
}

/** Guard helper used by tests: Path A remains valid when xG absent. */
export function pathAValidWhenXgAbsent(
  vector: Pe4I16AsOfTFeatureVector,
): boolean {
  return (
    vector.pathA.path === "A_UNIVERSAL_NON_XG" &&
    vector.pathB.zeroFillUsed === false &&
    vector.pathB.populationShifted === false &&
    (vector.pathB.anyXgPresent === false
      ? vector.pathB.expectedGoalsFor.mean === null &&
        vector.pathB.expectedGoalsAgainst.mean === null
      : true)
  );
}

export function refuseBuildWhenTargetIsHoldoutForDev(input: {
  targetKickoffUtc: string;
}): Pe4I15Result<true> {
  const c = classifyHoldoutForResearch({ kickoffUtc: input.targetKickoffUtc });
  if (c === "calendar_2025_sealed_outcome") {
    return pe4I15Err(
      "calendar_2025_holdout_outcome_excluded",
      "demo_target_pool",
    );
  }
  return pe4I15Ok(true);
}
