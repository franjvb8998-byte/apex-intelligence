/**
 * PE-4 provenance helpers — attach/read/validate pe4_form_schedule_v1.
 * Does not alter PE-3 field semantics.
 */

import type { PrematchInputProvenance } from "@/lib/prematch-decision/input-provenance";
import { digestPe4FormScheduleContextLayer } from "@/lib/prematch-decision/pe4-form-schedule/digest";
import {
  PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY,
  PE4_FORM_SCHEDULE_LAYER_VERSION,
  PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON,
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  PE4_OPPONENT_STRENGTH_SEMANTICS,
  type Pe4ComponentStatus,
  type Pe4FormScheduleContextLayer,
  type Pe4HistoricalExpectationEvidence,
  type Pe4HistoricalResidualEvidence,
  type Pe4OpponentStrengthEvidence,
  type Pe4PairwiseHistoricalStrengthContext,
  type Pe4PriorMatchSummary,
  type Pe4SideAggregate,
  type Pe4SideEvidence,
  type Pe4TargetStrengthEvidence,
} from "@/lib/prematch-decision/pe4-form-schedule/types";
import { PE4_HISTORICAL_EXPECTATION_MODEL_VERSION } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isComponentStatus(value: unknown): value is Pe4ComponentStatus {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.status === "USED") return true;
  if (row.status === "PARTIAL" && typeof row.reason === "string") return true;
  if (row.status === "UNAVAILABLE" && typeof row.reason === "string") {
    return true;
  }
  return false;
}

function isOpponentStrength(
  value: unknown,
  matchKickoffUtc: string,
): value is Pe4OpponentStrengthEvidence {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.opponentTeamId !== "string") return false;
  if (typeof row.opponentStrengthCutoffUtc !== "string") return false;
  // Cutoff must equal the historical match kickoff.
  if (row.opponentStrengthCutoffUtc !== matchKickoffUtc) return false;
  if (typeof row.opponentStrengthAvailable !== "boolean") return false;
  if (!isFiniteNumber(row.opponentStrengthReconstructionBase)) return false;
  if (row.opponentStrengthSemantics !== PE4_OPPONENT_STRENGTH_SEMANTICS) {
    return false;
  }
  if (row.comparableToVenueSpecificC0Elo !== false) return false;
  if (
    !(
      row.opponentStrengthAsOfMatchKickoff === null ||
      isFiniteNumber(row.opponentStrengthAsOfMatchKickoff)
    )
  ) {
    return false;
  }
  if (
    !(
      row.opponentStrengthSource === null ||
      row.opponentStrengthSource === "catalogue" ||
      row.opponentStrengthSource === "base_prior"
    )
  ) {
    return false;
  }
  if (
    !(
      row.opponentStrengthPlayed === null ||
      isFiniteNumber(row.opponentStrengthPlayed)
    )
  ) {
    return false;
  }
  // Catalogue quality requires played > 0; base_prior requires played === 0
  // when available.
  if (row.opponentStrengthAvailable) {
    if (row.opponentStrengthSource === "catalogue") {
      if (
        !isFiniteNumber(row.opponentStrengthPlayed) ||
        row.opponentStrengthPlayed <= 0
      ) {
        return false;
      }
      if (!isFiniteNumber(row.opponentStrengthAsOfMatchKickoff)) return false;
    }
    if (row.opponentStrengthSource === "base_prior") {
      if (row.opponentStrengthPlayed !== 0) return false;
      if (!isFiniteNumber(row.opponentStrengthAsOfMatchKickoff)) return false;
    }
    if (row.unavailableReason != null) return false;
  } else if (typeof row.unavailableReason !== "string") {
    return false;
  }
  return true;
}

