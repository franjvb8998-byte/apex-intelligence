/**
 * GOALS-1G.2 — Deterministic logistic recalibration (CAL_1).
 * logit(p_cal) = a + b * logit(p_raw)
 */

import { createHash } from "node:crypto";
import {
  GOALS_MCAL_POC_LOGIT_EPSILON,
  GOALS_MCAL_POC_RIDGE_LAMBDA,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export function clipLogitP(
  p: number,
  eps: number = GOALS_MCAL_POC_LOGIT_EPSILON,
): number {
  return Math.min(1 - eps, Math.max(eps, p));
}

export function logit(
  p: number,
  eps: number = GOALS_MCAL_POC_LOGIT_EPSILON,
): number {
  const pp = clipLogitP(p, eps);
  return Math.log(pp / (1 - pp));
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function applyLogisticCal(
  pRaw: number,
  intercept: number,
  slope: number,
  eps: number = GOALS_MCAL_POC_LOGIT_EPSILON,
): number {
  if (!Number.isFinite(pRaw) || !Number.isFinite(intercept) || !Number.isFinite(slope)) {
    return NaN;
  }
  return sigmoid(intercept + slope * logit(pRaw, eps));
}

/** Identity: a=0, b=1 ⇒ p_cal = p_raw (up to clip). */
export function applyIdentityCal(pRaw: number): number {
  return pRaw;
}

export type LogisticFitResult = {
  intercept: number;
  slope: number;
  converged: boolean;
  iterations: number;
  fitN: number;
  positiveN: number;
  negativeN: number;
  clippingEpsilon: number;
  ridgeLambda: number;
  parameterDigest: string;
  finite: boolean;
};

export function digestLogisticParams(a: number, b: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        intercept: a,
        slope: b,
        rounding: "float64_json",
      }),
      "utf8",
    )
    .digest("hex");
}

/**
 * IRLS Newton for binary logistic: P(Y=1|x) = σ(a + b x)
 * with ridge: λ/2 * (a^2 + (b-1)^2) toward identity.
 */
export function fitLogisticRecalibration(
  probs: readonly number[],
  outcomes: readonly (0 | 1)[],
  opts?: {
    eps?: number;
    ridgeLambda?: number;
    maxIter?: number;
  },
): LogisticFitResult {
  const eps = opts?.eps ?? GOALS_MCAL_POC_LOGIT_EPSILON;
  const ridge = opts?.ridgeLambda ?? GOALS_MCAL_POC_RIDGE_LAMBDA;
  const maxIter = opts?.maxIter ?? 40;
  const n = probs.length;
  const positiveN = outcomes.filter((y) => y === 1).length;
  const negativeN = n - positiveN;

  if (n < 10 || positiveN === 0 || negativeN === 0) {
    return {
      intercept: NaN,
      slope: NaN,
      converged: false,
      iterations: 0,
      fitN: n,
      positiveN,
      negativeN,
      clippingEpsilon: eps,
      ridgeLambda: ridge,
      parameterDigest: digestLogisticParams(NaN, NaN),
      finite: false,
    };
  }

  const xs = probs.map((p) => logit(p, eps));
  let a = 0;
  let b = 1;
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter += 1) {
    iterations = iter + 1;
    let g0 = -ridge * a;
    let g1 = -ridge * (b - 1);
    let h00 = ridge;
    let h01 = 0;
    let h11 = ridge;
    for (let i = 0; i < n; i += 1) {
      const eta = a + b * xs[i]!;
      const p = sigmoid(eta);
      const w = p * (1 - p);
      const r = outcomes[i]! - p;
      g0 += r;
      g1 += r * xs[i]!;
      h00 += w;
      h01 += w * xs[i]!;
      h11 += w * xs[i]! * xs[i]!;
    }
    const det = h00 * h11 - h01 * h01;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-18) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (-h01 * g0 + h00 * g1) / det;
    a += da;
    b += db;
    if (Math.abs(da) < 1e-10 && Math.abs(db) < 1e-10) {
      converged = true;
      break;
    }
  }

  const finite = Number.isFinite(a) && Number.isFinite(b);
  return {
    intercept: a,
    slope: b,
    converged,
    iterations,
    fitN: n,
    positiveN,
    negativeN,
    clippingEpsilon: eps,
    ridgeLambda: ridge,
    parameterDigest: digestLogisticParams(a, b),
    finite,
  };
}
