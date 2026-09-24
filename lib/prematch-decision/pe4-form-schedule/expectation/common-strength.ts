/**
 * PE-4G.3 — Common-baseline strength from pre-kickoff played/wins/GF/GA.
 * Mathematically equivalent to PE-4G.1 / catalogueEloFromPlayedStats @ common B.
 */

import { catalogueEloFromPlayedStats } from "@/lib/match-center/catalogue-elo";
import {
  PE4_EXPECTATION_COMMON_BASELINE,
  type Pe4ExpectationQualityKind,
  type Pe4ExpectationStrengthSource,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type Pe4CommonStrengthFromRecord = {
  strength: number;
  source: Pe4ExpectationStrengthSource;
  played: number;
};

/**
 * Reconstruct common-baseline index from a pre-kickoff team record.
 * played=0 → base_prior (= B); played>0 → catalogue formula at B.
 */
export function reconstructPe4CommonBaselineStrength(input: {
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  commonBaseline?: number;
}): Pe4CommonStrengthFromRecord {
  const B = input.commonBaseline ?? PE4_EXPECTATION_COMMON_BASELINE;
  if (
    !Number.isFinite(input.played) ||
    !Number.isFinite(input.wins) ||
    !Number.isFinite(input.goalsFor) ||
    !Number.isFinite(input.goalsAgainst) ||
    input.played < 0 ||
    input.wins < 0 ||
    input.goalsFor < 0 ||
    input.goalsAgainst < 0 ||
    !Number.isInteger(input.played) ||
    !Number.isInteger(input.wins) ||
    input.wins > input.played
  ) {
    throw new Error("Invalid pre-kickoff team record for common-baseline strength");
  }

  if (input.played === 0) {
    return { strength: B, source: "base_prior", played: 0 };
  }

  return {
    strength: catalogueEloFromPlayedStats({
      base: B,
      played: input.played,
      wins: input.wins,
      goalsFor: input.goalsFor,
      goalsAgainst: input.goalsAgainst,
    }),
    source: "catalogue",
    played: input.played,
  };
}

export function pe4ExpectationQualityKind(
  home: Pe4ExpectationStrengthSource,
  away: Pe4ExpectationStrengthSource,
): Pe4ExpectationQualityKind {
  if (home === "catalogue" && away === "catalogue") return "catalogue_catalogue";
  if (home === "catalogue" && away === "base_prior") return "catalogue_base_prior";
  if (home === "base_prior" && away === "catalogue") return "base_prior_catalogue";
  if (home === "base_prior" && away === "base_prior") return "base_prior_base_prior";
  return "unavailable";
}