function isTargetStrength(
  value: unknown,
  matchKickoffUtc: string,
): value is Pe4TargetStrengthEvidence {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.targetTeamId !== "string") return false;
  if (typeof row.targetStrengthCutoffUtc !== "string") return false;
  if (row.targetStrengthCutoffUtc !== matchKickoffUtc) return false;
  if (typeof row.targetStrengthAvailable !== "boolean") return false;
  if (!isFiniteNumber(row.targetStrengthReconstructionBase)) return false;
  if (row.targetStrengthSemantics !== PE4_COMMON_BASELINE_STRENGTH_SEMANTICS) {
    return false;
  }
  if (row.comparableToVenueSpecificC0Elo !== false) return false;
  if (
    !(
      row.targetStrengthAsOfMatchKickoff === null ||
      isFiniteNumber(row.targetStrengthAsOfMatchKickoff)
    )
  ) {
    return false;
  }
  if (
    !(
      row.targetStrengthSource === null ||
      row.targetStrengthSource === "catalogue" ||
      row.targetStrengthSource === "base_prior"
    )
  ) {
    return false;
  }
  if (
    !(
      row.targetStrengthPlayed === null ||
      isFiniteNumber(row.targetStrengthPlayed)
    )
  ) {
    return false;
  }
  if (row.targetStrengthAvailable) {
    if (row.targetStrengthSource === "catalogue") {
      if (
        !isFiniteNumber(row.targetStrengthPlayed) ||
        row.targetStrengthPlayed <= 0
      ) {
        return false;
      }
      if (!isFiniteNumber(row.targetStrengthAsOfMatchKickoff)) return false;
    }
    if (row.targetStrengthSource === "base_prior") {
      if (row.targetStrengthPlayed !== 0) return false;
      if (!isFiniteNumber(row.targetStrengthAsOfMatchKickoff)) return false;
    }
    if (row.unavailableReason != null) return false;
  } else if (typeof row.unavailableReason !== "string") {
    return false;
  }
  return true;
}

function isPairwise(
  value: unknown,
  matchKickoffUtc: string,
): value is Pe4PairwiseHistoricalStrengthContext {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.targetTeamId !== "string") return false;
  if (typeof row.opponentTeamId !== "string") return false;
  if (row.historicalCutoffUtc !== matchKickoffUtc) return false;
  if (typeof row.pairwiseAvailable !== "boolean") return false;
  if (row.semantics !== PE4_COMMON_BASELINE_STRENGTH_SEMANTICS) return false;
  if (row.comparableToVenueSpecificC0Elo !== false) return false;
  if (!isFiniteNumber(row.commonReconstructionBase)) return false;
  if (row.targetVenueRole !== "HOME" && row.targetVenueRole !== "AWAY") {
    return false;
  }
  const qualities = new Set([
    "catalogue_catalogue",
    "catalogue_base_prior",
    "base_prior_catalogue",
    "base_prior_base_prior",
    "unavailable",
  ]);
  if (typeof row.qualityKind !== "string" || !qualities.has(row.qualityKind)) {
    return false;
  }
  if (row.pairwiseAvailable) {
    if (!isFiniteNumber(row.targetCommonIndex)) return false;
    if (!isFiniteNumber(row.opponentCommonIndex)) return false;
    if (!isFiniteNumber(row.strengthDifferential)) return false;
    if (
      row.strengthDifferential !==
      (row.targetCommonIndex as number) - (row.opponentCommonIndex as number)
    ) {
      return false;
    }
  } else if (row.strengthDifferential !== null) {
    return false;
  }
  return true;
}

function isExpectation(
  value: unknown,
): value is Pe4HistoricalExpectationEvidence {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.status !== "UNAVAILABLE") return false;
  if (typeof row.reason !== "string") return false;
  if (row.modelVersion !== PE4_HISTORICAL_EXPECTATION_MODEL_VERSION) {
    return false;
  }
  if (row.expectedHomeWinProbability !== null) return false;
  if (row.expectedDrawProbability !== null) return false;
  if (row.expectedAwayWinProbability !== null) return false;
  if (row.expectedPointsFromTargetPerspective !== null) return false;
  if (row.expectedGoalDifferenceFromTargetPerspective !== null) return false;
  if (row.expectedGoalsFor !== null) return false;
  if (row.expectedGoalsAgainst !== null) return false;
  const notes = row.auditNotes as Record<string, unknown> | null;
  if (
    notes == null ||
    notes.eloPoissonHybridNotReusable !== true ||
    notes.noArbitraryMappingEmitted !== true
  ) {
    return false;
  }
  return true;
}

function isResidual(value: unknown): value is Pe4HistoricalResidualEvidence {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.status !== "UNAVAILABLE") return false;
  if (typeof row.reason !== "string") return false;
  if (row.resultResidual !== null) return false;
  if (row.goalDifferenceResidual !== null) return false;
  if (row.observedResultEncoding !== null) return false;
  if (row.resultEncodingScheme !== null) return false;
  return true;
}

