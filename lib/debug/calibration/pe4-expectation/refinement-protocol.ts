/**
 * PE-4G.5 — Frozen refinement protocol pe4.expectation.refinement.v1
 *
 * MUST NOT be edited after confirmatory 2024 metrics are observed.
 * Architecture / HP decisions use 2023 DEVELOPMENT only.
 * 2024 is confirmatory/descriptive (already observed in PE-4G.4).
 * 2025 HOLDOUT remains untouched.
 */

import { createHash } from "node:crypto";
import {
  PE4_EXPECTATION_POC_HOLDOUT_SEASON,
  PE4_EXPECTATION_POC_INTERNAL_FOLDS,
  PE4_EXPECTATION_POC_MIN_TRAIN_ROWS,
  PE4_EXPECTATION_POC_PROBABILITY_FLOOR,
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
  PE4_EXPECTATION_POC_TRAIN_SEASON,
  PE4_EXPECTATION_POC_VALIDATION_SEASON,
  digestPe4ExpectationPocProtocol,
} from "@/lib/debug/calibration/pe4-expectation/protocol";

export const PE4_EXPECTATION_REFINEMENT_PROTOCOL_VERSION =
  "pe4.expectation.refinement.v1" as const;

export const PE4_EXPECTATION_REFINEMENT_REQUIRED_DATASET_DIGEST =
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST;

/** Parent PE-4G.4 protocol digest (pinned). */
export const PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST =
  digestPe4ExpectationPocProtocol();

export const PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON =
  PE4_EXPECTATION_POC_TRAIN_SEASON;
export const PE4_EXPECTATION_REFINEMENT_CONFIRMATORY_SEASON =
  PE4_EXPECTATION_POC_VALIDATION_SEASON;
export const PE4_EXPECTATION_REFINEMENT_HOLDOUT_SEASON =
  PE4_EXPECTATION_POC_HOLDOUT_SEASON;

export const PE4_EXPECTATION_REFINEMENT_FIT_ELIGIBILITY =
  "catalogue_catalogue_only" as const;

/**
 * Magnitude feature choice (ONE only — not compared on 2024):
 *
 * abs(zD) vs zD^2:
 * - Both allow DRAW to peak when matchup is close (symmetric magnitude).
 * - abs(zD): linear magnitude, milder extrapolation, directly encodes
 *   "closeness"; coefficients stay easier to regularize.
 * - zD^2: quadratic growth exaggerates extremes; higher leverage outliers;
 *   more collinear with |zD| in the bulk but steeper tails.
 *
 * Selected: abs(zD).
 */
export const PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA =
  "intercept_plus_zD_plus_abs_zD" as const;

export const PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_FEATURE =
  "abs_zD" as const;

export const PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_RATIONALE =
  "abs(zD) encodes matchup closeness linearly with milder extreme extrapolation than zD^2; signed zD retains HOME/AWAY direction. Only one magnitude feature is pre-registered." as const;

/**
 * Model D: keep frozen PE-4G.4 specification as interpretable benchmark.
 * No structural refinement in v1 (no strong math reason independent of 2024).
 */
export const PE4_EXPECTATION_REFINEMENT_MODEL_D_POLICY =
  "KEEP_PE4G4_FROZEN_BENCHMARK_UNCHANGED" as const;

/**
 * Low-information base_prior/base_prior policy (pre-registered from semantics):
 *
 * A) global training 1X2 prior — conservative; no pretend strength signal
 * B) separate opening prior — too sparse in 2023 (~10 rows); not selected
 * C) model D=0 prediction — semantically wrong (known-equal ≠ unknown)
 * D) reduced-confidence metadata alone — still needs a probability mass
 *
 * Selected: A + quality metadata (fallback flag / coverage class).
 */
export const PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY =
  "GLOBAL_TRAIN_PRIOR_WITH_QUALITY_METADATA" as const;

export const PE4_EXPECTATION_REFINEMENT_LOW_INFO_RATIONALE =
  "base_prior/base_prior means strength differential is uninformative, not that sides are equal. Use eligible-train empirical 1X2 prior and mark lowInformationFallbackUsed=true. Do not apply catalogue D=0 mass." as const;

