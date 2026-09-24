/**
 * PE-4 — Order-independent digest of materially used form/schedule evidence.
 *
 * DIGEST CONTRACT (v3 / PE-4G.1):
 * COMMITS TO (material):
 * - layer identity: version, scope, competition, season, cutoff, requestedLastN
 * - crossCompetitionBlind flag
 * - per-side last-N and all-prior match lines (result/GF/GA/venue/status)
 * - historical opponent + target common-baseline strength
 * - pairwise differential / quality
 * - historical expectation/residual status (unavailable reason; no invented nums)
 * - competition-scoped rest hours + rolling windows
 * - strength coverage counts
 * - last-N aggregate W/D/L + GF/GA
 *
 * MUST NOT DEPEND ON:
 * - input universe array order
 * - evidenceAcquiredAtUtc
 * - wall-clock execution time
 * - object key insertion order (canonical string payload)
 */

import { createHash } from "node:crypto";
import type {
  Pe4FormScheduleContextLayer,
  Pe4HistoricalExpectationEvidence,
  Pe4HistoricalResidualEvidence,
  Pe4OpponentStrengthEvidence,
  Pe4PairwiseHistoricalStrengthContext,
  Pe4PriorMatchSummary,
  Pe4SideEvidence,
  Pe4TargetStrengthEvidence,
} from "@/lib/prematch-decision/pe4-form-schedule/types";
import { PE4_FORM_SCHEDULE_LAYER_VERSION } from "@/lib/prematch-decision/pe4-form-schedule/types";

/** Bumped for PE-4G.1 two-sided historical strength + expectation contract. */
export const PE4_FORM_SCHEDULE_EVIDENCE_DIGEST_VERSION = "3" as const;

function opponentStrengthLine(o: Pe4OpponentStrengthEvidence): string {
  return [
    o.opponentTeamId,
    o.opponentStrengthCutoffUtc,
    o.opponentStrengthAvailable ? "1" : "0",
    o.opponentStrengthSource ?? "",
    o.opponentStrengthPlayed == null ? "" : String(o.opponentStrengthPlayed),
    o.opponentStrengthAsOfMatchKickoff == null
      ? ""
      : String(o.opponentStrengthAsOfMatchKickoff),
    o.unavailableReason ?? "",
    String(o.opponentStrengthReconstructionBase),
    o.opponentStrengthSemantics,
    o.comparableToVenueSpecificC0Elo ? "1" : "0",
  ].join("~");
}

function targetStrengthLine(t: Pe4TargetStrengthEvidence): string {
  return [
    t.targetTeamId,
    t.targetStrengthCutoffUtc,
    t.targetStrengthAvailable ? "1" : "0",
    t.targetStrengthSource ?? "",
    t.targetStrengthPlayed == null ? "" : String(t.targetStrengthPlayed),
    t.targetStrengthAsOfMatchKickoff == null
      ? ""
      : String(t.targetStrengthAsOfMatchKickoff),
    t.unavailableReason ?? "",
    String(t.targetStrengthReconstructionBase),
    t.targetStrengthSemantics,
    t.comparableToVenueSpecificC0Elo ? "1" : "0",
  ].join("~");
}

function pairwiseLine(p: Pe4PairwiseHistoricalStrengthContext): string {
  return [
    p.targetTeamId,
    p.opponentTeamId,
    p.historicalCutoffUtc,
    p.pairwiseAvailable ? "1" : "0",
    p.targetCommonIndex == null ? "" : String(p.targetCommonIndex),
    p.opponentCommonIndex == null ? "" : String(p.opponentCommonIndex),
    p.strengthDifferential == null ? "" : String(p.strengthDifferential),
    p.targetVenueRole,
    p.targetSource ?? "",
    p.opponentSource ?? "",
    p.targetPlayed == null ? "" : String(p.targetPlayed),
    p.opponentPlayed == null ? "" : String(p.opponentPlayed),
    String(p.commonReconstructionBase),
    p.semantics,
    p.qualityKind,
    p.unavailableReason ?? "",
  ].join("~");
}

function expectationLine(e: Pe4HistoricalExpectationEvidence): string {
  return [
    e.status,
    e.reason,
    e.modelVersion,
    e.expectedHomeWinProbability == null
      ? ""
      : String(e.expectedHomeWinProbability),
    e.expectedPointsFromTargetPerspective == null
      ? ""
      : String(e.expectedPointsFromTargetPerspective),
    e.expectedGoalDifferenceFromTargetPerspective == null
      ? ""
      : String(e.expectedGoalDifferenceFromTargetPerspective),
  ].join("~");
}

