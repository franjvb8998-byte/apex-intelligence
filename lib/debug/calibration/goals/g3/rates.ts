/**
 * GOALS-1E — Build opponent-adjusted venue-role rates for G3.
 */

import { computeAttackDefenseMus } from "@/lib/debug/calibration/goals/g1/strengths";
import type { GoalsG3HistoricalMatchContribution } from "@/lib/debug/calibration/goals/g3/opponent-attach";
import { digestG3Contributions } from "@/lib/debug/calibration/goals/g3/opponent-attach";
import { GOALS_G3_FROZEN_SHRINKAGE_K } from "@/lib/debug/calibration/goals/g3/protocol";

export type GoalsG3AdjustedRateSummary = {
  played: number;
  rawGoalsFor: number;
  rawGoalsAgainst: number;
  adjustedGoalsFor: number;
  adjustedGoalsAgainst: number;
  rawGoalsForPerMatch: number | null;
  rawGoalsAgainstPerMatch: number | null;
  adjustedGoalsForPerMatch: number | null;
  adjustedGoalsAgainstPerMatch: number | null;
  catalogueOpponentN: number;
  basePriorOpponentN: number;
  unavailableOpponentN: number;
  meanAttackAdjustment: number | null;
  meanDefenseAdjustment: number | null;
  contributionsDigest: string;
  contributions: GoalsG3HistoricalMatchContribution[];
};

export function summarizeAdjustedRates(
  contributions: readonly GoalsG3HistoricalMatchContribution[],
): GoalsG3AdjustedRateSummary {
  const played = contributions.length;
  let rawGf = 0;
  let rawGa = 0;
  let adjGf = 0;
  let adjGa = 0;
  let cat = 0;
  let bp = 0;
  let un = 0;
  let sumAtk = 0;
  let sumDef = 0;
  for (const c of contributions) {
    rawGf += c.rawGoalsFor;
    rawGa += c.rawGoalsAgainst;
    adjGf += c.adjustedGoalsFor;
    adjGa += c.adjustedGoalsAgainst;
    sumAtk += c.attackAdjustment;
    sumDef += c.defenseAdjustment;
    if (c.opponentStrengthSource === "catalogue") cat += 1;
    else if (c.opponentStrengthSource === "base_prior") bp += 1;
    else un += 1;
  }
  return {
    played,
    rawGoalsFor: rawGf,
    rawGoalsAgainst: rawGa,
    adjustedGoalsFor: adjGf,
    adjustedGoalsAgainst: adjGa,
    rawGoalsForPerMatch: played ? rawGf / played : null,
    rawGoalsAgainstPerMatch: played ? rawGa / played : null,
    adjustedGoalsForPerMatch: played ? adjGf / played : null,
    adjustedGoalsAgainstPerMatch: played ? adjGa / played : null,
    catalogueOpponentN: cat,
    basePriorOpponentN: bp,
    unavailableOpponentN: un,
    meanAttackAdjustment: played ? sumAtk / played : null,
    meanDefenseAdjustment: played ? sumDef / played : null,
    contributionsDigest: digestG3Contributions(contributions),
    contributions: [...contributions],
  };
}

export function computeG3MusFromAdjustedRates(input: {
  leagueHomeRate: number;
  leagueAwayRate: number;
  homeAttack: GoalsG3AdjustedRateSummary;
  homeDefense: GoalsG3AdjustedRateSummary; // same home venue matches
  awayAttack: GoalsG3AdjustedRateSummary;
  awayDefense: GoalsG3AdjustedRateSummary;
}): ReturnType<typeof computeAttackDefenseMus> {
  return computeAttackDefenseMus({
    leagueHomeRate: input.leagueHomeRate,
    leagueAwayRate: input.leagueAwayRate,
    homeAttackPlayed: input.homeAttack.played,
    homeAttackObserved: input.homeAttack.adjustedGoalsForPerMatch,
    homeDefensePlayed: input.homeDefense.played,
    homeDefenseObserved: input.homeDefense.adjustedGoalsAgainstPerMatch,
    awayAttackPlayed: input.awayAttack.played,
    awayAttackObserved: input.awayAttack.adjustedGoalsForPerMatch,
    awayDefensePlayed: input.awayDefense.played,
    awayDefenseObserved: input.awayDefense.adjustedGoalsAgainstPerMatch,
    shrinkageK: GOALS_G3_FROZEN_SHRINKAGE_K,
  });
}
