/**
 * PE-4G.4 — POC artifact helpers (local / gitignored calibration only).
 */

import { createHash } from "node:crypto";
import type { Baseline0Model } from "@/lib/debug/calibration/pe4-expectation/model-baseline";
import type { ModelCArtifact } from "@/lib/debug/calibration/pe4-expectation/model-c";
import type { ModelDArtifact } from "@/lib/debug/calibration/pe4-expectation/model-d";

export type Pe4ExpectationPocArtifactEnvelope = {
  modelFamily: string;
  modelVersion: string;
  protocolDigest: string;
  datasetDigest: string;
  trainingSplit: "DEVELOPMENT_2023";
  trainingCutoffUtc: string;
  trainingRowCount: number;
  featureSchema: string;
  hyperparameters: Record<string, number | string>;
  fitted: unknown;
  parameterDigest: string;
  artifactDigest: string;
};

function envelopeDigest(
  env: Omit<Pe4ExpectationPocArtifactEnvelope, "artifactDigest">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(env), "utf8")
    .digest("hex");
}

export function buildBaseline0Artifact(input: {
  protocolDigest: string;
  datasetDigest: string;
  trainingCutoffUtc: string;
  model: Baseline0Model;
}): Pe4ExpectationPocArtifactEnvelope {
  const base = {
    modelFamily: "BASELINE_0",
    modelVersion: "pe4.expectation.poc.baseline0.v1",
    protocolDigest: input.protocolDigest,
    datasetDigest: input.datasetDigest,
    trainingSplit: "DEVELOPMENT_2023" as const,
    trainingCutoffUtc: input.trainingCutoffUtc,
    trainingRowCount: input.model.trainingRowCount,
    featureSchema: "none_constant_prior",
    hyperparameters: {},
    fitted: { prior: input.model.prior },
    parameterDigest: createHash("sha256")
      .update(JSON.stringify(input.model.prior), "utf8")
      .digest("hex"),
  };
  return { ...base, artifactDigest: envelopeDigest(base) };
}

export function buildModelDArtifact(input: {
  protocolDigest: string;
  datasetDigest: string;
  trainingCutoffUtc: string;
  model: ModelDArtifact;
}): Pe4ExpectationPocArtifactEnvelope {
  const base = {
    modelFamily: "MODEL_D_EMPIRICAL_BINS",
    modelVersion: "pe4.expectation.poc.model_d.v1",
    protocolDigest: input.protocolDigest,
    datasetDigest: input.datasetDigest,
    trainingSplit: "DEVELOPMENT_2023" as const,
    trainingCutoffUtc: input.trainingCutoffUtc,
    trainingRowCount: input.model.trainingRowCount,
    featureSchema: "home_oriented_D_bins",
    hyperparameters: {
      binWidth: input.model.binWidth,
      shrinkKappa: input.model.shrinkKappa,
    },
    fitted: {
      globalPrior: input.model.globalPrior,
      bins: input.model.bins,
    },
    parameterDigest: input.model.parameterDigest,
  };
  return { ...base, artifactDigest: envelopeDigest(base) };
}

export function buildModelCArtifact(input: {
  protocolDigest: string;
  datasetDigest: string;
  trainingCutoffUtc: string;
  model: ModelCArtifact;
}): Pe4ExpectationPocArtifactEnvelope {
  const base = {
    modelFamily: "MODEL_C_MULTINOMIAL_LOGIT",
    modelVersion: "pe4.expectation.poc.model_c.v1",
    protocolDigest: input.protocolDigest,
    datasetDigest: input.datasetDigest,
    trainingSplit: "DEVELOPMENT_2023" as const,
    trainingCutoffUtc: input.trainingCutoffUtc,
    trainingRowCount: input.model.trainingRowCount,
    featureSchema: input.model.featureSchema,
    hyperparameters: { l2Lambda: input.model.l2Lambda },
    fitted: {
      dMean: input.model.dMean,
      dStd: input.model.dStd,
      betaHome: input.model.betaHome,
      betaDraw: input.model.betaDraw,
      converged: input.model.converged,
      iterations: input.model.iterations,
    },
    parameterDigest: input.model.parameterDigest,
  };
  return { ...base, artifactDigest: envelopeDigest(base) };
}
