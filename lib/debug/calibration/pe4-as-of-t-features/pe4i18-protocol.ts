/**
 * PE-4I.18 — Offline feature presence, redundancy & collinearity audit.
 * Research/calibration only. Structural analysis — no fitting, labels as
 * predictors, odds/EV, window optimization by outcomes, or 2025 unsealing.
 */

import { createHash } from "node:crypto";
import {
  PE4I15_PARENT_QUEUE_DIGEST,
  PE4I15_PRODUCTION_WIRING,
} from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import {
  PE4I17_ARTIFACT_SUBDIR,
  PE4I17_PRODUCTION_WIRING,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";

export const PE4I18_PROTOCOL_VERSION =
  "pe4.offline_feature_structure_audit.v1" as const;

export const PE4I18_SCHEMA_VERSION =
  "pe4.offline_feature_structure_audit.schema.v1" as const;

export const PE4I18_SCOPE = "research_calibration_offline_only" as const;

export const PE4I18_PRODUCTION_WIRING = false as const;

export const PE4I18_ARTIFACT_SUBDIR = "stage2i18-structure-audit" as const;

export const PE4I18_PARENT_QUEUE_DIGEST = PE4I15_PARENT_QUEUE_DIGEST;

export const PE4I18_SOURCE_DATASET_SUBDIR = PE4I17_ARTIFACT_SUBDIR;

/** Minimum pairwise finite observations to report a correlation. */
export const PE4I18_MIN_PAIRWISE_N = 200 as const;

/** Predeclared constant / near-constant thresholds (structural only). */
export const PE4I18_CONSTANT_THRESHOLDS = {
  /** CONSTANT: unique finite values <= 1 among present finite. */
  constantUniqueMax: 1,
  /** NEAR_CONSTANT: mostCommonShare >= this OR unique <= 2 with range ~0. */
  nearConstantMostCommonShare: 0.99,
  nearConstantUniqueMax: 2,
  rangeEpsilon: 1e-12,
  /** LOW_VARIANCE: stdev / max(|mean|, 1e-9) < this OR unique <= 3. */
  lowVarianceCvMax: 0.01,
  lowVarianceUniqueMax: 3,
  meanFloor: 1e-9,
} as const;

/** Predeclared Pearson |r| bands (structural collinearity only). */
export const PE4I18_CORRELATION_BANDS = {
  extremeMin: 0.995,
  veryHighMin: 0.98,
  highMin: 0.9,
} as const;

export type Pe4I18VarianceClass =
  | "CONSTANT"
  | "NEAR_CONSTANT"
  | "LOW_VARIANCE"
  | "VARIABLE";

export type Pe4I18CorrelationBand =
  | "EXTREME"
  | "VERY_HIGH"
  | "HIGH"
  | "MODERATE_OR_BELOW"
  | "INSUFFICIENT_PAIRWISE_N";

/**
 * Schema field classification — never BEST/WORST/predictor language.
 */
export type Pe4I18SchemaClass =
  | "IDENTITY"
  | "PROVENANCE"
  | "AVAILABILITY"
  | "CATEGORICAL"
  | "NUMERIC"
  | "DERIVED"
  | "OPTIONAL_XG"
  | "SCHEDULE_REST"
  | "UNAVAILABLE";

/**
 * Structural status labels for family / field summaries.
 * NEVER BEST / WORST / predictor / edge language.
 */
export type Pe4I18StructuralStatus =
  | "AVAILABLE"
  | "PARTIAL"
  | "SPARSE"
  | "REDUNDANT"
  | "HIGHLY_CORRELATED"
  | "UNAVAILABLE"
  | "REQUIRES_LATER_RESEARCH";

export type Pe4I18ExactRedundancyReason =
  | "EXACT_EQUAL"
  | "SIGN_INVERSE"
  | "DETERMINISTIC_WIN_RATE"
  | "DETERMINISTIC_POINTS_PER_MATCH"
  | "DETERMINISTIC_GOAL_DIFF"
  | "DETERMINISTIC_XG_DIFF"
  | "AFFINE_NEAR_PERFECT"
  | "NONE";

export type Pe4I18Protocol = {
  protocolVersion: typeof PE4I18_PROTOCOL_VERSION;
  schemaVersion: typeof PE4I18_SCHEMA_VERSION;
  parentQueueDigest: typeof PE4I18_PARENT_QUEUE_DIGEST;
  scope: typeof PE4I18_SCOPE;
  productionWiring: typeof PE4I18_PRODUCTION_WIRING;
  pe4i15ProductionWiring: typeof PE4I15_PRODUCTION_WIRING;
  pe4i16ProductionWiring: typeof PE4I16_PRODUCTION_WIRING;
  pe4i17ProductionWiring: typeof PE4I17_PRODUCTION_WIRING;
  modelingForbidden: true;
  noWeights: true;
  noOddsEv: true;
  no2025Unsealing: true;
  noFeatureVsOutcomeStats: true;
  noWindowOptimizationByOutcomes: true;
  providerCallsForbidden: true;
  labelContentsForbiddenForStats: true;
  constantThresholds: typeof PE4I18_CONSTANT_THRESHOLDS;
  correlationBands: typeof PE4I18_CORRELATION_BANDS;
  minPairwiseN: typeof PE4I18_MIN_PAIRWISE_N;
  sourceDatasetSubdir: typeof PE4I18_SOURCE_DATASET_SUBDIR;
  artifactSubdir: typeof PE4I18_ARTIFACT_SUBDIR;
};

export function pe4I18Protocol(): Pe4I18Protocol {
  return {
    protocolVersion: PE4I18_PROTOCOL_VERSION,
    schemaVersion: PE4I18_SCHEMA_VERSION,
    parentQueueDigest: PE4I18_PARENT_QUEUE_DIGEST,
    scope: PE4I18_SCOPE,
    productionWiring: PE4I18_PRODUCTION_WIRING,
    pe4i15ProductionWiring: PE4I15_PRODUCTION_WIRING,
    pe4i16ProductionWiring: PE4I16_PRODUCTION_WIRING,
    pe4i17ProductionWiring: PE4I17_PRODUCTION_WIRING,
    modelingForbidden: true,
    noWeights: true,
    noOddsEv: true,
    no2025Unsealing: true,
    noFeatureVsOutcomeStats: true,
    noWindowOptimizationByOutcomes: true,
    providerCallsForbidden: true,
    labelContentsForbiddenForStats: true,
    constantThresholds: PE4I18_CONSTANT_THRESHOLDS,
    correlationBands: PE4I18_CORRELATION_BANDS,
    minPairwiseN: PE4I18_MIN_PAIRWISE_N,
    sourceDatasetSubdir: PE4I18_SOURCE_DATASET_SUBDIR,
    artifactSubdir: PE4I18_ARTIFACT_SUBDIR,
  };
}

export function digestPe4I18Protocol(
  protocol: Pe4I18Protocol = pe4I18Protocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol), "utf8")
    .digest("hex");
}