/** C2 L2 candidates — selected on 2023 folds only. */
export const PE4_EXPECTATION_REFINEMENT_C2_L2_LAMBDAS = [
  0.01, 0.1, 1.0, 5.0,
] as const;

export const PE4_EXPECTATION_REFINEMENT_C2_MAX_NEWTON_ITERS = 50 as const;
export const PE4_EXPECTATION_REFINEMENT_C2_NEWTON_TOL = 1e-8 as const;

export const PE4_EXPECTATION_REFINEMENT_INTERNAL_FOLDS =
  PE4_EXPECTATION_POC_INTERNAL_FOLDS;
export const PE4_EXPECTATION_REFINEMENT_MIN_TRAIN_ROWS =
  PE4_EXPECTATION_POC_MIN_TRAIN_ROWS;

export const PE4_EXPECTATION_REFINEMENT_PROBABILITY_FLOOR =
  PE4_EXPECTATION_POC_PROBABILITY_FLOOR;

export const PE4_EXPECTATION_REFINEMENT_PRIMARY_METRIC =
  "multiclass_log_loss_1x2" as const;

export const PE4_EXPECTATION_REFINEMENT_SECONDARY_METRICS = [
  "multiclass_brier_1x2",
  "mean_prob_realized",
  "descriptive_accuracy",
  "draw_brier_contribution",
  "draw_logloss_on_realized_draws",
] as const;

export const PE4_EXPECTATION_REFINEMENT_SELECTION_RULE =
  "minimize_mean_internal_log_loss_then_mean_brier_then_prefer_stronger_regularization" as const;

export const PE4_EXPECTATION_REFINEMENT_TIE_BREAK =
  "lower_mean_brier_then_larger_lambda" as const;

/** Predeclared diagnostic D grid (not tuned). */
export const PE4_EXPECTATION_REFINEMENT_D_GRID = [
  -200, -100, -50, -20, 0, 20, 50, 100, 200,
] as const;

/** Predeclared |D| regions for draw calibration (Elo points). */
export const PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS = [
  { id: "absD_lt_40", maxAbsExclusive: 40 },
  { id: "absD_40_100", maxAbsExclusive: 100 },
  { id: "absD_100_200", maxAbsExclusive: 200 },
  { id: "absD_ge_200", maxAbsExclusive: Number.POSITIVE_INFINITY },
] as const;

export type Pe4ExpectationRefinementProtocol = {
  protocolVersion: typeof PE4_EXPECTATION_REFINEMENT_PROTOCOL_VERSION;
  requiredDatasetDigest: typeof PE4_EXPECTATION_REFINEMENT_REQUIRED_DATASET_DIGEST;
  parentProtocolDigest: string;
  trainSeason: typeof PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON;
  confirmatorySeason: typeof PE4_EXPECTATION_REFINEMENT_CONFIRMATORY_SEASON;
  holdoutSeason: typeof PE4_EXPECTATION_REFINEMENT_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  confirmatorySeasonStatus: "KNOWN_FROM_PE4G4_DESCRIPTIVE_ONLY";
  fitEligibility: typeof PE4_EXPECTATION_REFINEMENT_FIT_ELIGIBILITY;
  c2FeatureSchema: typeof PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA;
  c2MagnitudeFeature: typeof PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_FEATURE;
  c2MagnitudeRationale: typeof PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_RATIONALE;
  modelDPolicy: typeof PE4_EXPECTATION_REFINEMENT_MODEL_D_POLICY;
  lowInfoPolicy: typeof PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY;
  lowInfoRationale: typeof PE4_EXPECTATION_REFINEMENT_LOW_INFO_RATIONALE;
  c2L2Lambdas: typeof PE4_EXPECTATION_REFINEMENT_C2_L2_LAMBDAS;
  c2MaxNewtonIters: typeof PE4_EXPECTATION_REFINEMENT_C2_MAX_NEWTON_ITERS;
  c2NewtonTol: typeof PE4_EXPECTATION_REFINEMENT_C2_NEWTON_TOL;
  internalFolds: typeof PE4_EXPECTATION_REFINEMENT_INTERNAL_FOLDS;
  minTrainRows: typeof PE4_EXPECTATION_REFINEMENT_MIN_TRAIN_ROWS;
  probabilityFloor: typeof PE4_EXPECTATION_REFINEMENT_PROBABILITY_FLOOR;
  primaryMetric: typeof PE4_EXPECTATION_REFINEMENT_PRIMARY_METRIC;
  secondaryMetrics: typeof PE4_EXPECTATION_REFINEMENT_SECONDARY_METRICS;
  selectionRule: typeof PE4_EXPECTATION_REFINEMENT_SELECTION_RULE;
  tieBreak: typeof PE4_EXPECTATION_REFINEMENT_TIE_BREAK;
  dGrid: typeof PE4_EXPECTATION_REFINEMENT_D_GRID;
  absDRegions: typeof PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS;
  stochasticSeed: null;
  families: readonly [
    "BASELINE_0",
    "MODEL_D_PE4G4_FROZEN",
    "MODEL_C_PE4G4_FROZEN",
    "MODEL_C2_MAGNITUDE",
  ];
};

