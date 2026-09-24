/**
 * GOALS-1E — G3 prediction from goals universe + strength universe.
 */

import { createHash } from "node:crypto";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import type { Pe4HistoricalStrengthMemo } from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import type {
  GoalsHistoricalFixture,
  GoalsTargetEvidence,
} from "@/lib/debug/calibration/goals/types";
import {
  deriveAnalyticMarkets,
  diagnosticScoreGrid,
  type GoalsG0MarketBundle,
  type GoalsG0ScoreDiagnostics,
} from "@/lib/debug/calibration/goals/g0/poisson-markets";
import {
  evidenceSupportBucket,
  minRelevantPlayed,
} from "@/lib/debug/calibration/goals/g1/strengths";
import { makeAdjustmentFns } from "@/lib/debug/calibration/goals/g3/adjustment";
import {
  listVenueRolePriorsWithOpponents,
  type GoalsG3HistoricalMatchContribution,
} from "@/lib/debug/calibration/goals/g3/opponent-attach";
import {
  GOALS_G3_FROZEN_SHRINKAGE_K,
  GOALS_G3_MODEL_VERSION,
  GOALS_G3_NORMALIZATION_SCALE,
  GOALS_G3_REGULATION_LABEL_POLICY,
  type GoalsG3Beta,
} from "@/lib/debug/calibration/goals/g3/protocol";
import {
  computeG3MusFromAdjustedRates,
  summarizeAdjustedRates,
  type GoalsG3AdjustedRateSummary,
} from "@/lib/debug/calibration/goals/g3/rates";

export type GoalsG3PredictionStatus = "AVAILABLE" | "UNAVAILABLE";

export type GoalsG3Prediction = {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  predictionStatus: GoalsG3PredictionStatus;
  unavailableReason: string | null;
  modelVersion: typeof GOALS_G3_MODEL_VERSION;
  historicalCutoffUtc: string;
  leagueMatchesPlayedBefore: number;
  shrinkageK: typeof GOALS_G3_FROZEN_SHRINKAGE_K;
  beta: number;
  empiricalOpponentCenter: number;
  normalizationScale: typeof GOALS_G3_NORMALIZATION_SCALE;
  leagueHomeRate: number | null;
  leagueAwayRate: number | null;
  homeAttackStrength: number | null;
  homeDefenseStrength: number | null;
  awayAttackStrength: number | null;
  awayDefenseStrength: number | null;
  homeAttackPlayed: number;
  homeDefensePlayed: number;
  awayAttackPlayed: number;
  awayDefensePlayed: number;
  muHome: number | null;
  muAway: number | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  expectedTotalGoals: number | null;
  expectedGoalDifference: number | null;
  markets: GoalsG0MarketBundle | null;
  diagnostics: GoalsG0ScoreDiagnostics | null;
  homeAttackSummary: GoalsG3AdjustedRateSummary | null;
  awayAttackSummary: GoalsG3AdjustedRateSummary | null;
  /** Combined venue contributions for provenance digest. */
  allContributions: GoalsG3HistoricalMatchContribution[];
  evidenceDigest: string | null;
  teamEvidenceQuality: string;
  lowInformationFallbackUsed: boolean;
  evidenceSupportBucket: string;
  goalEvidenceQuality: string;
  regulationLabelPolicy: typeof GOALS_G3_REGULATION_LABEL_POLICY;
  regulationLabelSource: string;
  noOpponentAdjustmentAtTarget: true;
  noExplicitHfa: true;
  labelHomeGoals90: number | null;
  labelAwayGoals90: number | null;
};

function materialEvidenceDigest(input: {
  beta: number;
  k: number;
  center: number;
  homeAttack: GoalsG3AdjustedRateSummary;
  awayAttack: GoalsG3AdjustedRateSummary;
  strengths: {
    homeAttackStrength: number;
    homeDefenseStrength: number;
    awayAttackStrength: number;
    awayDefenseStrength: number;
  };
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        beta: input.beta,
        k: input.k,
        center: input.center,
        homeDigest: input.homeAttack.contributionsDigest,
        awayDigest: input.awayAttack.contributionsDigest,
        strengths: input.strengths,
      }),
      "utf8",
    )
    .digest("hex");
}