function isPriorSummary(value: unknown): value is Pe4PriorMatchSummary {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (
    !(
      typeof row.fixtureId === "string" &&
      typeof row.kickoffUtc === "string" &&
      typeof row.opponentTeamId === "string" &&
      (row.venueRole === "HOME" || row.venueRole === "AWAY") &&
      isFiniteNumber(row.goalsFor) &&
      isFiniteNumber(row.goalsAgainst) &&
      isFiniteNumber(row.goalDifference) &&
      (row.result === "W" || row.result === "D" || row.result === "L") &&
      typeof row.status === "string" &&
      typeof row.competitionId === "string" &&
      typeof row.season === "string"
    )
  ) {
    return false;
  }
  if (row.goalDifference !== row.goalsFor - row.goalsAgainst) return false;
  if (row.result === "W" && !(row.goalsFor > row.goalsAgainst)) return false;
  if (row.result === "L" && !(row.goalsFor < row.goalsAgainst)) return false;
  if (row.result === "D" && row.goalsFor !== row.goalsAgainst) return false;
  if (!isOpponentStrength(row.opponentStrength, row.kickoffUtc)) return false;
  if (!isTargetStrength(row.targetStrength, row.kickoffUtc)) return false;
  if (!isPairwise(row.pairwiseHistoricalStrength, row.kickoffUtc)) return false;
  if (!isExpectation(row.historicalExpectation)) return false;
  if (!isResidual(row.historicalResidual)) return false;
  return true;
}

function isAggregate(value: unknown): value is Pe4SideAggregate {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    isFiniteNumber(row.wins) &&
    isFiniteNumber(row.draws) &&
    isFiniteNumber(row.losses) &&
    isFiniteNumber(row.goalsFor) &&
    isFiniteNumber(row.goalsAgainst) &&
    isFiniteNumber(row.goalDifference) &&
    row.wins >= 0 &&
    row.draws >= 0 &&
    row.losses >= 0
  );
}

function aggregateMatchesPlayed(agg: Pe4SideAggregate): number {
  return agg.wins + agg.draws + agg.losses;
}

function isSideEvidence(value: unknown): value is Pe4SideEvidence {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.teamId !== "string") return false;
  if (!isFiniteNumber(row.requestedLastN) || !isFiniteNumber(row.actualLastN)) {
    return false;
  }
  if (row.requestedLastN < 1 || row.actualLastN < 0) return false;
  if (row.actualLastN > row.requestedLastN) return false;
  if (!Array.isArray(row.orderedCompletedPriors)) return false;
  if (!Array.isArray(row.lastNMatches)) return false;
  if (!Array.isArray(row.selectedFixtureIds)) return false;
  if (!row.orderedCompletedPriors.every(isPriorSummary)) return false;
  if (!row.lastNMatches.every(isPriorSummary)) return false;
  if (!row.selectedFixtureIds.every((id) => typeof id === "string")) {
    return false;
  }
  if (row.lastNMatches.length !== row.actualLastN) return false;
  if (row.selectedFixtureIds.length !== row.actualLastN) return false;
  for (let i = 0; i < row.lastNMatches.length; i += 1) {
    if (row.selectedFixtureIds[i] !== row.lastNMatches[i]!.fixtureId) {
      return false;
    }
  }
  if (!isAggregate(row.lastNAggregate) || !isAggregate(row.allCompletedAggregate)) {
    return false;
  }
  if (aggregateMatchesPlayed(row.lastNAggregate) !== row.actualLastN) {
    return false;
  }
  if (
    aggregateMatchesPlayed(row.allCompletedAggregate) !==
    row.orderedCompletedPriors.length
  ) {
    return false;
  }

  const cov = row.opponentStrengthCoverage as Record<string, unknown> | null;
  if (
    cov == null ||
    !isFiniteNumber(cov.selectedMatchCount) ||
    !isFiniteNumber(cov.catalogueCount) ||
    !isFiniteNumber(cov.basePriorCount) ||
    !isFiniteNumber(cov.unavailableCount)
  ) {
    return false;
  }
  if (cov.selectedMatchCount !== row.actualLastN) return false;
  if (
    cov.catalogueCount + cov.basePriorCount + cov.unavailableCount !==
    cov.selectedMatchCount
  ) {
    return false;
  }

  const tCov = row.targetStrengthCoverage as Record<string, unknown> | null;
  if (
    tCov == null ||
    !isFiniteNumber(tCov.selectedMatchCount) ||
    !isFiniteNumber(tCov.catalogueCount) ||
    !isFiniteNumber(tCov.basePriorCount) ||
    !isFiniteNumber(tCov.unavailableCount)
  ) {
    return false;
  }
  if (tCov.selectedMatchCount !== row.actualLastN) return false;

  const pCov = row.pairwiseStrengthCoverage as Record<string, unknown> | null;
  if (
    pCov == null ||
    !isFiniteNumber(pCov.selectedMatchCount) ||
    !isFiniteNumber(pCov.catalogueCatalogueCount) ||
    !isFiniteNumber(pCov.catalogueBasePriorCount) ||
    !isFiniteNumber(pCov.basePriorCatalogueCount) ||
    !isFiniteNumber(pCov.basePriorBasePriorCount) ||
    !isFiniteNumber(pCov.unavailableCount)
  ) {
    return false;
  }
  if (pCov.selectedMatchCount !== row.actualLastN) return false;

  const windows = row.competitionScopedMatchesInWindows as
    | Record<string, unknown>
    | null;
  if (
    windows == null ||
    !isFiniteNumber(windows.previous7Days) ||
    !isFiniteNumber(windows.previous14Days) ||
    !isFiniteNumber(windows.previous21Days) ||
    !isFiniteNumber(windows.previous28Days)
  ) {
    return false;
  }
  if (
    !(
      row.competitionScopedRestHoursSincePreviousCompleted === null ||
      isFiniteNumber(row.competitionScopedRestHoursSincePreviousCompleted)
    )
  ) {
    return false;
  }

  const components = row.components as Record<string, unknown> | null;
  if (components == null || typeof components !== "object") return false;
  if (
    !isComponentStatus(components.recentForm) ||
    !isComponentStatus(components.venueRole) ||
    !isComponentStatus(components.scheduleCompetitionScoped) ||
    !isComponentStatus(components.trajectoryOrderedEvidence) ||
    !isComponentStatus(components.opponentAdjustedForm) ||
    !isComponentStatus(components.trajectoryClassification)
  ) {
    return false;
  }
  return true;
}