export function classifyCorrelationBand(
  absR: number,
): Exclude<Pe4I18CorrelationBand, "INSUFFICIENT_PAIRWISE_N"> {
  if (absR >= PE4I18_CORRELATION_BANDS.extremeMin) return "EXTREME";
  if (absR >= PE4I18_CORRELATION_BANDS.veryHighMin) return "VERY_HIGH";
  if (absR >= PE4I18_CORRELATION_BANDS.highMin) return "HIGH";
  return "MODERATE_OR_BELOW";
}

export function classifyVarianceClass(input: {
  uniqueFinite: number;
  mostCommonShare: number;
  range: number;
  mean: number;
  stdev: number;
}): Pe4I18VarianceClass {
  const t = PE4I18_CONSTANT_THRESHOLDS;
  if (input.uniqueFinite <= t.constantUniqueMax) return "CONSTANT";
  if (
    input.mostCommonShare >= t.nearConstantMostCommonShare ||
    (input.uniqueFinite <= t.nearConstantUniqueMax &&
      input.range <= t.rangeEpsilon)
  ) {
    return "NEAR_CONSTANT";
  }
  const denom = Math.max(Math.abs(input.mean), t.meanFloor);
  if (
    input.stdev / denom < t.lowVarianceCvMax ||
    input.uniqueFinite <= t.lowVarianceUniqueMax
  ) {
    return "LOW_VARIANCE";
  }
  return "VARIABLE";
}
