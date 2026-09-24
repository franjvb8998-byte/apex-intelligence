/**
 * GOALS-1D — G1 attack/defense prediction from GoalsTargetEvidence.
 */

import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  GOALS_G1_MODEL_VERSION,
  GOALS_G1_REGULATION_LABEL_POLICY,
  type GoalsG1ShrinkageK,
} from "@/lib/debug/calibration/goals/g1/protocol";
import {
  computeAttackDefenseMus,
  evidenceSupportBucket,
  minRelevantPlayed,
} from "@/lib/debug/calibration/goals/g1/strengths";
import {
  deriveAnalyticMarkets,
  diagnosticScoreGrid,
  type GoalsG0MarketBundle,
  type GoalsG0ScoreDiagnostics,
} from "@/lib/debug/calibration/goals/g0/poisson-markets";

export type GoalsG1PredictionStatus = "AVAILABLE" | "UNAVAILABLE";

export type GoalsG1Prediction = {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  predictionStatus: GoalsG1PredictionStatus;
  unavailableReason: string | null;
  modelVersion: typeof GOALS_G1_MODEL_VERSION;
  historicalCutoffUtc: string;
  leagueMatchesPlayedBefore: number;
  shrinkageK: number;
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
  teamEvidenceQuality: string;
  lowInformationFallbackUsed: boolean;
  evidenceSupportBucket: string;
  goalEvidenceQuality: string;
  regulationLabelPolicy: typeof GOALS_G1_REGULATION_LABEL_POLICY;
  regulationLabelSource: string;
  noOpponentAdjustment: true;
  noExplicitHfa: true;
  labelHomeGoals90: number | null;
  labelAwayGoals90: number | null;
};

export function predictG1FromEvidence(
  evidence: GoalsTargetEvidence,
  shrinkageK: GoalsG1ShrinkageK | number,
): GoalsG1Prediction {
  const league = evidence.leagueEnvironment;
  const n = league.leagueMatchesPlayedBefore;
  const Lh = league.leagueHomeGoalsPerMatch;
  const La = league.leagueAwayGoalsPerMatch;

  const homeAttackPlayed = evidence.homeEvidence.homeRole.played;
  const homeDefensePlayed = evidence.homeEvidence.homeRole.played;
  const awayAttackPlayed = evidence.awayEvidence.awayRole.played;
  const awayDefensePlayed = evidence.awayEvidence.awayRole.played;

  const base = {
    fixtureId: evidence.fixtureId,
    season: evidence.season,
    kickoffUtc: evidence.kickoffUtc,
    homeTeamId: evidence.homeTeamId,
    awayTeamId: evidence.awayTeamId,
    modelVersion: GOALS_G1_MODEL_VERSION,
    historicalCutoffUtc: evidence.historicalCutoffUtc,
    leagueMatchesPlayedBefore: n,
    shrinkageK,
    homeAttackPlayed,
    homeDefensePlayed,
    awayAttackPlayed,
    awayDefensePlayed,
    regulationLabelPolicy: GOALS_G1_REGULATION_LABEL_POLICY,
    regulationLabelSource: evidence.labels.regulationLabelSource,
    noOpponentAdjustment: true as const,
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
      teamEvidenceQuality: "UNAVAILABLE",
      lowInformationFallbackUsed: false,
      evidenceSupportBucket: "BASE_PRIOR",
    };
  }

  const comps = computeAttackDefenseMus({
    leagueHomeRate: Lh,
    leagueAwayRate: La,
    homeAttackPlayed,
    homeAttackObserved: evidence.homeEvidence.homeRole.goalsForPerMatch,
    homeDefensePlayed,
    homeDefenseObserved: evidence.homeEvidence.homeRole.goalsAgainstPerMatch,
    awayAttackPlayed,
    awayAttackObserved: evidence.awayEvidence.awayRole.goalsForPerMatch,
    awayDefensePlayed,
    awayDefenseObserved: evidence.awayEvidence.awayRole.goalsAgainstPerMatch,
    shrinkageK,
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
  const minPlayed = minRelevantPlayed(comps);

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
    teamEvidenceQuality: comps.teamEvidenceQuality,
    lowInformationFallbackUsed: comps.lowInformationFallbackUsed,
    evidenceSupportBucket: evidenceSupportBucket(
      minPlayed,
      comps.lowInformationFallbackUsed,
    ),
  };
}

export function assertG1Coherence(pred: GoalsG1Prediction): void {
  if (pred.predictionStatus !== "AVAILABLE" || !pred.markets) return;
  const m = pred.markets;
  const eps = 1e-9;
  if (
    Math.abs(
      (pred.expectedHomeGoals ?? 0) +
        (pred.expectedAwayGoals ?? 0) -
        (pred.expectedTotalGoals ?? 0),
    ) > eps
  ) {
    throw new Error("G1 EP coherence failed");
  }
  if (
    Math.abs(
      (pred.expectedHomeGoals ?? 0) -
        (pred.expectedAwayGoals ?? 0) -
        (pred.expectedGoalDifference ?? 0),
    ) > eps
  ) {
    throw new Error("G1 GD coherence failed");
  }
  const overs = [
    m.matchTotals.over05,
    m.matchTotals.over15,
    m.matchTotals.over25,
    m.matchTotals.over35,
    m.matchTotals.over45,
  ];
  for (let i = 0; i < overs.length - 1; i += 1) {
    if (overs[i]! + eps < overs[i + 1]!) {
      throw new Error("G1 Over monotonicity failed");
    }
  }
  const pairs: [number, number][] = [
    [m.matchTotals.over05, m.matchTotals.under05],
    [m.matchTotals.over15, m.matchTotals.under15],
    [m.matchTotals.over25, m.matchTotals.under25],
    [m.matchTotals.over35, m.matchTotals.under35],
    [m.matchTotals.over45, m.matchTotals.under45],
    [m.btts.yes, m.btts.no],
  ];
  for (const [a, b] of pairs) {
    if (Math.abs(a + b - 1) > 1e-9) throw new Error("G1 complement failed");
  }
  if (pred.diagnostics) {
    const s =
      pred.diagnostics.oneXTwo.home +
      pred.diagnostics.oneXTwo.draw +
      pred.diagnostics.oneXTwo.away;
    if (Math.abs(s - 1) > 1e-8) throw new Error("G1 1X2 sum failed");
  }
  if (pred.noExplicitHfa !== true || pred.noOpponentAdjustment !== true) {
    throw new Error("G1 safety flags violated");
  }
}
