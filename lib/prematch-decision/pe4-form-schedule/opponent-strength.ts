/**
 * PE-4C / PE-4G.1 — Historical-time strength via PE-3 C0 composition.
 *
 * Opponent (PE-4C) and target (PE-4G.1) share resolveHistoricalCommonBaselineStrength.
 * Cutoff = kickoff(M); never uses target-fixture kickoff T.
 */

import {
  createPe4HistoricalStrengthMemo,
  PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
  PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID,
  resolveHistoricalCommonBaselineStrength,
  type Pe4HistoricalStrengthMemo,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import {
  resolvePe4HistoricalExpectationFromPairwise,
  resolvePe4HistoricalResidual,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { buildPe4PairwiseHistoricalStrengthContext } from "@/lib/prematch-decision/pe4-form-schedule/pairwise-strength";
import {
  PE4_OPPONENT_STRENGTH_SEMANTICS,
  type Pe4OpponentStrengthCoverage,
  type Pe4OpponentStrengthEvidence,
  type Pe4PairwiseStrengthCoverage,
  type Pe4PriorMatchSummary,
  type Pe4TargetStrengthCoverage,
  type Pe4TargetStrengthEvidence,
} from "@/lib/prematch-decision/pe4-form-schedule/types";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";

/** @deprecated Prefer PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID */
export const PE4C_OPPONENT_STRENGTH_SYNTHETIC_AWAY_ID =
  PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID;

export const PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE =
  PE4_COMMON_BASELINE_RECONSTRUCTION_BASE;

export type Pe4OpponentStrengthMemo = Pe4HistoricalStrengthMemo;

export function createPe4OpponentStrengthMemo(): Pe4OpponentStrengthMemo {
  return createPe4HistoricalStrengthMemo();
}

function toOpponentEvidence(
  teamId: string,
  raw: ReturnType<typeof resolveHistoricalCommonBaselineStrength>,
): Pe4OpponentStrengthEvidence {
  return {
    opponentTeamId: teamId,
    opponentStrengthAsOfMatchKickoff: raw.strengthAsOfCutoff,
    opponentStrengthSource: raw.source,
    opponentStrengthPlayed: raw.played,
    opponentStrengthCutoffUtc: raw.cutoffUtc,
    opponentStrengthAvailable: raw.available,
    unavailableReason:
      raw.unavailableReason === "invalid_team_id"
        ? "invalid_opponent_team_id"
        : raw.unavailableReason === "reconstruction_failed"
          ? "reconstruction_failed"
          : null,
    opponentStrengthReconstructionBase: raw.reconstructionBase,
    opponentStrengthSemantics: PE4_OPPONENT_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

function toTargetEvidence(
  teamId: string,
  raw: ReturnType<typeof resolveHistoricalCommonBaselineStrength>,
): Pe4TargetStrengthEvidence {
  return {
    targetTeamId: teamId,
    targetStrengthAsOfMatchKickoff: raw.strengthAsOfCutoff,
    targetStrengthSource: raw.source,
    targetStrengthPlayed: raw.played,
    targetStrengthCutoffUtc: raw.cutoffUtc,
    targetStrengthAvailable: raw.available,
    unavailableReason:
      raw.unavailableReason === "invalid_team_id"
        ? "invalid_target_team_id"
        : raw.unavailableReason === "reconstruction_failed"
          ? "reconstruction_failed"
          : null,
    targetStrengthReconstructionBase: raw.reconstructionBase,
    targetStrengthSemantics: PE4_OPPONENT_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

/**
 * Reconstruct opponent Y strength strictly before historical match M.
 */
export function resolveHistoricalOpponentStrength(input: {
  opponentTeamId: string;
  matchFixtureId: string;
  matchKickoffUtc: string;
  competitionId: string;
  season: string;
  universe: readonly PrematchStrengthUniverseFixture[];
  memo?: Pe4OpponentStrengthMemo;
}): Pe4OpponentStrengthEvidence {
  const raw = resolveHistoricalCommonBaselineStrength({
    teamId: input.opponentTeamId,
    matchFixtureId: input.matchFixtureId,
    matchKickoffUtc: input.matchKickoffUtc,
    competitionId: input.competitionId,
    season: input.season,
    universe: input.universe,
    memo: input.memo,
  });
  return toOpponentEvidence(input.opponentTeamId, raw);
}

/**
 * Reconstruct TARGET team X strength strictly before historical match M.
 */
export function resolveHistoricalTargetStrength(input: {
  targetTeamId: string;
  matchFixtureId: string;
  matchKickoffUtc: string;
  competitionId: string;
  season: string;
  universe: readonly PrematchStrengthUniverseFixture[];
  memo?: Pe4OpponentStrengthMemo;
}): Pe4TargetStrengthEvidence {
  const raw = resolveHistoricalCommonBaselineStrength({
    teamId: input.targetTeamId,
    matchFixtureId: input.matchFixtureId,
    matchKickoffUtc: input.matchKickoffUtc,
    competitionId: input.competitionId,
    season: input.season,
    universe: input.universe,
    memo: input.memo,
  });
  return toTargetEvidence(input.targetTeamId, raw);
}

/**
 * Attach opponent + target + pairwise + expectation/residual to priors.
 */
export function attachHistoricalTwoSidedStrength(
  matches: readonly Pe4PriorMatchSummary[],
  targetTeamId: string,
  universe: readonly PrematchStrengthUniverseFixture[],
  memo?: Pe4OpponentStrengthMemo,
): Pe4PriorMatchSummary[] {
  return matches.map((match) => {
    const opponentRaw = resolveHistoricalCommonBaselineStrength({
      teamId: match.opponentTeamId,
      matchFixtureId: match.fixtureId,
      matchKickoffUtc: match.kickoffUtc,
      competitionId: match.competitionId,
      season: match.season,
      universe,
      memo,
    });
    const targetRaw = resolveHistoricalCommonBaselineStrength({
      teamId: targetTeamId,
      matchFixtureId: match.fixtureId,
      matchKickoffUtc: match.kickoffUtc,
      competitionId: match.competitionId,
      season: match.season,
      universe,
      memo,
    });
    const opponentStrength = toOpponentEvidence(
      match.opponentTeamId,
      opponentRaw,
    );
    const targetStrength = toTargetEvidence(targetTeamId, targetRaw);
    const pairwiseHistoricalStrength = buildPe4PairwiseHistoricalStrengthContext(
      {
        targetTeamId,
        opponentTeamId: match.opponentTeamId,
        targetVenueRole: match.venueRole,
        target: targetRaw,
        opponent: opponentRaw,
        historicalCutoffUtc: match.kickoffUtc,
      },
    );
    const historicalExpectation =
      resolvePe4HistoricalExpectationFromPairwise(pairwiseHistoricalStrength);
    const historicalResidual = resolvePe4HistoricalResidual({
      expectation: historicalExpectation,
    });
    return {
      ...match,
      opponentStrength,
      targetStrength,
      pairwiseHistoricalStrength,
      historicalExpectation,
      historicalResidual,
    };
  });
}

/** @deprecated Prefer attachHistoricalTwoSidedStrength */
export function attachHistoricalOpponentStrength(
  matches: readonly Pe4PriorMatchSummary[],
  universe: readonly PrematchStrengthUniverseFixture[],
  memo?: Pe4OpponentStrengthMemo,
): Pe4PriorMatchSummary[] {
  return matches.map((match) => {
    // Without targetTeamId, only refresh opponent; leave other G.1 fields
    // as provided on the match (extract always uses two-sided attach).
    const opponentStrength = resolveHistoricalOpponentStrength({
      opponentTeamId: match.opponentTeamId,
      matchFixtureId: match.fixtureId,
      matchKickoffUtc: match.kickoffUtc,
      competitionId: match.competitionId,
      season: match.season,
      universe,
      memo,
    });
    return { ...match, opponentStrength };
  });
}

export function summarizeOpponentStrengthCoverage(
  selected: readonly Pe4PriorMatchSummary[],
): Pe4OpponentStrengthCoverage {
  let catalogueCount = 0;
  let basePriorCount = 0;
  let unavailableCount = 0;
  for (const match of selected) {
    const o = match.opponentStrength;
    if (!o.opponentStrengthAvailable) {
      unavailableCount += 1;
      continue;
    }
    if (o.opponentStrengthSource === "catalogue") catalogueCount += 1;
    else if (o.opponentStrengthSource === "base_prior") basePriorCount += 1;
    else unavailableCount += 1;
  }
  return {
    selectedMatchCount: selected.length,
    catalogueCount,
    basePriorCount,
    unavailableCount,
  };
}

export function summarizeTargetStrengthCoverage(
  selected: readonly Pe4PriorMatchSummary[],
): Pe4TargetStrengthCoverage {
  let catalogueCount = 0;
  let basePriorCount = 0;
  let unavailableCount = 0;
  for (const match of selected) {
    const t = match.targetStrength;
    if (!t.targetStrengthAvailable) {
      unavailableCount += 1;
      continue;
    }
    if (t.targetStrengthSource === "catalogue") catalogueCount += 1;
    else if (t.targetStrengthSource === "base_prior") basePriorCount += 1;
    else unavailableCount += 1;
  }
  return {
    selectedMatchCount: selected.length,
    catalogueCount,
    basePriorCount,
    unavailableCount,
  };
}

export function summarizePairwiseStrengthCoverage(
  selected: readonly Pe4PriorMatchSummary[],
): Pe4PairwiseStrengthCoverage {
  let catalogueCatalogueCount = 0;
  let catalogueBasePriorCount = 0;
  let basePriorCatalogueCount = 0;
  let basePriorBasePriorCount = 0;
  let unavailableCount = 0;
  for (const match of selected) {
    switch (match.pairwiseHistoricalStrength.qualityKind) {
      case "catalogue_catalogue":
        catalogueCatalogueCount += 1;
        break;
      case "catalogue_base_prior":
        catalogueBasePriorCount += 1;
        break;
      case "base_prior_catalogue":
        basePriorCatalogueCount += 1;
        break;
      case "base_prior_base_prior":
        basePriorBasePriorCount += 1;
        break;
      default:
        unavailableCount += 1;
    }
  }
  return {
    selectedMatchCount: selected.length,
    catalogueCatalogueCount,
    catalogueBasePriorCount,
    basePriorCatalogueCount,
    basePriorBasePriorCount,
    unavailableCount,
  };
}
