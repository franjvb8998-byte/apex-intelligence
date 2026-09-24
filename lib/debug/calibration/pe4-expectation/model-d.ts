/**
 * PE-4G.4 — Model D: empirical D bins + Dirichlet shrinkage toward train prior.
 */

import { createHash } from "node:crypto";
import {
  PE4_EXPECTATION_POC_MODEL_D_OUTER_STEPS,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import {
  empiricalOneXTwo,
  normalizeOneXTwo,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type ModelDBin = {
  id: string;
  /** Inclusive lower bound; -Infinity for outer left. */
  minInclusive: number;
  /** Exclusive upper bound; +Infinity for outer right. */
  maxExclusive: number;
  trainCount: number;
  empirical: OneXTwoProb;
  shrunk: OneXTwoProb;
};

export type ModelDArtifact = {
  family: "MODEL_D_EMPIRICAL_BINS";
  binWidth: number;
  shrinkKappa: number;
  globalPrior: OneXTwoProb;
  bins: ModelDBin[];
  trainingRowCount: number;
  parameterDigest: string;
};

function buildEdges(binWidth: number): number[] {
  const steps = PE4_EXPECTATION_POC_MODEL_D_OUTER_STEPS;
  const edges: number[] = [];
  for (let k = -steps; k <= steps; k += 1) {
    edges.push(k * binWidth);
  }
  return edges;
}

/** Assign D to a bin index; extremes fall into open outer bins. */
export function modelDBinIndex(D: number, binWidth: number): number {
  const edges = buildEdges(binWidth);
  // bins: (-inf, edges[0]), [edges[0], edges[1]), ..., [edges[n-1], +inf)
  if (D < edges[0]!) return 0;
  for (let i = 0; i < edges.length - 1; i += 1) {
    if (D >= edges[i]! && D < edges[i + 1]!) return i + 1;
  }
  return edges.length; // right outer
}

function binBounds(
  index: number,
  binWidth: number,
): { minInclusive: number; maxExclusive: number; id: string } {
  const edges = buildEdges(binWidth);
  if (index === 0) {
    return {
      minInclusive: Number.NEGATIVE_INFINITY,
      maxExclusive: edges[0]!,
      id: `(-inf,${edges[0]})`,
    };
  }
  if (index === edges.length) {
    return {
      minInclusive: edges[edges.length - 1]!,
      maxExclusive: Number.POSITIVE_INFINITY,
      id: `[${edges[edges.length - 1]},+inf)`,
    };
  }
  return {
    minInclusive: edges[index - 1]!,
    maxExclusive: edges[index]!,
    id: `[${edges[index - 1]},${edges[index]})`,
  };
}

function binCount(binWidth: number): number {
  return buildEdges(binWidth).length + 1;
}

function shrink(
  counts: { HOME: number; DRAW: number; AWAY: number },
  n: number,
  prior: OneXTwoProb,
  kappa: number,
): OneXTwoProb {
  return normalizeOneXTwo({
    HOME: (counts.HOME + kappa * prior.HOME) / (n + kappa),
    DRAW: (counts.DRAW + kappa * prior.DRAW) / (n + kappa),
    AWAY: (counts.AWAY + kappa * prior.AWAY) / (n + kappa),
  });
}

export function fitModelD(input: {
  trainRows: readonly Pe4ExpectationDatasetRow[];
  binWidth: number;
  shrinkKappa: number;
}): ModelDArtifact {
  const { trainRows, binWidth, shrinkKappa } = input;
  const prior = empiricalOneXTwo(trainRows.map((r) => r.actualOutcome));
  const nBins = binCount(binWidth);
  const counts = Array.from({ length: nBins }, () => ({
    HOME: 0,
    DRAW: 0,
    AWAY: 0,
    n: 0,
  }));

  for (const row of trainRows) {
    const idx = modelDBinIndex(row.strengthDifferentialHome, binWidth);
    counts[idx]!.n += 1;
    counts[idx]![row.actualOutcome] += 1;
  }

  const bins: ModelDBin[] = [];
  for (let i = 0; i < nBins; i += 1) {
    const bounds = binBounds(i, binWidth);
    const c = counts[i]!;
    const empirical =
      c.n === 0
        ? { ...prior }
        : normalizeOneXTwo({
            HOME: c.HOME / c.n,
            DRAW: c.DRAW / c.n,
            AWAY: c.AWAY / c.n,
          });
    const shrunk = shrink(
      { HOME: c.HOME, DRAW: c.DRAW, AWAY: c.AWAY },
      c.n,
      prior,
      shrinkKappa,
    );
    bins.push({
      id: bounds.id,
      minInclusive: bounds.minInclusive,
      maxExclusive: bounds.maxExclusive,
      trainCount: c.n,
      empirical,
      shrunk,
    });
  }

  const artifact: ModelDArtifact = {
    family: "MODEL_D_EMPIRICAL_BINS",
    binWidth,
    shrinkKappa,
    globalPrior: prior,
    bins,
    trainingRowCount: trainRows.length,
    parameterDigest: "",
  };
  artifact.parameterDigest = digestModelD(artifact);
  return artifact;
}

export function digestModelD(model: Omit<ModelDArtifact, "parameterDigest"> & {
  parameterDigest?: string;
}): string {
  const payload = JSON.stringify({
    family: model.family,
    binWidth: model.binWidth,
    shrinkKappa: model.shrinkKappa,
    globalPrior: model.globalPrior,
    bins: model.bins.map((b) => ({
      id: b.id,
      minInclusive: b.minInclusive,
      maxExclusive: b.maxExclusive,
      trainCount: b.trainCount,
      empirical: b.empirical,
      shrunk: b.shrunk,
    })),
    trainingRowCount: model.trainingRowCount,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function predictModelD(
  model: ModelDArtifact,
  rows: readonly Pe4ExpectationDatasetRow[],
): OneXTwoProb[] {
  return rows.map((row) => {
    const idx = modelDBinIndex(row.strengthDifferentialHome, model.binWidth);
    return { ...model.bins[idx]!.shrunk };
  });
}
