/**
 * PE-4G.5 — Model C2: multinomial logistic with intercept + zD + abs(zD).
 * Deterministic Newton-Raphson with L2. AWAY is reference class.
 */

import { createHash } from "node:crypto";
import {
  normalizeOneXTwo,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import {
  PE4_EXPECTATION_REFINEMENT_C2_MAX_NEWTON_ITERS,
  PE4_EXPECTATION_REFINEMENT_C2_NEWTON_TOL,
  PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA,
} from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type ModelC2Artifact = {
  family: "MODEL_C2_MAGNITUDE";
  featureSchema: typeof PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA;
  dMean: number;
  dStd: number;
  l2Lambda: number;
  /** [intercept, zD, abs(zD)] for HOME vs AWAY */
  betaHome: [number, number, number];
  /** [intercept, zD, abs(zD)] for DRAW vs AWAY */
  betaDraw: [number, number, number];
  converged: boolean;
  iterations: number;
  trainingRowCount: number;
  featureCorrelationZAbs: number;
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

export function scaleD(D: number, mean: number, std: number): number {
  return (D - mean) / std;
}

export function c2Features(
  D: number,
  mean: number,
  std: number,
): [number, number, number] {
  const z = scaleD(D, mean, std);
  return [1, z, Math.abs(z)];
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den < 1e-15 ? 0 : num / den;
}

function softmaxAwayRef(
  x: [number, number, number],
  betaHome: [number, number, number],
  betaDraw: [number, number, number],
): OneXTwoProb {
  let logitH = 0;
  let logitD = 0;
  for (let k = 0; k < 3; k += 1) {
    logitH += x[k]! * betaHome[k]!;
    logitD += x[k]! * betaDraw[k]!;
  }
  const eH = Math.exp(Math.min(50, Math.max(-50, logitH)));
  const eD = Math.exp(Math.min(50, Math.max(-50, logitD)));
  const denom = 1 + eH + eD;
  return normalizeOneXTwo({
    HOME: eH / denom,
    DRAW: eD / denom,
    AWAY: 1 / denom,
  });
}

export function fitModelC2(input: {
  trainRows: readonly Pe4ExpectationDatasetRow[];
  l2Lambda: number;
}): ModelC2Artifact {
  const { trainRows, l2Lambda } = input;
  const Ds = trainRows.map((r) => r.strengthDifferentialHome);
  const { mean: dMean, std: dStd } = meanStd(Ds);

  const xs: [number, number, number][] = trainRows.map((r) =>
    c2Features(r.strengthDifferentialHome, dMean, dStd),
  );
  const ys = trainRows.map((r) => r.actualOutcome);
  const zVals = xs.map((x) => x[1]!);
  const absVals = xs.map((x) => x[2]!);
  const featureCorrelationZAbs = pearson(zVals, absVals);

  // 6 free params: betaHome[3] + betaDraw[3]
  const theta = [0, 0, 0, 0, 0, 0];
  let converged = false;
  let iterations = 0;
  const pDim = 3;

  for (
    let iter = 0;
    iter < PE4_EXPECTATION_REFINEMENT_C2_MAX_NEWTON_ITERS;
    iter += 1
  ) {
    iterations = iter + 1;
    const betaHome: [number, number, number] = [
      theta[0]!,
      theta[1]!,
      theta[2]!,
    ];
    const betaDraw: [number, number, number] = [
      theta[3]!,
      theta[4]!,
      theta[5]!,
    ];

    const grad = [0, 0, 0, 0, 0, 0];
    const hess = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0]);

    for (let i = 0; i < xs.length; i += 1) {
      const x = xs[i]!;
      const p = softmaxAwayRef(x, betaHome, betaDraw);
      const y = ys[i]!;
      const tH = y === "HOME" ? 1 : 0;
      const tD = y === "DRAW" ? 1 : 0;

      for (let k = 0; k < pDim; k += 1) {
        grad[k]! += -(tH - p.HOME) * x[k]!;
        grad[pDim + k]! += -(tD - p.DRAW) * x[k]!;
      }

      for (let a = 0; a < pDim; a += 1) {
        for (let b = 0; b < pDim; b += 1) {
          hess[a]![b]! += p.HOME * (1 - p.HOME) * x[a]! * x[b]!;
          hess[pDim + a]![pDim + b]! +=
            p.DRAW * (1 - p.DRAW) * x[a]! * x[b]!;
          hess[a]![pDim + b]! += -p.HOME * p.DRAW * x[a]! * x[b]!;
          hess[pDim + a]![b]! += -p.HOME * p.DRAW * x[a]! * x[b]!;
        }
      }
    }

    for (let j = 0; j < 6; j += 1) {
      grad[j]! += l2Lambda * theta[j]!;
      hess[j]![j]! += l2Lambda;
    }

    const A = hess.map((row) => [...row]);
    const g = [...grad];
    let singular = false;
    for (let col = 0; col < 6; col += 1) {
      let pivot = col;
      for (let r = col + 1; r < 6; r += 1) {
        if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r;
      }
      [A[col], A[pivot]] = [A[pivot]!, A[col]!];
      [g[col], g[pivot]] = [g[pivot]!, g[col]!];
      const diag = A[col]![col]!;
      if (Math.abs(diag) < 1e-14) {
        singular = true;
        break;
      }
      for (let r = col + 1; r < 6; r += 1) {
        const f = A[r]![col]! / diag;
        for (let c = col; c < 6; c += 1) A[r]![c]! -= f * A[col]![c]!;
        g[r]! -= f * g[col]!;
      }
    }
    if (singular) break;

    const delta = [0, 0, 0, 0, 0, 0];
    for (let r = 5; r >= 0; r -= 1) {
      let s = g[r]!;
      for (let c = r + 1; c < 6; c += 1) s -= A[r]![c]! * delta[c]!;
      delta[r] = s / A[r]![r]!;
    }

    let maxStep = 0;
    for (let j = 0; j < 6; j += 1) {
      theta[j]! -= delta[j]!;
      maxStep = Math.max(maxStep, Math.abs(delta[j]!));
    }
    if (maxStep < PE4_EXPECTATION_REFINEMENT_C2_NEWTON_TOL) {
      converged = true;
      break;
    }
  }

  const artifact: ModelC2Artifact = {
    family: "MODEL_C2_MAGNITUDE",
    featureSchema: PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA,
    dMean,
    dStd,
    l2Lambda,
    betaHome: [theta[0]!, theta[1]!, theta[2]!],
    betaDraw: [theta[3]!, theta[4]!, theta[5]!],
    converged,
    iterations,
    trainingRowCount: trainRows.length,
    featureCorrelationZAbs,
    parameterDigest: "",
  };
  artifact.parameterDigest = digestModelC2(artifact);
  return artifact;
}