function residualLine(r: Pe4HistoricalResidualEvidence): string {
  return [
    r.status,
    r.reason,
    r.resultResidual == null ? "" : String(r.resultResidual),
    r.goalDifferenceResidual == null ? "" : String(r.goalDifferenceResidual),
    r.resultEncodingScheme ?? "",
  ].join("~");
}

function matchLine(match: Pe4PriorMatchSummary): string {
  return [
    match.fixtureId,
    match.kickoffUtc,
    match.opponentTeamId,
    match.venueRole,
    String(match.goalsFor),
    String(match.goalsAgainst),
    match.result,
    match.status,
    match.competitionId,
    match.season,
    opponentStrengthLine(match.opponentStrength),
    targetStrengthLine(match.targetStrength),
    pairwiseLine(match.pairwiseHistoricalStrength),
    expectationLine(match.historicalExpectation),
    residualLine(match.historicalResidual),
  ].join("|");
}

function sideDigestPayload(side: Pe4SideEvidence): string {
  const lastNLines = side.lastNMatches.map(matchLine).sort((a, b) =>
    a.localeCompare(b),
  );
  const allPriorLines = side.orderedCompletedPriors
    .map(matchLine)
    .sort((a, b) => a.localeCompare(b));
  const coverage = side.opponentStrengthCoverage;
  const tCov = side.targetStrengthCoverage;
  const pCov = side.pairwiseStrengthCoverage;
  const windows = side.competitionScopedMatchesInWindows;
  return [
    `team=${side.teamId}`,
    `requestedLastN=${side.requestedLastN}`,
    `actualLastN=${side.actualLastN}`,
    `prevKickoff=${side.previousCompletedKickoffUtc ?? ""}`,
    `compRestHours=${
      side.competitionScopedRestHoursSincePreviousCompleted == null
        ? ""
        : String(side.competitionScopedRestHoursSincePreviousCompleted)
    }`,
    `w7=${windows.previous7Days}`,
    `w14=${windows.previous14Days}`,
    `w21=${windows.previous21Days}`,
    `w28=${windows.previous28Days}`,
    `oppCov=${coverage.selectedMatchCount}/${coverage.catalogueCount}/${coverage.basePriorCount}/${coverage.unavailableCount}`,
    `tgtCov=${tCov.selectedMatchCount}/${tCov.catalogueCount}/${tCov.basePriorCount}/${tCov.unavailableCount}`,
    `pairCov=${pCov.selectedMatchCount}/${pCov.catalogueCatalogueCount}/${pCov.catalogueBasePriorCount}/${pCov.basePriorCatalogueCount}/${pCov.basePriorBasePriorCount}/${pCov.unavailableCount}`,
    `lastN=${lastNLines.join(";")}`,
    `allPriors=${allPriorLines.join(";")}`,
    `aggLastN=${side.lastNAggregate.wins}/${side.lastNAggregate.draws}/${side.lastNAggregate.losses}:${side.lastNAggregate.goalsFor}-${side.lastNAggregate.goalsAgainst}`,
  ].join("\n");
}

export function digestPe4FormScheduleEvidence(input: {
  historicalCutoffUtc: string;
  competitionId: string;
  season: string;
  requestedLastN: number;
  home: Pe4SideEvidence;
  away: Pe4SideEvidence;
}): string {
  const payload = [
    `v${PE4_FORM_SCHEDULE_EVIDENCE_DIGEST_VERSION}`,
    `layer=${PE4_FORM_SCHEDULE_LAYER_VERSION}`,
    `scope=competition_season`,
    `cutoff=${input.historicalCutoffUtc}`,
    `comp=${input.competitionId}`,
    `season=${input.season}`,
    `requestedLastN=${input.requestedLastN}`,
    `crossCompetitionBlind=true`,
    "---HOME---",
    sideDigestPayload(input.home),
    "---AWAY---",
    sideDigestPayload(input.away),
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function digestPe4FormScheduleContextLayer(
  layer: Pe4FormScheduleContextLayer,
): string {
  return digestPe4FormScheduleEvidence({
    historicalCutoffUtc: layer.historicalCutoffUtc,
    competitionId: layer.universeKey.competitionId,
    season: layer.universeKey.season,
    requestedLastN: layer.requestedLastN,
    home: layer.home,
    away: layer.away,
  });
}
