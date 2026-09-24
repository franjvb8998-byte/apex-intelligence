/**
 * GOALS-1C — G0 prediction from GoalsTargetEvidence league environment.
 */

import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  GOALS_G0_MODEL_VERSION,
  GOALS_G0_REGULATION_LABEL_POLICY,
} from "@/lib/debug/calibration/goals/g0/protocol";
import {
  deriveAnalyticMarkets,
  diagnosticScoreGrid,
  type GoalsG0MarketBundle,
  type GoalsG0ScoreDiagnostics,
} from "@/lib/debug/calibration/goals/g0/poisson-markets";

export type GoalsG0PredictionStatus = "AVAILABLE" | "UNAVAILABLE";

export type GoalsG0Prediction = {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  predictionStatus: GoalsG0PredictionStatus;
  unavailableReason: string | null;
  modelVersion: typeof GOALS_G0_MODEL_VERSION;
  historicalCutoffUtc: string;
  leagueMatchesPlayedBefore: number;
  muHome: number | null;
  muAway: number | null;
  expectedHomeGoals: number | null;
  expectedAwayGoals: number | null;
  expectedTotalGoals: number | null;
  expectedGoalDifference: number | null;
  markets: GoalsG0MarketBundle | null;
  diagnostics: GoalsG0ScoreDiagnostics | null;
  goalEvidenceQuality: string;
  regulationLabelPolicy: typeof GOALS_G0_REGULATION_LABEL_POLICY;
  regulationLabelSource: string;
  trainingCoverageClass: string;
  labelHomeGoals90: number | null;
  labelAwayGoals90: number | null;
};

export function predictG0FromEvidence(
  evidence: GoalsTargetEvidence,
): GoalsG0Prediction {
  const league = evidence.leagueEnvironment;
  const n = league.leagueMatchesPlayedBefore;
  const muHome = league.leagueHomeGoalsPerMatch;
  const muAway = league.leagueAwayGoalsPerMatch;

  const base = {
    fixtureId: evidence.fixtureId,
    season: evidence.season,
    kickoffUtc: evidence.kickoffUtc,
    modelVersion: GOALS_G0_MODEL_VERSION,
    historicalCutoffUtc: evidence.historicalCutoffUtc,
    leagueMatchesPlayedBefore: n,
    goalEvidenceQuality: league.status,
    regulationLabelPolicy: GOALS_G0_REGULATION_LABEL_POLICY,
    regulationLabelSource: evidence.labels.regulationLabelSource,
    trainingCoverageClass:
      n === 0
        ? "no_prior_league_matches"
        : n < 8
          ? "thin_league_history"
          : "in_season_league_environment",
    labelHomeGoals90: evidence.labels.actualHomeGoals90,
    labelAwayGoals90: evidence.labels.actualAwayGoals90,
  };

  if (
    n <= 0 ||
    muHome == null ||
    muAway == null ||
    !Number.isFinite(muHome) ||
    !Number.isFinite(muAway) ||
    muHome <= 0 ||
    muAway <= 0
  ) {
    return {
      ...base,
      predictionStatus: "UNAVAILABLE",
      unavailableReason: "no_prior_league_evidence_or_nonpositive_mu",
      muHome: null,
      muAway: null,
      expectedHomeGoals: null,
      expectedAwayGoals: null,
      expectedTotalGoals: null,
      expectedGoalDifference: null,
      markets: null,
      diagnostics: null,
    };
  }

  const markets = deriveAnalyticMarkets(muHome, muAway);
  const diagnostics = diagnosticScoreGrid(muHome, muAway);

  return {
    ...base,
    predictionStatus: "AVAILABLE",
    unavailableReason: null,
    muHome,
    muAway,
    expectedHomeGoals: muHome,
    expectedAwayGoals: muAway,
    expectedTotalGoals: muHome + muAway,
    expectedGoalDifference: muHome - muAway,
    markets,
    diagnostics,
  };
}

export function assertG0Coherence(pred: GoalsG0Prediction): void {
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
    throw new Error("EP coherence failed");
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
      throw new Error("Over monotonicity failed");
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
    if (Math.abs(a + b - 1) > 1e-9) throw new Error("complement failed");
  }
  if (pred.diagnostics) {
    const s =
      pred.diagnostics.oneXTwo.home +
      pred.diagnostics.oneXTwo.draw +
      pred.diagnostics.oneXTwo.away;
    if (Math.abs(s - 1) > 1e-8) throw new Error("1X2 sum failed");
  }
}