export function pe4ExpectationRefinementProtocol(): Pe4ExpectationRefinementProtocol {
  return {
    protocolVersion: PE4_EXPECTATION_REFINEMENT_PROTOCOL_VERSION,
    requiredDatasetDigest: PE4_EXPECTATION_REFINEMENT_REQUIRED_DATASET_DIGEST,
    parentProtocolDigest: PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST,
    trainSeason: PE4_EXPECTATION_REFINEMENT_TRAIN_SEASON,
    confirmatorySeason: PE4_EXPECTATION_REFINEMENT_CONFIRMATORY_SEASON,
    holdoutSeason: PE4_EXPECTATION_REFINEMENT_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    confirmatorySeasonStatus: "KNOWN_FROM_PE4G4_DESCRIPTIVE_ONLY",
    fitEligibility: PE4_EXPECTATION_REFINEMENT_FIT_ELIGIBILITY,
    c2FeatureSchema: PE4_EXPECTATION_REFINEMENT_C2_FEATURE_SCHEMA,
    c2MagnitudeFeature: PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_FEATURE,
    c2MagnitudeRationale: PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_RATIONALE,
    modelDPolicy: PE4_EXPECTATION_REFINEMENT_MODEL_D_POLICY,
    lowInfoPolicy: PE4_EXPECTATION_REFINEMENT_LOW_INFO_POLICY,
    lowInfoRationale: PE4_EXPECTATION_REFINEMENT_LOW_INFO_RATIONALE,
    c2L2Lambdas: PE4_EXPECTATION_REFINEMENT_C2_L2_LAMBDAS,
    c2MaxNewtonIters: PE4_EXPECTATION_REFINEMENT_C2_MAX_NEWTON_ITERS,
    c2NewtonTol: PE4_EXPECTATION_REFINEMENT_C2_NEWTON_TOL,
    internalFolds: PE4_EXPECTATION_REFINEMENT_INTERNAL_FOLDS,
    minTrainRows: PE4_EXPECTATION_REFINEMENT_MIN_TRAIN_ROWS,
    probabilityFloor: PE4_EXPECTATION_REFINEMENT_PROBABILITY_FLOOR,
    primaryMetric: PE4_EXPECTATION_REFINEMENT_PRIMARY_METRIC,
    secondaryMetrics: PE4_EXPECTATION_REFINEMENT_SECONDARY_METRICS,
    selectionRule: PE4_EXPECTATION_REFINEMENT_SELECTION_RULE,
    tieBreak: PE4_EXPECTATION_REFINEMENT_TIE_BREAK,
    dGrid: PE4_EXPECTATION_REFINEMENT_D_GRID,
    absDRegions: PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS,
    stochasticSeed: null,
    families: [
      "BASELINE_0",
      "MODEL_D_PE4G4_FROZEN",
      "MODEL_C_PE4G4_FROZEN",
      "MODEL_C2_MAGNITUDE",
    ],
  };
}

export function stringifyPe4ExpectationRefinementProtocol(
  protocol: Pe4ExpectationRefinementProtocol,
): string {
  return JSON.stringify(protocol, Object.keys(protocol).sort(), 2);
}

export function digestPe4ExpectationRefinementProtocol(
  protocol: Pe4ExpectationRefinementProtocol = pe4ExpectationRefinementProtocol(),
): string {
  return createHash("sha256")
    .update(stringifyPe4ExpectationRefinementProtocol(protocol), "utf8")
    .digest("hex");
}