export function predictG3FromEvidence(input: {
  evidence: GoalsTargetEvidence;
  targetFixture: GoalsHistoricalFixture;
  goalsUniverse: readonly GoalsHistoricalFixture[];
  strengthUniverse: readonly PrematchStrengthUniverseFixture[];
  beta: GoalsG3Beta | number;
  empiricalOpponentCenter: number;
  memo?: Pe4HistoricalStrengthMemo;
}): GoalsG3Prediction {
  const { evidence } = input;
  const league = evidence.leagueEnvironment;
  const n = league.leagueMatchesPlayedBefore;
  const Lh = league.leagueHomeGoalsPerMatch;
  const La = league.leagueAwayGoalsPerMatch;
  const fns = makeAdjustmentFns({
    beta: input.beta,
    center: input.empiricalOpponentCenter,
  });

  const homeContrib = listVenueRolePriorsWithOpponents({
    teamId: evidence.homeTeamId,
    venue: "HOME",
    target: input.targetFixture,
    goalsUniverse: input.goalsUniverse,
    strengthUniverse: input.strengthUniverse,
    memo: input.memo,
    ...fns,
  });
  const awayContrib = listVenueRolePriorsWithOpponents({
    teamId: evidence.awayTeamId,
    venue: "AWAY",
    target: input.targetFixture,
    goalsUniverse: input.goalsUniverse,
    strengthUniverse: input.strengthUniverse,
    memo: input.memo,
    ...fns,
  });

  const homeSummary = summarizeAdjustedRates(homeContrib);
  const awaySummary = summarizeAdjustedRates(awayContrib);
  // Defense uses same venue matches: home defense = home role GA; away defense = away role GA
  const homeDefSummary = homeSummary;
  const awayDefSummary = awaySummary;

  const base = {
    fixtureId: evidence.fixtureId,
    season: evidence.season,
    kickoffUtc: evidence.kickoffUtc,
    homeTeamId: evidence.homeTeamId,
    awayTeamId: evidence.awayTeamId,
    modelVersion: GOALS_G3_MODEL_VERSION,
    historicalCutoffUtc: evidence.historicalCutoffUtc,
    leagueMatchesPlayedBefore: n,
    shrinkageK: GOALS_G3_FROZEN_SHRINKAGE_K,
    beta: input.beta,
    empiricalOpponentCenter: input.empiricalOpponentCenter,
    normalizationScale: GOALS_G3_NORMALIZATION_SCALE,
    homeAttackPlayed: homeSummary.played,
    homeDefensePlayed: homeDefSummary.played,
    awayAttackPlayed: awaySummary.played,
    awayDefensePlayed: awayDefSummary.played,
    homeAttackSummary: homeSummary,
    awayAttackSummary: awaySummary,
    allContributions: [...homeContrib, ...awayContrib],
    regulationLabelPolicy: GOALS_G3_REGULATION_LABEL_POLICY,
    regulationLabelSource: evidence.labels.regulationLabelSource,
    noOpponentAdjustmentAtTarget: true as const,
    noExplicitHfa: true as const,
    labelHomeGoals90: evidence.labels.actualHomeGoals90,
    labelAwayGoals90: evidence.labels.actualAwayGoals90,
    goalEvidenceQuality: league.status,
  };

  if (
    n <= 0 ||
    Lh == null ||
    La == null ||
    !Number.isFinite(Lh) ||
    !Number.isFinite(La) ||
    Lh <= 0 ||
    La <= 0
  ) {
    return {
      ...base,
      predictionStatus: "UNAVAILABLE",
      unavailableReason: "no_prior_league_evidence",
      leagueHomeRate: null,
      leagueAwayRate: null,
      homeAttackStrength: null,
      homeDefenseStrength: null,
      awayAttackStrength: null,
      awayDefenseStrength: null,
      muHome: null,
      muAway: null,
      expectedHomeGoals: null,
      expectedAwayGoals: null,
      expectedTotalGoals: null,
      expectedGoalDifference: null,
      markets: null,
      diagnostics: null,
      evidenceDigest: null,
      teamEvidenceQuality: "UNAVAILABLE",
      lowInformationFallbackUsed: false,
      evidenceSupportBucket: "BASE_PRIOR",
    };
  }

  const comps = computeG3MusFromAdjustedRates({
    leagueHomeRate: Lh,
    leagueAwayRate: La,
    homeAttack: homeSummary,
    homeDefense: homeDefSummary,
    awayAttack: awaySummary,
    awayDefense: awayDefSummary,
  });

  if (
    !Number.isFinite(comps.muHome) ||
    !Number.isFinite(comps.muAway) ||
    comps.muHome <= 0 ||
    comps.muAway <= 0
  ) {
    return {
      ...base,
      predictionStatus: "UNAVAILABLE",
      unavailableReason: "nonpositive_or_nonfinite_mu",
      leagueHomeRate: Lh,
      leagueAwayRate: La,
      homeAttackStrength: comps.homeAttackStrength,
      homeDefenseStrength: comps.homeDefenseStrength,
      awayAttackStrength: comps.awayAttackStrength,
      awayDefenseStrength: comps.awayDefenseStrength,
      muHome: comps.muHome,
      muAway: comps.muAway,
      expectedHomeGoals: null,
      expectedAwayGoals: null,
      expectedTotalGoals: null,
      expectedGoalDifference: null,
      markets: null,
      diagnostics: null,
      evidenceDigest: materialEvidenceDigest({
        beta: input.beta,
        k: GOALS_G3_FROZEN_SHRINKAGE_K,
        center: input.empiricalOpponentCenter,
        homeAttack: homeSummary,
        awayAttack: awaySummary,
        strengths: comps,
      }),
      teamEvidenceQuality: comps.teamEvidenceQuality,
      lowInformationFallbackUsed: comps.lowInformationFallbackUsed,
      evidenceSupportBucket: evidenceSupportBucket(
        minRelevantPlayed(comps),
        comps.lowInformationFallbackUsed,
      ),
    };
  }

  const markets = deriveAnalyticMarkets(comps.muHome, comps.muAway);
  const diagnostics = diagnosticScoreGrid(comps.muHome, comps.muAway);

  return {
    ...base,
    predictionStatus: "AVAILABLE",
    unavailableReason: null,
    leagueHomeRate: Lh,
    leagueAwayRate: La,
    homeAttackStrength: comps.homeAttackStrength,
    homeDefenseStrength: comps.homeDefenseStrength,
    awayAttackStrength: comps.awayAttackStrength,
    awayDefenseStrength: comps.awayDefenseStrength,
    muHome: comps.muHome,
    muAway: comps.muAway,
    expectedHomeGoals: comps.muHome,
    expectedAwayGoals: comps.muAway,
    expectedTotalGoals: comps.muHome + comps.muAway,
    expectedGoalDifference: comps.muHome - comps.muAway,
    markets,
    diagnostics,
    evidenceDigest: materialEvidenceDigest({
      beta: input.beta,
      k: GOALS_G3_FROZEN_SHRINKAGE_K,
      center: input.empiricalOpponentCenter,
      homeAttack: homeSummary,
      awayAttack: awaySummary,
      strengths: {
        homeAttackStrength: comps.homeAttackStrength,
        homeDefenseStrength: comps.homeDefenseStrength,
        awayAttackStrength: comps.awayAttackStrength,
        awayDefenseStrength: comps.awayDefenseStrength,
      },
    }),
    teamEvidenceQuality: comps.teamEvidenceQuality,
    lowInformationFallbackUsed: comps.lowInformationFallbackUsed,
    evidenceSupportBucket: evidenceSupportBucket(
      minRelevantPlayed(comps),
      comps.lowInformationFallbackUsed,
    ),
  };
}

