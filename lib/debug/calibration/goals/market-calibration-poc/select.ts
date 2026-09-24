/**
 * GOALS-1G.2 — Grouped CAL_0 vs CAL_1 development selection.
 */

import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import {
  buildDevelopmentFolds,
  filterObsByFixtures,
  type GoalsMcalPocFold,
} from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import {
  applyLogisticCal,
  fitLogisticRecalibration,
  type LogisticFitResult,
} from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import {
  GOALS_MCAL_POC_GROUPS,
  GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN,
  GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT,
  GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN,
  type GoalsMcalPocCanonicalMarket,
  type GoalsMcalPocGroupId,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export type CalFamily = "CAL_0" | "CAL_1";

export type FoldMetrics = {
  foldId: string;
  cal0: { logLoss: number; brier: number; n: number };
  cal1: { logLoss: number; brier: number; n: number };
  o05Cal0?: { logLoss: number; brier: number; n: number };
  o05Cal1?: { logLoss: number; brier: number; n: number };
  fit: LogisticFitResult;
};

export type GroupSelectionResult = {
  groupId: GoalsMcalPocGroupId;
  markets: readonly GoalsMcalPocCanonicalMarket[];
  selectedFamily: CalFamily;
  reason: string;
  folds: FoldMetrics[];
  meanFoldLlCal0: number;
  meanFoldLlCal1: number;
  meanFoldBrierCal0: number;
  meanFoldBrierCal1: number;
  meanFoldLlImprovement: number;
  meanFoldBrierDelta: number;
  meanFoldO05LlWorsen: number | null;
  fullDevFit: LogisticFitResult | null;
  foldFits: LogisticFitResult[];
  parameterStability: "STABLE" | "MILDLY_UNSTABLE" | "UNSTABLE";
};

function poolGroupObs(
  obs: readonly GoalsMcalObservation[],
  markets: readonly GoalsMcalPocCanonicalMarket[],
): GoalsMcalObservation[] {
  const set = new Set<string>(markets);
  return obs.filter((o) => set.has(o.market));
}

function meanBinaryMetrics(
  rows: readonly GoalsMcalObservation[],
  pOf: (o: GoalsMcalObservation) => number,
): { logLoss: number; brier: number; n: number } {
  const n = rows.length;
  if (!n) return { logLoss: NaN, brier: NaN, n: 0 };
  let ll = 0;
  let br = 0;
  for (const o of rows) {
    const p = pOf(o);
    ll += binaryLogLoss(p, o.actualBinaryOutcome);
    br += binaryBrier(p, o.actualBinaryOutcome);
  }
  return { logLoss: ll / n, brier: br / n, n };
}

function classifyParameterStability(
  fits: readonly LogisticFitResult[],
): "STABLE" | "MILDLY_UNSTABLE" | "UNSTABLE" {
  if (!fits.length || fits.some((f) => !f.finite || !f.converged || f.slope <= 0)) {
    return "UNSTABLE";
  }
  const slopes = fits.map((f) => f.slope);
  const intercepts = fits.map((f) => f.intercept);
  const slopeRange = Math.max(...slopes) - Math.min(...slopes);
  const intRange = Math.max(...intercepts) - Math.min(...intercepts);
  if (slopes.some((s) => s > 5 || s < 0.2) || Math.abs(intRange) > 2) {
    return "UNSTABLE";
  }
  if (slopeRange > 0.5 || intRange > 0.5) return "MILDLY_UNSTABLE";
  return "STABLE";
}

export function selectGroupCalibrator(
  groupId: GoalsMcalPocGroupId,
  developmentObs: readonly GoalsMcalObservation[],
  folds?: GoalsMcalPocFold[],
): GroupSelectionResult {
  const markets = GOALS_MCAL_POC_GROUPS[groupId];
  const foldList = folds ?? buildDevelopmentFolds(developmentObs);
  const foldMetrics: FoldMetrics[] = [];
  const foldFits: LogisticFitResult[] = [];

  for (const fold of foldList) {
    const trainAll = filterObsByFixtures(developmentObs, fold.trainFixtureIds);
    const evalAll = filterObsByFixtures(developmentObs, fold.evalFixtureIds);
    const train = poolGroupObs(trainAll, markets);
    const evalRows = poolGroupObs(evalAll, markets);
    const fit = fitLogisticRecalibration(
      train.map((o) => o.rawProbability),
      train.map((o) => o.actualBinaryOutcome),
    );
    foldFits.push(fit);

    const cal0 = meanBinaryMetrics(evalRows, (o) => o.rawProbability);
    const cal1Ok = fit.finite && fit.slope > 0 && fit.converged;
    const cal1 = cal1Ok
      ? meanBinaryMetrics(evalRows, (o) =>
          applyLogisticCal(o.rawProbability, fit.intercept, fit.slope),
        )
      : { logLoss: Infinity, brier: Infinity, n: evalRows.length };

    const row: FoldMetrics = {
      foldId: fold.id,
      cal0,
      cal1,
      fit,
    };

    if (groupId === "GROUP_MATCH_TOTAL") {
      const o05Eval = evalAll.filter((o) => o.market === "MATCH_TOTAL_OVER_0_5");
      row.o05Cal0 = meanBinaryMetrics(o05Eval, (o) => o.rawProbability);
      row.o05Cal1 = cal1Ok
        ? meanBinaryMetrics(o05Eval, (o) =>
            applyLogisticCal(o.rawProbability, fit.intercept, fit.slope),
          )
        : { logLoss: Infinity, brier: Infinity, n: o05Eval.length };
    }
    foldMetrics.push(row);
  }

  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  const meanFoldLlCal0 = mean(foldMetrics.map((f) => f.cal0.logLoss));
  const meanFoldLlCal1 = mean(foldMetrics.map((f) => f.cal1.logLoss));
  const meanFoldBrierCal0 = mean(foldMetrics.map((f) => f.cal0.brier));
  const meanFoldBrierCal1 = mean(foldMetrics.map((f) => f.cal1.brier));
  const meanFoldLlImprovement = meanFoldLlCal0 - meanFoldLlCal1;
  const meanFoldBrierDelta = meanFoldBrierCal1 - meanFoldBrierCal0;

  let meanFoldO05LlWorsen: number | null = null;
  if (groupId === "GROUP_MATCH_TOTAL") {
    meanFoldO05LlWorsen =
      mean(foldMetrics.map((f) => f.o05Cal1!.logLoss)) -
      mean(foldMetrics.map((f) => f.o05Cal0!.logLoss));
  }

  const allFoldsPositiveSlope = foldFits.every(
    (f) => f.finite && f.converged && f.slope > 0,
  );

  const fullPool = poolGroupObs(developmentObs, markets);
  const fullDevFit = fitLogisticRecalibration(
    fullPool.map((o) => o.rawProbability),
    fullPool.map((o) => o.actualBinaryOutcome),
  );

  const stability = classifyParameterStability([...foldFits, fullDevFit]);

  let selectedFamily: CalFamily = "CAL_0";
  const reasons: string[] = [];

  if (!allFoldsPositiveSlope || !(fullDevFit.finite && fullDevFit.slope > 0)) {
    reasons.push("non_positive_or_nonfinite_slope_fail_closed");
  } else if (meanFoldLlImprovement < GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT) {
    reasons.push(
      `ll_improvement_${meanFoldLlImprovement.toFixed(6)}_below_min_${GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT}`,
    );
  } else if (meanFoldBrierDelta > GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN) {
    reasons.push(
      `brier_worsen_${meanFoldBrierDelta.toFixed(6)}_above_max_${GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN}`,
    );
  } else if (
    groupId === "GROUP_MATCH_TOTAL" &&
    meanFoldO05LlWorsen != null &&
    meanFoldO05LlWorsen > GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN
  ) {
    reasons.push(
      `o05_ll_worsen_${meanFoldO05LlWorsen.toFixed(6)}_above_max_${GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN}`,
    );
  } else {
    selectedFamily = "CAL_1";
    reasons.push("passed_frozen_min_gain_and_coherence_gates");
  }

  return {
    groupId,
    markets,
    selectedFamily,
    reason: reasons.join(";"),
    folds: foldMetrics,
    meanFoldLlCal0,
    meanFoldLlCal1,
    meanFoldBrierCal0,
    meanFoldBrierCal1: meanFoldBrierCal1,
    meanFoldLlImprovement,
    meanFoldBrierDelta,
    meanFoldO05LlWorsen,
    fullDevFit: selectedFamily === "CAL_1" ? fullDevFit : fullDevFit,
    foldFits,
    parameterStability: stability,
  };
}

export function selectAllGroups(
  developmentObs: readonly GoalsMcalObservation[],
): Record<GoalsMcalPocGroupId, GroupSelectionResult> {
  const folds = buildDevelopmentFolds(developmentObs);
  const groupIds: GoalsMcalPocGroupId[] = [
    "GROUP_MATCH_TOTAL",
    "GROUP_HOME_TOTAL",
    "GROUP_AWAY_TOTAL",
    "BTTS",
  ];
  const out = {} as Record<GoalsMcalPocGroupId, GroupSelectionResult>;
  for (const id of groupIds) {
    out[id] = selectGroupCalibrator(id, developmentObs, folds);
  }
  return out;
}
