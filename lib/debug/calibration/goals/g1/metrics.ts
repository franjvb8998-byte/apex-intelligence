/**
 * GOALS-1D — Metrics / diagnostics for G1 (reuses G0 evaluation helpers).
 */

import {
  evaluateG0Season,
  type GoalsG0SeasonMetrics,
} from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsG0Prediction } from "@/lib/debug/calibration/goals/g0/predict";
import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";
import { GOALS_G0_MODEL_VERSION } from "@/lib/debug/calibration/goals/g0/protocol";
import { GOALS_G0_REGULATION_LABEL_POLICY } from "@/lib/debug/calibration/goals/g0/protocol";

/** Project G1 onto G0 prediction shape for shared market/distribution metrics. */
export function g1AsG0Prediction(p: GoalsG1Prediction): GoalsG0Prediction {
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

export function evaluateG1Season(
  predictions: readonly GoalsG1Prediction[],
): GoalsG0SeasonMetrics {
  return evaluateG0Season(predictions.map(g1AsG0Prediction));
}

export type CommonCoverageComparison = {
  commonN: number;
  g0OnlyN: number;
  g1OnlyN: number;
  g0: GoalsG0SeasonMetrics;
  g1: GoalsG0SeasonMetrics;
  delta: {
    jointScoreLogLoss: number | null;
    totalGoalLogLoss: number | null;
    homeGoalLogLoss: number | null;
    awayGoalLogLoss: number | null;
  };
};

export function compareCommonCoverage(input: {
  g0: readonly GoalsG0Prediction[];
  g1: readonly GoalsG1Prediction[];
}): CommonCoverageComparison {
  const g0Avail = new Map(
    input.g0
      .filter((p) => p.predictionStatus === "AVAILABLE")
      .map((p) => [p.fixtureId, p]),
  );
  const g1Avail = new Map(
    input.g1
      .filter((p) => p.predictionStatus === "AVAILABLE")
      .map((p) => [p.fixtureId, p]),
  );

  const commonIds = [...g0Avail.keys()].filter((id) => g1Avail.has(id));
  commonIds.sort();

  const g0Common = commonIds.map((id) => g0Avail.get(id)!);
  const g1Common = commonIds.map((id) => g1Avail.get(id)!);

  const g0m = evaluateG0Season(g0Common);
  const g1m = evaluateG1Season(g1Common);

  const d = (
    a: number | null | undefined,
    b: number | null | undefined,
  ): number | null =>
    a == null || b == null ? null : b - a;

  return {
    commonN: commonIds.length,
    g0OnlyN: [...g0Avail.keys()].filter((id) => !g1Avail.has(id)).length,
    g1OnlyN: [...g1Avail.keys()].filter((id) => !g0Avail.has(id)).length,
    g0: g0m,
    g1: g1m,
    delta: {
      jointScoreLogLoss: d(
        g0m.distribution?.jointScoreLogLoss,
        g1m.distribution?.jointScoreLogLoss,
      ),
      totalGoalLogLoss: d(
        g0m.distribution?.totalGoalLogLoss,
        g1m.distribution?.totalGoalLogLoss,
      ),
      homeGoalLogLoss: d(
        g0m.distribution?.homeGoalLogLoss,
        g1m.distribution?.homeGoalLogLoss,
      ),
      awayGoalLogLoss: d(
        g0m.distribution?.awayGoalLogLoss,
        g1m.distribution?.awayGoalLogLoss,
      ),
    },
  };
}

export type LowInfoAuditBucket = {
  bucket: string;
  n: number;
  labeledN: number;
  jointScoreLogLoss: number | null;
  meanPredTotal: number | null;
  meanActualTotal: number | null;
};

export function auditLowInformation(
  predictions: readonly GoalsG1Prediction[],
): LowInfoAuditBucket[] {
  const buckets = ["BASE_PRIOR", "THIN", "DEVELOPING", "ESTABLISHED"] as const;
  return buckets.map((bucket) => {
    const rows = predictions.filter(
      (p) =>
        p.predictionStatus === "AVAILABLE" &&
        p.evidenceSupportBucket === bucket,
    );
    const labeled = rows.filter(
      (p) => p.labelHomeGoals90 != null && p.labelAwayGoals90 != null,
    );
    const metrics = evaluateG1Season(rows);
    return {
      bucket,
      n: rows.length,
      labeledN: labeled.length,
      jointScoreLogLoss: metrics.distribution?.jointScoreLogLoss ?? null,
      meanPredTotal: metrics.distribution?.meanPredTotal ?? null,
      meanActualTotal: metrics.distribution?.meanActualTotal ?? null,
    };
  });
}

export type ExtremeMuAudit = {
  minMuHome: number | null;
  maxMuHome: number | null;
  minMuAway: number | null;
  maxMuAway: number | null;
  minExpectedTotal: number | null;
  maxExpectedTotal: number | null;
  maxAttackStrength: number | null;
  maxDefenseStrength: number | null;
  minAttackStrength: number | null;
  minDefenseStrength: number | null;
  nearZeroProbCount: number;
  nearOneProbCount: number;
  extremes: {
    fixtureId: string;
    kickoffUtc: string;
    muHome: number;
    muAway: number;
    expectedTotal: number;
    homeAttackStrength: number;
    awayDefenseStrength: number;
    awayAttackStrength: number;
    homeDefenseStrength: number;
  }[];
};

export function auditExtremePredictions(
  predictions: readonly GoalsG1Prediction[],
): ExtremeMuAudit {
  const avail = predictions.filter((p) => p.predictionStatus === "AVAILABLE");
  if (avail.length === 0) {
    return {
      minMuHome: null,
      maxMuHome: null,
      minMuAway: null,
      maxMuAway: null,
      minExpectedTotal: null,
      maxExpectedTotal: null,
      maxAttackStrength: null,
      maxDefenseStrength: null,
      minAttackStrength: null,
      minDefenseStrength: null,
      nearZeroProbCount: 0,
      nearOneProbCount: 0,
      extremes: [],
    };
  }

  let minMuHome = Infinity;
  let maxMuHome = -Infinity;
  let minMuAway = Infinity;
  let maxMuAway = -Infinity;
  let minTot = Infinity;
  let maxTot = -Infinity;
  let maxAtk = -Infinity;
  let maxDef = -Infinity;
  let minAtk = Infinity;
  let minDef = Infinity;
  let nearZero = 0;
  let nearOne = 0;

  for (const p of avail) {
    const mh = p.muHome!;
    const ma = p.muAway!;
    const tot = p.expectedTotalGoals!;
    minMuHome = Math.min(minMuHome, mh);
    maxMuHome = Math.max(maxMuHome, mh);
    minMuAway = Math.min(minMuAway, ma);
    maxMuAway = Math.max(maxMuAway, ma);
    minTot = Math.min(minTot, tot);
    maxTot = Math.max(maxTot, tot);
    const strengths = [
      p.homeAttackStrength!,
      p.awayAttackStrength!,
    ];
    const defs = [
      p.homeDefenseStrength!,
      p.awayDefenseStrength!,
    ];
    maxAtk = Math.max(maxAtk, ...strengths);
    minAtk = Math.min(minAtk, ...strengths);
    maxDef = Math.max(maxDef, ...defs);
    minDef = Math.min(minDef, ...defs);
    const probs = [
      p.markets!.matchTotals.over05,
      p.markets!.matchTotals.under05,
      p.markets!.btts.yes,
    ];
    for (const x of probs) {
      if (x < 1e-6) nearZero += 1;
      if (x > 1 - 1e-6) nearOne += 1;
    }
  }

  const byTotal = [...avail].sort(
    (a, b) => (b.expectedTotalGoals ?? 0) - (a.expectedTotalGoals ?? 0),
  );
  const extremes = [
    byTotal[0]!,
    byTotal[Math.floor(byTotal.length / 2)]!,
    byTotal[byTotal.length - 1]!,
  ].map((p) => ({
    fixtureId: p.fixtureId,
    kickoffUtc: p.kickoffUtc,
    muHome: p.muHome!,
    muAway: p.muAway!,
    expectedTotal: p.expectedTotalGoals!,
    homeAttackStrength: p.homeAttackStrength!,
    awayDefenseStrength: p.awayDefenseStrength!,
    awayAttackStrength: p.awayAttackStrength!,
    homeDefenseStrength: p.homeDefenseStrength!,
  }));

  return {
    minMuHome,
    maxMuHome,
    minMuAway,
    maxMuAway,
    minExpectedTotal: minTot,
    maxExpectedTotal: maxTot,
    maxAttackStrength: maxAtk,
    maxDefenseStrength: maxDef,
    minAttackStrength: minAtk,
    minDefenseStrength: minDef,
    nearZeroProbCount: nearZero,
    nearOneProbCount: nearOne,
    extremes,
  };
}

export type RawInstabilityAudit = {
  n: number;
  playedHome: { mean: number; p0: number; p50: number; p100: number };
  playedAway: { mean: number; p0: number; p50: number; p100: number };
  zeroRateCount: number;
  strengthLt025: number;
  strengthGt2: number;
  strengthGt3: number;
  muLt025: number;
  muGt3: number;
  muGt4: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx]!;
}

