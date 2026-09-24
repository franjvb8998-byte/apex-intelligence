/**
 * GOALS-1G.3 — Candidate transforms R0–R3 (match-total only).
 */

import { createHash } from "node:crypto";
import {
  applyLogisticCal,
  digestLogisticParams,
  fitLogisticRecalibration,
  logit,
  sigmoid,
  type LogisticFitResult,
} from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import {
  GOALS_MCAL_REF_HIGH_THRESHOLD_MARKETS,
  GOALS_MCAL_REF_LOGIT_EPSILON,
  GOALS_MCAL_REF_LOW_THRESHOLD_MARKETS,
  GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
  GOALS_MCAL_REF_RIDGE_LAMBDA,
  type GoalsMcalRefCandidateId,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";

export type RefParams = {
  candidateId: GoalsMcalRefCandidateId;
  intercept: number | null;
  slope: number | null;
  fitN: number;
  positiveN: number;
  negativeN: number;
  converged: boolean;
  finite: boolean;
  parameterDigest: string;
  /** Markets that receive the transform (others stay raw). */
  appliedMarkets: readonly string[];
};

function emptyParams(id: GoalsMcalRefCandidateId): RefParams {
  return {
    candidateId: id,
    intercept: null,
    slope: null,
    fitN: 0,
    positiveN: 0,
    negativeN: 0,
    converged: true,
    finite: true,
    parameterDigest: createHash("sha256")
      .update(`${id}_IDENTITY`)
      .digest("hex"),
    appliedMarkets: [],
  };
}

/**
 * Intercept-only IRLS: logit(p_cal) = a + 1*logit(p_raw). Slope fixed at 1.
 * Ridge: λ/2 * a^2 toward a=0.
 */
export function fitInterceptOnly(
  probs: readonly number[],
  outcomes: readonly (0 | 1)[],
  opts?: { eps?: number; ridgeLambda?: number; maxIter?: number },
): LogisticFitResult {
  const eps = opts?.eps ?? GOALS_MCAL_REF_LOGIT_EPSILON;
  const ridge = opts?.ridgeLambda ?? GOALS_MCAL_REF_RIDGE_LAMBDA;
  const maxIter = opts?.maxIter ?? 40;
  const n = probs.length;
  const positiveN = outcomes.filter((y) => y === 1).length;
  const negativeN = n - positiveN;

  if (n < 10 || positiveN === 0 || negativeN === 0) {
    return {
      intercept: NaN,
      slope: 1,
      converged: false,
      iterations: 0,
      fitN: n,
      positiveN,
      negativeN,
      clippingEpsilon: eps,
      ridgeLambda: ridge,
      parameterDigest: digestLogisticParams(NaN, 1),
      finite: false,
    };
  }

  const xs = probs.map((p) => logit(p, eps));
  let a = 0;
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter += 1) {
    iterations = iter + 1;
    let g = -ridge * a;
    let h = ridge;
    for (let i = 0; i < n; i += 1) {
      const eta = a + xs[i]!;
      const p = sigmoid(eta);
      const w = p * (1 - p);
      g += outcomes[i]! - p;
      h += w;
    }
    if (!Number.isFinite(h) || Math.abs(h) < 1e-18) break;
    const da = g / h;
    a += da;
    if (Math.abs(da) < 1e-10) {
      converged = true;
      break;
    }
  }

  const finite = Number.isFinite(a);
  return {
    intercept: a,
    slope: 1,
    converged,
    iterations,
    fitN: n,
    positiveN,
    negativeN,
    clippingEpsilon: eps,
    ridgeLambda: ridge,
    parameterDigest: digestLogisticParams(a, 1),
    finite,
  };
}

export function fitCandidateParams(
  candidateId: GoalsMcalRefCandidateId,
  probs: readonly number[],
  outcomes: readonly (0 | 1)[],
  appliedMarkets: readonly string[],
): RefParams {
  if (candidateId === "R0") return emptyParams("R0");

  if (candidateId === "R2") {
    const fit = fitInterceptOnly(probs, outcomes);
    return {
      candidateId: "R2",
      intercept: fit.finite ? fit.intercept : null,
      slope: 1,
      fitN: fit.fitN,
      positiveN: fit.positiveN,
      negativeN: fit.negativeN,
      converged: fit.converged,
      finite: fit.finite,
      parameterDigest: fit.parameterDigest,
      appliedMarkets: [...GOALS_MCAL_REF_MATCH_TOTAL_MARKETS],
    };
  }

  // R1 full shared, R3 low-threshold shared — both free (a,b)
  const fit = fitLogisticRecalibration(probs, outcomes, {
    eps: GOALS_MCAL_REF_LOGIT_EPSILON,
    ridgeLambda: GOALS_MCAL_REF_RIDGE_LAMBDA,
  });
  return {
    candidateId,
    intercept: fit.finite ? fit.intercept : null,
    slope: fit.finite ? fit.slope : null,
    fitN: fit.fitN,
    positiveN: fit.positiveN,
    negativeN: fit.negativeN,
    converged: fit.converged,
    finite: fit.finite && fit.slope > 0,
    parameterDigest: fit.parameterDigest,
    appliedMarkets: [...appliedMarkets],
  };
}

export function trainMarketsForCandidate(
  candidateId: GoalsMcalRefCandidateId,
): readonly string[] {
  if (candidateId === "R0") return [];
  if (candidateId === "R3") return GOALS_MCAL_REF_LOW_THRESHOLD_MARKETS;
  return GOALS_MCAL_REF_MATCH_TOTAL_MARKETS;
}

export function applyCandidateProbability(
  market: string,
  pRaw: number,
  params: RefParams,
): number {
  if (params.candidateId === "R0") return pRaw;
  if (!params.appliedMarkets.includes(market)) return pRaw;
  if (
    params.intercept == null ||
    params.slope == null ||
    !params.finite ||
    params.slope <= 0
  ) {
    return pRaw;
  }
  return applyLogisticCal(pRaw, params.intercept, params.slope);
}

export function assertR2SlopeExact(params: RefParams): void {
  if (params.candidateId !== "R2") return;
  if (params.slope !== 1) {
    throw new Error(`R2 slope must be exactly 1, got ${params.slope}`);
  }
}

export function assertR3HighThresholdsRaw(
  market: string,
  pRaw: number,
  pCal: number,
  candidateId: GoalsMcalRefCandidateId,
): void {
  if (candidateId !== "R3") return;
  if (
    (GOALS_MCAL_REF_HIGH_THRESHOLD_MARKETS as readonly string[]).includes(
      market,
    ) &&
    pCal !== pRaw
  ) {
    throw new Error(`R3 high threshold ${market} must remain raw`);
  }
}