export function digestModelC2(
  model: Omit<ModelC2Artifact, "parameterDigest"> & {
    parameterDigest?: string;
  },
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
    featureCorrelationZAbs: model.featureCorrelationZAbs,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function predictModelC2(
  model: ModelC2Artifact,
  rows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb[] {
  return rows.map((row) => {
    const x = c2Features(row.strengthDifferentialHome, model.dMean, model.dStd);
    return softmaxAwayRef(x, model.betaHome, model.betaDraw);
  });
}

export function predictModelC2FromD(
  model: ModelC2Artifact,
  D: number,
): OneXTwoProb {
  const x = c2Features(D, model.dMean, model.dStd);
  return softmaxAwayRef(x, model.betaHome, model.betaDraw);
}

export function modelC2DiagnosticGrid(
  model: ModelC2Artifact,
  dValues: readonly number[],
): { D: number; p: OneXTwoProb }[] {
  return dValues.map((D) => ({ D, p: predictModelC2FromD(model, D) }));
}

/** Structural validity check on diagnostic grid (pre-2024). */
export function assertModelC2DrawShapeValid(
  grid: readonly { D: number; p: OneXTwoProb }[],
): void {
  if (grid.length < 3) throw new Error("C2 diagnostic grid too short");
  for (const g of grid) {
    const s = g.p.HOME + g.p.DRAW + g.p.AWAY;
    if (
      !Number.isFinite(g.p.HOME) ||
      !Number.isFinite(g.p.DRAW) ||
      !Number.isFinite(g.p.AWAY) ||
      Math.abs(s - 1) > 1e-6
    ) {
      throw new Error(`C2 invalid simplex at D=${g.D}`);
    }
  }
  // HOME should generally rise with D across ends
  const first = grid[0]!;
  const last = grid[grid.length - 1]!;
  if (!(last.p.HOME > first.p.HOME && last.p.AWAY < first.p.AWAY)) {
    throw new Error("C2 structural failure: HOME/AWAY not ordered with D");
  }
  // DRAW should not spike to near-1 or near-0 exclusively at mid
  for (const g of grid) {
    if (g.p.DRAW > 0.95 || g.p.DRAW < 1e-5) {
      throw new Error(`C2 pathological DRAW at D=${g.D}: ${g.p.DRAW}`);
    }
  }
}
