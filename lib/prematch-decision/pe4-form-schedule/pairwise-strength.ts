/**
 * PE-4G.1 — Pairwise historical common-baseline strength context for match M.
 */

import {
  PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
  type Pe4HistoricalCommonBaselineStrength,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import {
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  type Pe4PairwiseHistoricalStrengthContext,
  type Pe4PairwiseStrengthQualityKind,
  type Pe4VenueRole,
} from "@/lib/prematch-decision/pe4-form-schedule/types";
import type { PrematchStrengthEloSource } from "@/lib/match-center/prematch-strength/types";

function qualityKind(
  target: Pe4HistoricalCommonBaselineStrength,
  opponent: Pe4HistoricalCommonBaselineStrength,
): Pe4PairwiseStrengthQualityKind {
  if (!target.available || !opponent.available) return "unavailable";
  const t = target.source;
  const o = opponent.source;
  if (t === "catalogue" && o === "catalogue") return "catalogue_catalogue";
  if (t === "catalogue" && o === "base_prior") return "catalogue_base_prior";
  if (t === "base_prior" && o === "catalogue") return "base_prior_catalogue";
  if (t === "base_prior" && o === "base_prior") return "base_prior_base_prior";
  return "unavailable";
}

export function buildPe4PairwiseHistoricalStrengthContext(input: {
  targetTeamId: string;
  opponentTeamId: string;
  targetVenueRole: Pe4VenueRole;
  target: Pe4HistoricalCommonBaselineStrength;
  opponent: Pe4HistoricalCommonBaselineStrength;
  historicalCutoffUtc: string;
}): Pe4PairwiseHistoricalStrengthContext {
  const { target, opponent } = input;
  const pairwiseAvailable =
    target.available &&
    opponent.available &&
    target.strengthAsOfCutoff != null &&
    opponent.strengthAsOfCutoff != null &&
    target.cutoffUtc === input.historicalCutoffUtc &&
    opponent.cutoffUtc === input.historicalCutoffUtc;

  let unavailableReason: Pe4PairwiseHistoricalStrengthContext["unavailableReason"] =
    null;
  if (!pairwiseAvailable) {
    if (!target.available && !opponent.available) {
      unavailableReason = "both_sides_unavailable";
    } else if (!target.available) {
      unavailableReason = "target_historical_strength_unavailable";
    } else if (!opponent.available) {
      unavailableReason = "opponent_historical_strength_unavailable";
    } else {
      unavailableReason = "pairwise_differential_unavailable";
    }
  }

  const strengthDifferential = pairwiseAvailable
    ? target.strengthAsOfCutoff! - opponent.strengthAsOfCutoff!
    : null;

  return {
    targetTeamId: input.targetTeamId,
    opponentTeamId: input.opponentTeamId,
    targetCommonIndex: target.strengthAsOfCutoff,
    opponentCommonIndex: opponent.strengthAsOfCutoff,
    strengthDifferential,
    targetVenueRole: input.targetVenueRole,
    targetSource: (target.source ?? null) as PrematchStrengthEloSource | null,
    opponentSource: (opponent.source ??
      null) as PrematchStrengthEloSource | null,
    targetPlayed: target.played,
    opponentPlayed: opponent.played,
    historicalCutoffUtc: input.historicalCutoffUtc,
    commonReconstructionBase: PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
    semantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
    pairwiseAvailable,
    unavailableReason,
    qualityKind: qualityKind(target, opponent),
  };
}
