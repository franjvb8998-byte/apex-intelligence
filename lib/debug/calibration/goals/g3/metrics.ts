/**
 * GOALS-1E — Metrics helpers projecting G3 onto shared G0 evaluation.
 */

import {
  evaluateG0Season,
  type GoalsG0SeasonMetrics,
} from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsG0Prediction } from "@/lib/debug/calibration/goals/g0/predict";
import {
  GOALS_G0_MODEL_VERSION,
  GOALS_G0_REGULATION_LABEL_POLICY,
} from "@/lib/debug/calibration/goals/g0/protocol";
import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";
import { evaluateG1Season } from "@/lib/debug/calibration/goals/g1/metrics";
import type { GoalsG3Prediction } from "@/lib/debug/calibration/goals/g3/predict";
import {
  GOALS_G3_OPPONENT_CENTERED_BINS,
} from "@/lib/debug/calibration/goals/g3/protocol";
import { normalizeOpponentQuality } from "@/lib/debug/calibration/goals/g3/adjustment";

export function g3AsG0Prediction(p: GoalsG3Prediction): GoalsG0Prediction {
  return {
    fixtureId: p.fixtureId,
    season: p.season,
    kickoffUtc: p.kickoffUtc,
    predictionStatus: p.predictionStatus,
    unavailableReason: p.unavailableReason,
    modelVersion: GOALS_G0_MODEL_VERSION,
    historicalCutoffUtc: p.historicalCutoffUtc,
    leagueMatchesPlayedBefore: p.leagueMatchesPlayedBefore,
    muHome: p.muHome,
    muAway: p.muAway,
    expectedHomeGoals: p.expectedHomeGoals,
    expectedAwayGoals: p.expectedAwayGoals,
    expectedTotalGoals: p.expectedTotalGoals,
    expectedGoalDifference: p.expectedGoalDifference,
    markets: p.markets,
    diagnostics: p.diagnostics,
    goalEvidenceQuality: p.goalEvidenceQuality,
    regulationLabelPolicy: GOALS_G0_REGULATION_LABEL_POLICY,
    regulationLabelSource: p.regulationLabelSource,
    trainingCoverageClass: p.evidenceSupportBucket,
    labelHomeGoals90: p.labelHomeGoals90,
    labelAwayGoals90: p.labelAwayGoals90,
  };
}

export function evaluateG3Season(
  predictions: readonly GoalsG3Prediction[],
): GoalsG0SeasonMetrics {
  return evaluateG0Season(predictions.map(g3AsG0Prediction));
}

export type TripleCoverageComparison = {
  commonN: number;
  g0: GoalsG0SeasonMetrics;
  g1: GoalsG0SeasonMetrics;
  g3: GoalsG0SeasonMetrics;
  deltaG3MinusG1: {
    jointScoreLogLoss: number | null;
    totalGoalLogLoss: number | null;
    homeGoalLogLoss: number | null;
    awayGoalLogLoss: number | null;
  };
};

export function compareTripleCoverage(input: {
  g0: readonly GoalsG0Prediction[];
  g1: readonly GoalsG1Prediction[];
  g3: readonly GoalsG3Prediction[];
}): TripleCoverageComparison {
  const g0m = new Map(
    input.g0
      .filter((p) => p.predictionStatus === "AVAILABLE")
      .map((p) => [p.fixtureId, p]),
  );
  const g1m = new Map(
    input.g1
      .filter((p) => p.predictionStatus === "AVAILABLE")
      .map((p) => [p.fixtureId, p]),
  );
  const g3m = new Map(
    input.g3
      .filter((p) => p.predictionStatus === "AVAILABLE")
      .map((p) => [p.fixtureId, p]),
  );
  const commonIds = [...g0m.keys()]
    .filter((id) => g1m.has(id) && g3m.has(id))
    .sort();

  const g0 = evaluateG0Season(commonIds.map((id) => g0m.get(id)!));
  const g1 = evaluateG1Season(commonIds.map((id) => g1m.get(id)!));
  const g3 = evaluateG3Season(commonIds.map((id) => g3m.get(id)!));
  const d = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? null : b - a;

  return {
    commonN: commonIds.length,
    g0,
    g1,
    g3,
    deltaG3MinusG1: {
      jointScoreLogLoss: d(
        g1.distribution?.jointScoreLogLoss,
        g3.distribution?.jointScoreLogLoss,
      ),
      totalGoalLogLoss: d(
        g1.distribution?.totalGoalLogLoss,
        g3.distribution?.totalGoalLogLoss,
      ),
      homeGoalLogLoss: d(
        g1.distribution?.homeGoalLogLoss,
        g3.distribution?.homeGoalLogLoss,
      ),
      awayGoalLogLoss: d(
        g1.distribution?.awayGoalLogLoss,
        g3.distribution?.awayGoalLogLoss,
      ),
    },
  };
}