/**
 * Diagnostic: raw k=0 strengths/mus on rows with computed components
 * (includes UNAVAILABLE nonpositive-mu cases). Pass k=0 predictions.
 */
export function auditRawRateInstability(
  predictions: readonly GoalsG1Prediction[],
): RawInstabilityAudit {
  const rows = predictions.filter(
    (p) =>
      p.leagueHomeRate != null &&
      p.homeAttackStrength != null &&
      p.muHome != null,
  );
  const homePlayed = rows.map((p) => p.homeAttackPlayed).sort((a, b) => a - b);
  const awayPlayed = rows.map((p) => p.awayAttackPlayed).sort((a, b) => a - b);
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;

  let zeroRate = 0;
  let sLt = 0;
  let sGt2 = 0;
  let sGt3 = 0;
  let muLt = 0;
  let muGt3 = 0;
  let muGt4 = 0;

  for (const p of rows) {
    const strengths = [
      p.homeAttackStrength!,
      p.homeDefenseStrength!,
      p.awayAttackStrength!,
      p.awayDefenseStrength!,
    ];
    for (const s of strengths) {
      if (s === 0) zeroRate += 1;
      if (s < 0.25) sLt += 1;
      if (s > 2) sGt2 += 1;
      if (s > 3) sGt3 += 1;
    }
    for (const mu of [p.muHome!, p.muAway!]) {
      if (mu < 0.25) muLt += 1;
      if (mu > 3) muGt3 += 1;
      if (mu > 4) muGt4 += 1;
    }
  }

  return {
    n: rows.length,
    playedHome: {
      mean: mean(homePlayed),
      p0: percentile(homePlayed, 0),
      p50: percentile(homePlayed, 50),
      p100: percentile(homePlayed, 100),
    },
    playedAway: {
      mean: mean(awayPlayed),
      p0: percentile(awayPlayed, 0),
      p50: percentile(awayPlayed, 50),
      p100: percentile(awayPlayed, 100),
    },
    zeroRateCount: zeroRate,
    strengthLt025: sLt,
    strengthGt2: sGt2,
    strengthGt3: sGt3,
    muLt025: muLt,
    muGt3,
    muGt4,
  };
}