export function assertG3Coherence(pred: GoalsG3Prediction): void {
  if (pred.predictionStatus !== "AVAILABLE" || !pred.markets) return;
  if (pred.shrinkageK !== GOALS_G3_FROZEN_SHRINKAGE_K) {
    throw new Error("G3 k must remain 10");
  }
  const eps = 1e-9;
  if (
    Math.abs(
      (pred.expectedHomeGoals ?? 0) +
        (pred.expectedAwayGoals ?? 0) -
        (pred.expectedTotalGoals ?? 0),
    ) > eps
  ) {
    throw new Error("G3 EP coherence failed");
  }
  const overs = [
    pred.markets.matchTotals.over05,
    pred.markets.matchTotals.over15,
    pred.markets.matchTotals.over25,
    pred.markets.matchTotals.over35,
    pred.markets.matchTotals.over45,
  ];
  for (let i = 0; i < overs.length - 1; i += 1) {
    if (overs[i]! + eps < overs[i + 1]!) {
      throw new Error("G3 Over monotonicity failed");
    }
  }
  if (pred.diagnostics) {
    const s =
      pred.diagnostics.oneXTwo.home +
      pred.diagnostics.oneXTwo.draw +
      pred.diagnostics.oneXTwo.away;
    if (Math.abs(s - 1) > 1e-8) throw new Error("G3 1X2 sum failed");
  }
}