export function auditOpponentQualityStrata(
  predictions: readonly GoalsG3Prediction[],
  center: number,
): {
  stratum: string;
  contributionN: number;
  meanGoalsFor: number;
  meanGoalsAgainst: number;
  meanOpponentStrength: number;
}[] {
  const bins = GOALS_G3_OPPONENT_CENTERED_BINS;
  const labels = [
    "much_weaker",
    "weaker",
    "near_average",
    "stronger",
    "much_stronger",
  ];
  const buckets: {
    goalsFor: number[];
    goalsAgainst: number[];
    strengths: number[];
  }[] = labels.map(() => ({
    goalsFor: [],
    goalsAgainst: [],
    strengths: [],
  }));

  for (const p of predictions) {
    for (const c of p.allContributions) {
      if (c.opponentStrengthSource !== "catalogue" || c.opponentCommonStrengthAsOfM == null) {
        continue;
      }
      const z = normalizeOpponentQuality(c.opponentCommonStrengthAsOfM, center);
      let idx = labels.length - 1;
      for (let i = 0; i < bins.length - 1; i += 1) {
        if (z >= bins[i]! && z < bins[i + 1]!) {
          idx = i;
          break;
        }
      }
      buckets[idx]!.goalsFor.push(c.rawGoalsFor);
      buckets[idx]!.goalsAgainst.push(c.rawGoalsAgainst);
      buckets[idx]!.strengths.push(c.opponentCommonStrengthAsOfM);
    }
  }

  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  return labels.map((stratum, i) => ({
    stratum,
    contributionN: buckets[i]!.goalsFor.length,
    meanGoalsFor: mean(buckets[i]!.goalsFor),
    meanGoalsAgainst: mean(buckets[i]!.goalsAgainst),
    meanOpponentStrength: mean(buckets[i]!.strengths),
  }));
}

export function auditG3Extremes(predictions: readonly GoalsG3Prediction[]) {
  const avail = predictions.filter((p) => p.predictionStatus === "AVAILABLE");
  let minMuH = Infinity;
  let maxMuH = -Infinity;
  let minMuA = Infinity;
  let maxMuA = -Infinity;
  let minTot = Infinity;
  let maxTot = -Infinity;
  let minAdj = Infinity;
  let maxAdj = -Infinity;
  let minOpp = Infinity;
  let maxOpp = -Infinity;

  for (const p of avail) {
    minMuH = Math.min(minMuH, p.muHome!);
    maxMuH = Math.max(maxMuH, p.muHome!);
    minMuA = Math.min(minMuA, p.muAway!);
    maxMuA = Math.max(maxMuA, p.muAway!);
    minTot = Math.min(minTot, p.expectedTotalGoals!);
    maxTot = Math.max(maxTot, p.expectedTotalGoals!);
    for (const c of p.allContributions) {
      minAdj = Math.min(minAdj, c.attackAdjustment, c.defenseAdjustment);
      maxAdj = Math.max(maxAdj, c.attackAdjustment, c.defenseAdjustment);
      if (c.opponentCommonStrengthAsOfM != null) {
        minOpp = Math.min(minOpp, c.opponentCommonStrengthAsOfM);
        maxOpp = Math.max(maxOpp, c.opponentCommonStrengthAsOfM);
      }
    }
  }

  return {
    minMuHome: avail.length ? minMuH : null,
    maxMuHome: avail.length ? maxMuH : null,
    minMuAway: avail.length ? minMuA : null,
    maxMuAway: avail.length ? maxMuA : null,
    minExpectedTotal: avail.length ? minTot : null,
    maxExpectedTotal: avail.length ? maxTot : null,
    minAdjustment: avail.length && Number.isFinite(minAdj) ? minAdj : null,
    maxAdjustment: avail.length && Number.isFinite(maxAdj) ? maxAdj : null,
    minOpponentStrength: avail.length && Number.isFinite(minOpp) ? minOpp : null,
    maxOpponentStrength: avail.length && Number.isFinite(maxOpp) ? maxOpp : null,
  };
}

export function lowInfoOpponentAudit(predictions: readonly GoalsG3Prediction[]) {
  let catalogue = 0;
  let basePrior = 0;
  let unavailable = 0;
  for (const p of predictions) {
    for (const c of p.allContributions) {
      if (c.opponentStrengthSource === "catalogue") catalogue += 1;
      else if (c.opponentStrengthSource === "base_prior") basePrior += 1;
      else unavailable += 1;
    }
  }
  return { catalogue, basePrior, unavailable };
}
