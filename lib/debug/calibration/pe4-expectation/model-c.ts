/**
 * PE-4G.4 — Model C: multinomial logistic 1X2 on intercept + z-scored D.
 * Deterministic Newton-Raphson with L2. AWAY is reference class.
 */

import { createHash } from "node:crypto";
import {
  PE4_EXPECTATION_POC_MODEL_C_MAX_NEWTON_ITERS,
  PE4_EXPECTATION_POC_MODEL_C_NEWTON_TOL,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import {
  normalizeOneXTwo,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type ModelCArtifact = {
  family: "MODEL_C_MULTINOMIAL_LOGIT";
  featureSchema: "intercept_plus_z_D";
  dMean: number;
  dStd: number;
  l2Lambda: number;
  betaHome: [number, number];
  betaDraw: [number, number];
  converged: boolean;
  iterations: number;
  trainingRowCount: number;
  parameterDigest: string;
};

function meanStd(values: number[]): { mean: number; std: number } {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let varSum = 0;
  for (const v of values) varSum += (v - mean) ** 2;
  const std = Math.sqrt(varSum / n);
  return { mean, std: std < 1e-9 ? 1 : std };
}

function scaleD(D: number, mean: number, std: number): number {
  return (D - mean) / std;
}

function softmaxAwayRef(
  x: [number, number],
  betaHome: [number, number],
  betaDraw: [number, number],
): OneXTwoProb {
  const logitH = x[0] * betaHome[0] + x[1] * betaHome[1];
  const logitD = x[0] * betaDraw[0] + x[1] * betaDraw[1];
  const eH = Math.exp(Math.min(50, Math.max(-50, logitH)));
  const eD = Math.exp(Math.min(50, Math.max(-50, logitD)));
  const denom = 1 + eH + eD;
  return normalizeOneXTwo({
    HOME: eH / denom,
    DRAW: eD / denom,
    AWAY: 1 / denom,
  });
}

export function fitModelC(input: {
  trainRows: readonly Pe4ExpectationDatasetRow[];
  l2Lambda: number;
}): ModelCArtifact {
  const { trainRows, l2Lambda } = input;
  const Ds = trainRows.map((r) => r.strengthDifferentialHome);
  const { mean: dMean, std: dStd } = meanStd(Ds);

  const xs: [number, number][] = trainRows.map((r) => [
    1,
    scaleD(r.strengthDifferentialHome, dMean, dStd),
  ]);
  const ys = trainRows.map((r) => r.actualOutcome);

  const theta = [0, 0, 0, 0];
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < PE4_EXPECTATION_POC_MODEL_C_MAX_NEWTON_ITERS; iter += 1) {
    iterations = iter + 1;
    const betaHome: [number, number] = [theta[0]!, theta[1]!];
    const betaDraw: [number, number] = [theta[2]!, theta[3]!];

    const grad = [0, 0, 0, 0];
    const hess = Array.from({ length: 4 }, () => [0, 0, 0, 0]);

    for (let i = 0; i < xs.length; i += 1) {
      const x = xs[i]!;
      const p = softmaxAwayRef(x, betaHome, betaDraw);
      const y = ys[i]!;
      const tH = y === "HOME" ? 1 : 0;
      const tD = y === "DRAW" ? 1 : 0;

      for (let k = 0; k < 2; k += 1) {
        grad[k]! += -(tH - p.HOME) * x[k]!;
        grad[2 + k]! += -(tD - p.DRAW) * x[k]!;
      }

      for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
          // Correct multinomial Hessian (AWAY reference):
          // H_HH = pH(1-pH) xxᵀ, H_DD = pD(1-pD) xxᵀ, H_HD = -pH pD xxᵀ
          hess[a]![b]! += p.HOME * (1 - p.HOME) * x[a]! * x[b]!;
          hess[2 + a]![2 + b]! += p.DRAW * (1 - p.DRAW) * x[a]! * x[b]!;
          hess[a]![2 + b]! += -p.HOME * p.DRAW * x[a]! * x[b]!;
          hess[2 + a]![b]! += -p.HOME * p.DRAW * x[a]! * x[b]!;
        }
      }
    }

    for (let j = 0; j < 4; j += 1) {
      grad[j]! += l2Lambda * theta[j]!;
      hess[j]![j]! += l2Lambda;
    }

    const A = hess.map((row) => [...row]);
    const g = [...grad];
    let singular = false;
    for (let col = 0; col < 4; col += 1) {
      let pivot = col;
      for (let r = col + 1; r < 4; r += 1) {
        if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r;
      }
      [A[col], A[pivot]] = [A[pivot]!, A[col]!];
      [g[col], g[pivot]] = [g[pivot]!, g[col]!];
      const diag = A[col]![col]!;
      if (Math.abs(diag) < 1e-14) {
        singular = true;
        break;
      }
      for (let r = col + 1; r < 4; r += 1) {
        const f = A[r]![col]! / diag;
        for (let c = col; c < 4; c += 1) A[r]![c]! -= f * A[col]![c]!;
        g[r]! -= f * g[col]!;
      }
    }
    if (singular) break;

    const delta = [0, 0, 0, 0];
    for (let r = 3; r >= 0; r -= 1) {
      let s = g[r]!;
      for (let c = r + 1; c < 4; c += 1) s -= A[r]![c]! * delta[c]!;
      delta[r] = s / A[r]![r]!;
    }

    let maxStep = 0;
    for (let j = 0; j < 4; j += 1) {
      theta[j]! -= delta[j]!;
      maxStep = Math.max(maxStep, Math.abs(delta[j]!));
    }
    if (maxStep < PE4_EXPECTATION_POC_MODEL_C_NEWTON_TOL) {
      converged = true;
      break;
    }
  }

  const artifact: ModelCArtifact = {
    family: "MODEL_C_MULTINOMIAL_LOGIT",
    featureSchema: "intercept_plus_z_D",
    dMean,
    dStd,
    l2Lambda,
    betaHome: [theta[0]!, theta[1]!],
    betaDraw: [theta[2]!, theta[3]!],
    converged,
    iterations,
    trainingRowCount: trainRows.length,
    parameterDigest: "",
  };
  artifact.parameterDigest = digestModelC(artifact);
  return artifact;
}

export function digestModelC(
  model: Omit<ModelCArtifact, "parameterDigest"> & { parameterDigest?: string },
): string {
  const payload = JSON.stringify({
    family: model.family,
    featureSchema: model.featureSchema,
    dMean: model.dMean,
    dStd: model.dStd,
    l2Lambda: model.l2Lambda,
    betaHome: model.betaHome,
    betaDraw: model.betaDraw,
    converged: model.converged,
    iterations: model.iterations,
    trainingRowCount: model.trainingRowCount,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function predictModelC(
  model: ModelCArtifact,
  rows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb[] {
  return rows.map((row) => {
    const x: [number, number] = [
      1,
      scaleD(row.strengthDifferentialHome, model.dMean, model.dStd),
    ];
    return softmaxAwayRef(x, model.betaHome, model.betaDraw);
  });
}

export function modelCDiagnosticGrid(
  model: ModelCArtifact,
  dValues: readonly number[],
): { D: number; p: OneXTwoProb }[] {
  return dValues.map((D) => {
    const x: [number, number] = [1, scaleD(D, model.dMean, model.dStd)];
    return { D, p: softmaxAwayRef(x, model.betaHome, model.betaDraw) };
  });
}
