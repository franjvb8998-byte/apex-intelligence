/**
 * PE-4 — Pure offline competition-scoped form & schedule evidence extractor.
 *
 * PE-4B: form / schedule raw evidence.
 * PE-4C: historical-time opponent strength (C0 composition as of kickoff(M)).
 *
 * Reuses PE-3 temporal helpers / completed-status / dedupe / C0 resolve.
 * Does not call providers, mutate C0 reconstruction, or adjust PE odds.
 */

import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";
import {
  dedupeUniverseByFixtureId,
  isEligiblePriorKickoff,
  parseKickoffUtcMillis,
} from "@/lib/match-center/prematch-strength/reconstruct-evidence";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import { digestPe4FormScheduleEvidence } from "@/lib/prematch-decision/pe4-form-schedule/digest";
import {
  attachHistoricalTwoSidedStrength,
  createPe4OpponentStrengthMemo,
  summarizeOpponentStrengthCoverage,
  summarizePairwiseStrengthCoverage,
  summarizeTargetStrengthCoverage,
} from "@/lib/prematch-decision/pe4-form-schedule/opponent-strength";
import {
  PE4_HISTORICAL_EXPECTATION_MODEL_VERSION,
  PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import {
  PE4_DEFAULT_LAST_N,
  PE4_FORM_SCHEDULE_LAYER_VERSION,
  PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON,
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  PE4_OPPONENT_STRENGTH_SEMANTICS,
  type Pe4ComponentStatus,
  type Pe4FormScheduleExtractInput,
  type Pe4FormScheduleExtractResult,
  type Pe4FormScheduleTarget,
  type Pe4HistoricalExpectationEvidence,
  type Pe4HistoricalResidualEvidence,
  type Pe4MatchResult,
  type Pe4OpponentAdjustedCoverageKind,
  type Pe4OpponentStrengthCoverage,
  type Pe4OpponentStrengthEvidence,
  type Pe4PairwiseHistoricalStrengthContext,
  type Pe4PriorMatchSummary,
  type Pe4RollingWindowCounts,
  type Pe4SideAggregate,
  type Pe4SideEvidence,
  type Pe4TargetStrengthEvidence,
  type Pe4VenueRole,
} from "@/lib/prematch-decision/pe4-form-schedule/types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function pendingOpponentStrength(
  opponentTeamId: string,
  matchKickoffUtc: string,
): Pe4OpponentStrengthEvidence {
  return {
    opponentTeamId,
    opponentStrengthAsOfMatchKickoff: null,
    opponentStrengthSource: null,
    opponentStrengthPlayed: null,
    opponentStrengthCutoffUtc: matchKickoffUtc,
    opponentStrengthAvailable: false,
    unavailableReason: "reconstruction_failed",
    opponentStrengthReconstructionBase: 1580,
    opponentStrengthSemantics: PE4_OPPONENT_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

function pendingTargetStrength(
  targetTeamId: string,
  matchKickoffUtc: string,
): Pe4TargetStrengthEvidence {
  return {
    targetTeamId,
    targetStrengthAsOfMatchKickoff: null,
    targetStrengthSource: null,
    targetStrengthPlayed: null,
    targetStrengthCutoffUtc: matchKickoffUtc,
    targetStrengthAvailable: false,
    unavailableReason: "reconstruction_failed",
    targetStrengthReconstructionBase: 1580,
    targetStrengthSemantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

function pendingPairwise(
  targetTeamId: string,
  opponentTeamId: string,
  venueRole: Pe4VenueRole,
  matchKickoffUtc: string,
): Pe4PairwiseHistoricalStrengthContext {
  return {
    targetTeamId,
    opponentTeamId,
    targetCommonIndex: null,
    opponentCommonIndex: null,
    strengthDifferential: null,
    targetVenueRole: venueRole,
    targetSource: null,
    opponentSource: null,
    targetPlayed: null,
    opponentPlayed: null,
    historicalCutoffUtc: matchKickoffUtc,
    commonReconstructionBase: 1580,
    semantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
    pairwiseAvailable: false,
    unavailableReason: "both_sides_unavailable",
    qualityKind: "unavailable",
  };
}

function pendingExpectation(): Pe4HistoricalExpectationEvidence {
  return {
    status: "UNAVAILABLE",
    reason: PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
    modelVersion: PE4_HISTORICAL_EXPECTATION_MODEL_VERSION,
    expectedHomeWinProbability: null,
    expectedDrawProbability: null,
    expectedAwayWinProbability: null,
    expectedPointsFromTargetPerspective: null,
    expectedGoalDifferenceFromTargetPerspective: null,
    expectedGoalsFor: null,
    expectedGoalsAgainst: null,
    auditNotes: {
      eloPoissonHybridNotReusable: true,
      hfaEntangledWithEngineInputs: true,
      commonBaselineNotVenueRoleElo: true,
      noArbitraryMappingEmitted: true,
    },
  };
}

function pendingResidual(): Pe4HistoricalResidualEvidence {
  return {
    status: "UNAVAILABLE",
    reason: "expectation_model_not_defined",
    resultResidual: null,
    goalDifferenceResidual: null,
    observedResultEncoding: null,
    resultEncodingScheme: null,
  };
}

function emptyAggregate(): Pe4SideAggregate {
  return {
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
}

function aggregateFromMatches(
  matches: readonly Pe4PriorMatchSummary[],
): Pe4SideAggregate {
  const agg = emptyAggregate();
  for (const match of matches) {
    agg.goalsFor += match.goalsFor;
    agg.goalsAgainst += match.goalsAgainst;
    if (match.result === "W") agg.wins += 1;
    else if (match.result === "L") agg.losses += 1;
    else agg.draws += 1;
  }
  agg.goalDifference = agg.goalsFor - agg.goalsAgainst;
  return agg;
}

function resultFromGoals(gf: number, ga: number): Pe4MatchResult {
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

function comparePriorsChronologically(
  a: Pe4PriorMatchSummary,
  b: Pe4PriorMatchSummary,
): number {
  const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (kickoff !== 0) return kickoff;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function compareUniverseChronologically(
  a: PrematchStrengthUniverseFixture,
  b: PrematchStrengthUniverseFixture,
): number {
  const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (kickoff !== 0) return kickoff;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function isValidTarget(target: Pe4FormScheduleTarget): boolean {
  if (!target.fixtureId || !target.homeTeamId || !target.awayTeamId) {
    return false;
  }
  if (!target.competitionId || !target.season) return false;
  if (target.homeTeamId === target.awayTeamId) return false;
  return parseKickoffUtcMillis(target.kickoffUtc) != null;
}

function isWellFormedUniverseRow(
  row: PrematchStrengthUniverseFixture,
): boolean {
  if (!row.fixtureId || typeof row.fixtureId !== "string") return false;
  if (!row.homeTeamId || !row.awayTeamId) return false;
  if (row.homeTeamId === row.awayTeamId) return false;
  if (!row.competitionId || !row.season) return false;
  if (typeof row.status !== "string" || row.status.length === 0) return false;
  if (parseKickoffUtcMillis(row.kickoffUtc) == null) return false;
  if (row.homeGoals == null || row.awayGoals == null) return false;
  if (!Number.isFinite(row.homeGoals) || !Number.isFinite(row.awayGoals)) {
    return false;
  }
  if (row.homeGoals < 0 || row.awayGoals < 0) return false;
  return true;
}

/**
 * Team-perspective prior if row is a valid completed prior for teamId
 * strictly before target kickoff within competition+season.
 * Opponent strength is attached later (PE-4C).
 */
export function tryBuildTeamPriorSummary(
  row: PrematchStrengthUniverseFixture,
  teamId: string,
  target: Pe4FormScheduleTarget,
): Pe4PriorMatchSummary | null {
  if (row.fixtureId === target.fixtureId) return null;
  if (row.competitionId !== target.competitionId) return null;
  if (row.season !== target.season) return null;
  if (!isEligiblePriorKickoff(row.kickoffUtc, target.kickoffUtc)) return null;
  if (!isCompletedPrematchEvidenceStatus(row.status)) return null;
  if (!isWellFormedUniverseRow(row)) return null;

  const isHome = row.homeTeamId === teamId;
  const isAway = row.awayTeamId === teamId;
  if (isHome === isAway) return null;

  const venueRole: Pe4VenueRole = isHome ? "HOME" : "AWAY";
  const goalsFor = isHome ? row.homeGoals! : row.awayGoals!;
  const goalsAgainst = isHome ? row.awayGoals! : row.homeGoals!;
  const opponentTeamId = isHome ? row.awayTeamId : row.homeTeamId;

  return {
    fixtureId: row.fixtureId,
    kickoffUtc: row.kickoffUtc,
    opponentTeamId,
    venueRole,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    result: resultFromGoals(goalsFor, goalsAgainst),
    status: row.status,
    competitionId: row.competitionId,
    season: row.season,
    opponentStrength: pendingOpponentStrength(opponentTeamId, row.kickoffUtc),
    targetStrength: pendingTargetStrength(teamId, row.kickoffUtc),
    pairwiseHistoricalStrength: pendingPairwise(
      teamId,
      opponentTeamId,
      venueRole,
      row.kickoffUtc,
    ),
    historicalExpectation: pendingExpectation(),
    historicalResidual: pendingResidual(),
  };
}

function countMatchesInWindow(
  ordered: readonly Pe4PriorMatchSummary[],
  targetMs: number,
  windowDays: number,
): number {
  const lower = targetMs - windowDays * MS_PER_DAY;
  let count = 0;
  for (const match of ordered) {
    const ms = parseKickoffUtcMillis(match.kickoffUtc);
    if (ms == null) continue;
    if (ms >= lower && ms < targetMs) count += 1;
  }
  return count;
}

function rollingWindows(
  ordered: readonly Pe4PriorMatchSummary[],
  targetKickoffUtc: string,
): Pe4RollingWindowCounts {
  const targetMs = parseKickoffUtcMillis(targetKickoffUtc);
  if (targetMs == null) {
    return {
      previous7Days: 0,
      previous14Days: 0,
      previous21Days: 0,
      previous28Days: 0,
    };
  }
  return {
    previous7Days: countMatchesInWindow(ordered, targetMs, 7),
    previous14Days: countMatchesInWindow(ordered, targetMs, 14),
    previous21Days: countMatchesInWindow(ordered, targetMs, 21),
    previous28Days: countMatchesInWindow(ordered, targetMs, 28),
  };
}

function restHours(
  previousKickoffUtc: string | null,
  targetKickoffUtc: string,
): number | null {
  if (previousKickoffUtc == null) return null;
  const prev = parseKickoffUtcMillis(previousKickoffUtc);
  const target = parseKickoffUtcMillis(targetKickoffUtc);
  if (prev == null || target == null) return null;
  return (target - prev) / MS_PER_HOUR;
}

function used(coverage?: Pe4OpponentAdjustedCoverageKind): Pe4ComponentStatus {
  return coverage ? { status: "USED", coverage } : { status: "USED" };
}

function unavailable(
  reason: Extract<Pe4ComponentStatus, { status: "UNAVAILABLE" }>["reason"],
): Pe4ComponentStatus {
  return { status: "UNAVAILABLE", reason };
}

function opponentAdjustedComponentStatus(
  coverage: Pe4OpponentStrengthCoverage,
): Pe4ComponentStatus {
  if (coverage.selectedMatchCount === 0) {
    return unavailable("no_completed_priors");
  }
  if (coverage.unavailableCount > 0) {
    return {
      status: "PARTIAL",
      reason: "some_historical_opponent_strength_unavailable",
      coverage,
    };
  }
  if (coverage.catalogueCount === coverage.selectedMatchCount) {
    return used("all_catalogue");
  }
  if (coverage.basePriorCount === coverage.selectedMatchCount) {
    return used("all_base_prior");
  }
  return used("mixed_catalogue_base_prior");
}

function buildSideEvidence(input: {
  teamId: string;
  orderedCompletedPriors: Pe4PriorMatchSummary[];
  requestedLastN: number;
  targetKickoffUtc: string;
}): Pe4SideEvidence {
  const ordered = [...input.orderedCompletedPriors].sort(
    comparePriorsChronologically,
  );
  const actualLastN = Math.min(input.requestedLastN, ordered.length);
  const lastNMatches =
    actualLastN === 0 ? [] : ordered.slice(ordered.length - actualLastN);

  const previous =
    ordered.length === 0 ? null : ordered[ordered.length - 1]!;
  const previousCompletedKickoffUtc = previous?.kickoffUtc ?? null;
  const hasPriors = ordered.length > 0;
  const opponentStrengthCoverage =
    summarizeOpponentStrengthCoverage(lastNMatches);
  const targetStrengthCoverage = summarizeTargetStrengthCoverage(lastNMatches);
  const pairwiseStrengthCoverage =
    summarizePairwiseStrengthCoverage(lastNMatches);

  return {
    teamId: input.teamId,
    requestedLastN: input.requestedLastN,
    actualLastN,
    orderedCompletedPriors: ordered,
    lastNMatches,
    selectedFixtureIds: lastNMatches.map((m) => m.fixtureId),
    lastNAggregate: aggregateFromMatches(lastNMatches),
    allCompletedAggregate: aggregateFromMatches(ordered),
    previousCompletedKickoffUtc,
    competitionScopedRestHoursSincePreviousCompleted: restHours(
      previousCompletedKickoffUtc,
      input.targetKickoffUtc,
    ),
    competitionScopedMatchesInWindows: rollingWindows(
      ordered,
      input.targetKickoffUtc,
    ),
    opponentStrengthCoverage,
    targetStrengthCoverage,
    pairwiseStrengthCoverage,
    components: {
      recentForm: hasPriors
        ? used()
        : unavailable("no_completed_priors"),
      venueRole: hasPriors
        ? used()
        : unavailable("no_completed_priors"),
      // Competition-season schedule only; layer.crossCompetitionBlind marks scope.
      scheduleCompetitionScoped: used(),
      trajectoryOrderedEvidence: hasPriors
        ? used()
        : unavailable("no_completed_priors"),
      opponentAdjustedForm: opponentAdjustedComponentStatus(
        opponentStrengthCoverage,
      ),
      trajectoryClassification: unavailable(
        "trajectory_classification_deferred",
      ),
    },
  };
}

/**
 * Extract PE-4 competition-scoped form & schedule evidence (incl. PE-4C).
 * Pure / deterministic / offline.
 */
export function extractPe4FormScheduleEvidence(
  input: Pe4FormScheduleExtractInput,
): Pe4FormScheduleExtractResult {
  const lastN = input.lastN ?? PE4_DEFAULT_LAST_N;
  if (
    !Number.isInteger(lastN) ||
    !Number.isFinite(lastN) ||
    lastN < 1
  ) {
    return {
      ok: false,
      reason: "invalid_last_n",
      message: "lastN must be a positive finite integer",
    };
  }

  if (!isValidTarget(input.target)) {
    return {
      ok: false,
      reason: "malformed_target",
      message: "Target fixture identity/kickoff is malformed",
    };
  }

  const deduped = dedupeUniverseByFixtureId(input.universe);
  if (!deduped.ok) {
    return {
      ok: false,
      reason: "conflicting_duplicate_fixture",
      fixtureId: deduped.fixtureId,
      message: `Conflicting duplicate fixture evidence (${deduped.fixtureId})`,
    };
  }

  const sortedUniverse = [...deduped.fixtures].sort(
    compareUniverseChronologically,
  );

  const homePriorsRaw: Pe4PriorMatchSummary[] = [];
  const awayPriorsRaw: Pe4PriorMatchSummary[] = [];
  for (const row of sortedUniverse) {
    const home = tryBuildTeamPriorSummary(
      row,
      input.target.homeTeamId,
      input.target,
    );
    if (home) homePriorsRaw.push(home);
    const away = tryBuildTeamPriorSummary(
      row,
      input.target.awayTeamId,
      input.target,
    );
    if (away) awayPriorsRaw.push(away);
  }

  const memo = createPe4OpponentStrengthMemo();
  const homePriors = attachHistoricalTwoSidedStrength(
    homePriorsRaw,
    input.target.homeTeamId,
    sortedUniverse,
    memo,
  );
  const awayPriors = attachHistoricalTwoSidedStrength(
    awayPriorsRaw,
    input.target.awayTeamId,
    sortedUniverse,
    memo,
  );

  const home = buildSideEvidence({
    teamId: input.target.homeTeamId,
    orderedCompletedPriors: homePriors,
    requestedLastN: lastN,
    targetKickoffUtc: input.target.kickoffUtc,
  });
  const away = buildSideEvidence({
    teamId: input.target.awayTeamId,
    orderedCompletedPriors: awayPriors,
    requestedLastN: lastN,
    targetKickoffUtc: input.target.kickoffUtc,
  });

  const evidenceAcquiredAtUtc =
    input.evidenceAcquiredAtUtc === undefined
      ? null
      : input.evidenceAcquiredAtUtc;

  const evidenceDigest = digestPe4FormScheduleEvidence({
    historicalCutoffUtc: input.target.kickoffUtc,
    competitionId: input.target.competitionId,
    season: input.target.season,
    requestedLastN: lastN,
    home,
    away,
  });

  return {
    ok: true,
    layer: {
      layerVersion: PE4_FORM_SCHEDULE_LAYER_VERSION,
      scope: PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON,
      historicalCutoffUtc: input.target.kickoffUtc,
      evidenceAcquiredAtUtc,
      universeKey: {
        competitionId: input.target.competitionId,
        season: input.target.season,
      },
      crossCompetitionBlind: true,
      requestedLastN: lastN,
      home,
      away,
      evidenceDigest,
      priorsInspected: input.universe.length,
      notes: {
        venueRoleIsCompetitionHomeAwayOnly: true,
        neutralGroundUnavailableInSeasonUniverse: true,
        opponentAdjustedForm: "historical_time_c0_evidence_pe4c",
        trajectoryClassification: "deferred",
        opponentStrengthCutoffRule:
          "kickoff_of_historical_match_M_strictly_before",
        opponentStrengthNeverUsesTargetKickoff: true,
        opponentStrengthSemantics: PE4_OPPONENT_STRENGTH_SEMANTICS,
        targetStrengthCutoffRule:
          "kickoff_of_historical_match_M_strictly_before",
        targetStrengthNeverUsesTargetKickoff: true,
        targetStrengthSemantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
        pairwiseHistoricalStrength:
          "common_baseline_differential_descriptive_only",
        historicalExpectationModel: "undefined_pending_compatible_mapping",
        historicalResidual: "unavailable_without_expectation_model",
        scheduleRestIsCompetitionSeasonOnly: true,
        competitionScopedRestIsNotGlobalRest: true,
      },
    },
  };
}
