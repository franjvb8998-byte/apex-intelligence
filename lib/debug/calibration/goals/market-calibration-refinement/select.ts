/**
 * GOALS-1G.3 — Development-only temporal selection among R0–R3.
 * 2024 must never enter this module's selection path.
 */

import { createHash } from "node:crypto";
import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import type { GoalsMcalObservation } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  buildDevelopmentFolds,
  filterObsByFixtures,
  type GoalsMcalPocFold,
} from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import {
  applyCandidateProbability,
  fitCandidateParams,
  trainMarketsForCandidate,
  type RefParams,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";
import { auditMatchTotalCoherence } from "@/lib/debug/calibration/goals/market-calibration-refinement/coherence";
import {
  GOALS_MCAL_REF_CANDIDATES,
  GOALS_MCAL_REF_COMPLEXITY_PREFERENCE,
  GOALS_MCAL_REF_MAX_BRIER_WORSEN,
  GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT,
  GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
  GOALS_MCAL_REF_O05_MAX_LL_WORSEN,
  GOALS_MCAL_REF_O15_MAX_LL_WORSEN,
  GOALS_MCAL_REF_TIE_LL_TOLERANCE,
  type GoalsMcalRefCandidateId,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";

export type ThresholdMetrics = {
  logLoss: number;
  brier: number;
  n: number;
  citl: number;
};

export type CandidateFoldEval = {
  foldId: string;
  aggregate: ThresholdMetrics;
  byMarket: Record<string, ThresholdMetrics>;
  params: RefParams;
  coherence: ReturnType<typeof auditMatchTotalCoherence>;
};

export type CandidateDevResult = {
  candidateId: GoalsMcalRefCandidateId;
  eligible: boolean;
  ineligibilityReasons: string[];
  folds: CandidateFoldEval[];
  meanFoldAggLl: number;
  meanFoldAggBrier: number;
  meanFoldO05Ll: number;
  meanFoldO15Ll: number;
  meanFoldAggLlImprovementVsR0: number;
  meanFoldBrierDeltaVsR0: number;
  meanFoldO05LlWorsenVsR0: number;
  meanFoldO15LlWorsenVsR0: number;
  fullDevParams: RefParams;
  fullDevCoherence: ReturnType<typeof auditMatchTotalCoherence>;
  parameterStability: "STABLE" | "MILDLY_UNSTABLE" | "UNSTABLE" | "NA";
};

function matchTotal(obs: readonly GoalsMcalObservation[]): GoalsMcalObservation[] {
  const set = new Set<string>(GOALS_MCAL_REF_MATCH_TOTAL_MARKETS);
  return obs.filter((o) => set.has(o.market));
}

function metricsFor(
  rows: readonly GoalsMcalObservation[],
  params: RefParams,
): ThresholdMetrics {
  const n = rows.length;
  if (!n) return { logLoss: NaN, brier: NaN, n: 0, citl: NaN };
  let ll = 0;
  let br = 0;
  let sumP = 0;
  let sumY = 0;
  for (const o of rows) {
    const p = applyCandidateProbability(o.market, o.rawProbability, params);
    ll += binaryLogLoss(p, o.actualBinaryOutcome);
    br += binaryBrier(p, o.actualBinaryOutcome);
    sumP += p;
    sumY += o.actualBinaryOutcome;
  }
  return {
    logLoss: ll / n,
    brier: br / n,
    n,
    citl: sumY / n - sumP / n,
  };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function classifyStability(
  candidateId: GoalsMcalRefCandidateId,
  folds: CandidateFoldEval[],
  full: RefParams,
): CandidateDevResult["parameterStability"] {
  if (candidateId === "R0") return "NA";
  const fits = [...folds.map((f) => f.params), full];
  if (fits.some((f) => !f.finite || !f.converged)) return "UNSTABLE";
  if (candidateId !== "R2" && fits.some((f) => (f.slope ?? 0) <= 0)) {
    return "UNSTABLE";
  }
  const intercepts = fits.map((f) => f.intercept!).filter(Number.isFinite);
  const slopes = fits
    .map((f) => f.slope!)
    .filter((s) => Number.isFinite(s));
  const intRange = Math.max(...intercepts) - Math.min(...intercepts);
  const slopeRange = Math.max(...slopes) - Math.min(...slopes);
  if (intRange > 2 || slopeRange > 1) return "UNSTABLE";
  if (intRange > 0.5 || slopeRange > 0.35) return "MILDLY_UNSTABLE";
  return "STABLE";
}

function fitOnTrain(
  candidateId: GoalsMcalRefCandidateId,
  trainObs: readonly GoalsMcalObservation[],
): RefParams {
  const markets = trainMarketsForCandidate(candidateId);
  if (candidateId === "R0") {
    return fitCandidateParams("R0", [], [], []);
  }
  const rows = trainObs.filter((o) =>
    (markets as readonly string[]).includes(o.market),
  );
  return fitCandidateParams(
    candidateId,
    rows.map((o) => o.rawProbability),
    rows.map((o) => o.actualBinaryOutcome),
    markets,
  );
}

export function evaluateCandidateOnDevelopment(
  candidateId: GoalsMcalRefCandidateId,
  developmentObs: readonly GoalsMcalObservation[],
  folds: GoalsMcalPocFold[],
): CandidateDevResult {
  const mtDev = matchTotal(developmentObs);
  const foldEvals: CandidateFoldEval[] = [];

  for (const fold of folds) {
    const train = filterObsByFixtures(mtDev, fold.trainFixtureIds);
    const evalRows = filterObsByFixtures(mtDev, fold.evalFixtureIds);
    const params = fitOnTrain(candidateId, train);
    const byMarket: Record<string, ThresholdMetrics> = {};
    for (const m of GOALS_MCAL_REF_MATCH_TOTAL_MARKETS) {
      byMarket[m] = metricsFor(
        evalRows.filter((o) => o.market === m),
        params,
      );
    }
    foldEvals.push({
      foldId: fold.id,
      aggregate: metricsFor(evalRows, params),
      byMarket,
      params,
      coherence: auditMatchTotalCoherence(evalRows, params),
    });
  }

  const fullDevParams = fitOnTrain(candidateId, mtDev);
  const fullDevCoherence = auditMatchTotalCoherence(mtDev, fullDevParams);

  return {
    candidateId,
    eligible: true, // filled later vs R0
    ineligibilityReasons: [],
    folds: foldEvals,
    meanFoldAggLl: mean(foldEvals.map((f) => f.aggregate.logLoss)),
    meanFoldAggBrier: mean(foldEvals.map((f) => f.aggregate.brier)),
    meanFoldO05Ll: mean(
      foldEvals.map((f) => f.byMarket.MATCH_TOTAL_OVER_0_5!.logLoss),
    ),
    meanFoldO15Ll: mean(
      foldEvals.map((f) => f.byMarket.MATCH_TOTAL_OVER_1_5!.logLoss),
    ),
    meanFoldAggLlImprovementVsR0: NaN,
    meanFoldBrierDeltaVsR0: NaN,
    meanFoldO05LlWorsenVsR0: NaN,
    meanFoldO15LlWorsenVsR0: NaN,
    fullDevParams,
    fullDevCoherence,
    parameterStability: classifyStability(candidateId, foldEvals, fullDevParams),
  };
}

function applyEligibility(
  c: CandidateDevResult,
  r0: CandidateDevResult,
): CandidateDevResult {
  const reasons: string[] = [];
  const aggImp = r0.meanFoldAggLl - c.meanFoldAggLl;
  const brierDelta = c.meanFoldAggBrier - r0.meanFoldAggBrier;
  const o05Worsen = c.meanFoldO05Ll - r0.meanFoldO05Ll;
  const o15Worsen = c.meanFoldO15Ll - r0.meanFoldO15Ll;

  c.meanFoldAggLlImprovementVsR0 = aggImp;
  c.meanFoldBrierDeltaVsR0 = brierDelta;
  c.meanFoldO05LlWorsenVsR0 = o05Worsen;
  c.meanFoldO15LlWorsenVsR0 = o15Worsen;

  if (c.candidateId === "R0") {
    c.eligible = true;
    c.ineligibilityReasons = [];
    return c;
  }

  // Coherence
  const anyCohFail =
    !c.fullDevCoherence.coherenceValid ||
    c.folds.some((f) => !f.coherence.coherenceValid);
  if (anyCohFail) {
    reasons.push("coherence_invalid");
  }

  // Finite / slope for free-slope candidates
  if (c.candidateId === "R1" || c.candidateId === "R3") {
    if (
      !c.fullDevParams.finite ||
      (c.fullDevParams.slope ?? 0) <= 0 ||
      c.folds.some((f) => !f.params.finite || (f.params.slope ?? 0) <= 0)
    ) {
      reasons.push("non_positive_or_nonfinite_slope");
    }
  }
  if (c.candidateId === "R2") {
    if (!c.fullDevParams.finite || c.fullDevParams.slope !== 1) {
      reasons.push("r2_intercept_fit_failed");
    }
  }

  if (aggImp < GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT) {
    reasons.push(
      `agg_ll_improvement_${aggImp.toFixed(6)}_below_min_${GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT}`,
    );
  }
  if (brierDelta > GOALS_MCAL_REF_MAX_BRIER_WORSEN) {
    reasons.push(
      `brier_worsen_${brierDelta.toFixed(6)}_above_max_${GOALS_MCAL_REF_MAX_BRIER_WORSEN}`,
    );
  }
  if (o05Worsen > GOALS_MCAL_REF_O05_MAX_LL_WORSEN) {
    reasons.push(
      `o05_ll_worsen_${o05Worsen.toFixed(6)}_above_max_${GOALS_MCAL_REF_O05_MAX_LL_WORSEN}`,
    );
  }
  if (o15Worsen > GOALS_MCAL_REF_O15_MAX_LL_WORSEN) {
    reasons.push(
      `o15_ll_worsen_${o15Worsen.toFixed(6)}_above_max_${GOALS_MCAL_REF_O15_MAX_LL_WORSEN}`,
    );
  }

  // R3 high thresholds must equal raw on full-dev application
  if (c.candidateId === "R3") {
    for (const m of ["MATCH_TOTAL_OVER_2_5", "MATCH_TOTAL_OVER_3_5", "MATCH_TOTAL_OVER_4_5"]) {
      if (c.fullDevParams.appliedMarkets.includes(m)) {
        reasons.push("r3_high_threshold_incorrectly_applied");
      }
    }
  }

  c.ineligibilityReasons = reasons;
  c.eligible = reasons.length === 0;
  return c;
}

export type SelectionResult = {
  selected: GoalsMcalRefCandidateId;
  reason: string;
  candidates: Record<GoalsMcalRefCandidateId, CandidateDevResult>;
  selectionEvidenceDigest: string;
};

export function selectRefinementCandidate(
  developmentObs: readonly GoalsMcalObservation[],
  folds?: GoalsMcalPocFold[],
): SelectionResult {
  // Hard guard: developmentObs must not contain 2024/2025
  for (const o of developmentObs) {
    if (o.season !== "2023") {
      throw new Error(
        `Selection must use 2023 only; found season ${o.season}`,
      );
    }
  }

  const foldList = folds ?? buildDevelopmentFolds(developmentObs);
  const results = {} as Record<GoalsMcalRefCandidateId, CandidateDevResult>;

  for (const id of GOALS_MCAL_REF_CANDIDATES) {
    results[id] = evaluateCandidateOnDevelopment(id, developmentObs, foldList);
  }
  const r0 = results.R0!;
  for (const id of GOALS_MCAL_REF_CANDIDATES) {
    results[id] = applyEligibility(results[id]!, r0);
  }

  const eligible = GOALS_MCAL_REF_CANDIDATES.filter(
    (id) => results[id]!.eligible,
  );
  let selected: GoalsMcalRefCandidateId = "R0";
  let reason = "default_R0";

  if (eligible.length === 1 && eligible[0] === "R0") {
    reason = "only_R0_eligible";
  } else if (eligible.length > 0) {
    const bestLl = Math.min(
      ...eligible.map((id) => results[id]!.meanFoldAggLl),
    );
    const tied = eligible.filter(
      (id) =>
        results[id]!.meanFoldAggLl <= bestLl + GOALS_MCAL_REF_TIE_LL_TOLERANCE,
    );
    for (const pref of GOALS_MCAL_REF_COMPLEXITY_PREFERENCE) {
      if (tied.includes(pref)) {
        selected = pref;
        reason =
          tied.length > 1
            ? `tie_complexity_preference_${pref}_among_${tied.join(",")}`
            : `best_mean_fold_agg_ll_${pref}`;
        break;
      }
    }
  }

  const evidence = {
    selected,
    reason,
    eligible,
    meanFoldAggLl: Object.fromEntries(
      GOALS_MCAL_REF_CANDIDATES.map((id) => [
        id,
        results[id]!.meanFoldAggLl,
      ]),
    ),
    improvements: Object.fromEntries(
      GOALS_MCAL_REF_CANDIDATES.map((id) => [
        id,
        results[id]!.meanFoldAggLlImprovementVsR0,
      ]),
    ),
    ineligibility: Object.fromEntries(
      GOALS_MCAL_REF_CANDIDATES.map((id) => [
        id,
        results[id]!.ineligibilityReasons,
      ]),
    ),
    parameterDigests: Object.fromEntries(
      GOALS_MCAL_REF_CANDIDATES.map((id) => [
        id,
        results[id]!.fullDevParams.parameterDigest,
      ]),
    ),
  };

  return {
    selected,
    reason,
    candidates: results,
    selectionEvidenceDigest: createHash("sha256")
      .update(JSON.stringify(evidence), "utf8")
      .digest("hex"),
  };
}