/**
 * Structural + consistency validation for pe4_form_schedule_v1.
 */
export function isPe4FormScheduleContextLayer(
  value: unknown,
): value is Pe4FormScheduleContextLayer {
  if (value == null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.layerVersion !== PE4_FORM_SCHEDULE_LAYER_VERSION) return false;
  if (row.scope !== PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON) return false;
  if (typeof row.historicalCutoffUtc !== "string") return false;
  if (Number.isNaN(Date.parse(row.historicalCutoffUtc))) return false;
  if (
    !(
      row.evidenceAcquiredAtUtc === null ||
      typeof row.evidenceAcquiredAtUtc === "string"
    )
  ) {
    return false;
  }
  const key = row.universeKey as Record<string, unknown> | null;
  if (
    key == null ||
    typeof key.competitionId !== "string" ||
    typeof key.season !== "string"
  ) {
    return false;
  }
  // PE-4D competition-only evidence must never claim complete rest.
  if (row.crossCompetitionBlind !== true) return false;
  if (!isFiniteNumber(row.requestedLastN) || row.requestedLastN < 1) {
    return false;
  }
  if (!isSideEvidence(row.home) || !isSideEvidence(row.away)) return false;
  if (typeof row.evidenceDigest !== "string") return false;
  if (!/^[a-f0-9]{64}$/.test(row.evidenceDigest)) return false;
  if (!isFiniteNumber(row.priorsInspected)) return false;
  const notes = row.notes as Record<string, unknown> | null;
  if (
    notes == null ||
    notes.opponentAdjustedForm !== "historical_time_c0_evidence_pe4c" ||
    notes.opponentStrengthNeverUsesTargetKickoff !== true ||
    notes.opponentStrengthSemantics !== PE4_OPPONENT_STRENGTH_SEMANTICS ||
    notes.targetStrengthNeverUsesTargetKickoff !== true ||
    notes.targetStrengthSemantics !== PE4_COMMON_BASELINE_STRENGTH_SEMANTICS ||
    notes.historicalExpectationModel !==
      "undefined_pending_compatible_mapping" ||
    notes.historicalResidual !== "unavailable_without_expectation_model" ||
    notes.scheduleRestIsCompetitionSeasonOnly !== true ||
    notes.competitionScopedRestIsNotGlobalRest !== true
  ) {
    return false;
  }
  // Digest must match recomputation (material evidence integrity).
  try {
    const recomputed = digestPe4FormScheduleContextLayer(
      row as unknown as Pe4FormScheduleContextLayer,
    );
    if (recomputed !== row.evidenceDigest) return false;
  } catch {
    return false;
  }
  return true;
}

export function readPe4FormScheduleContextLayer(
  provenance: PrematchInputProvenance | null | undefined,
): Pe4FormScheduleContextLayer | null {
  if (provenance == null) return null;
  const raw = provenance.contextLayers[PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY];
  if (!isPe4FormScheduleContextLayer(raw)) return null;
  return raw;
}

/**
 * Return a new provenance object with the PE-4 layer set.
 * Does not mutate input. Leaves all PE-3 fields unchanged.
 */
export function withPe4FormScheduleContextLayer(
  provenance: PrematchInputProvenance,
  layer: Pe4FormScheduleContextLayer,
): PrematchInputProvenance {
  return {
    ...provenance,
    contextLayers: {
      ...provenance.contextLayers,
      [PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY]: layer,
    },
  };
}
