/**
 * PE-4G.4 — Frozen experiment protocol pe4.expectation.poc.v1
 *
 * MUST NOT be edited after validation metrics are observed in this phase.
 * Hyperparameters are selected only on 2023 internal folds.
 */

import { createHash } from "node:crypto";

export const PE4_EXPECTATION_POC_PROTOCOL_VERSION =
  "pe4.expectation.poc.v1" as const;

/** Locked to PE-4G.3 dataset digest. */
export const PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST =
  "139f6f8139490ea95154ada6b68df571b4326cf348c786034a011d25250feda3" as const;

export const PE4_EXPECTATION_POC_TRAIN_SEASON = "2023" as const;
export const PE4_EXPECTATION_POC_VALIDATION_SEASON = "2024" as const;
export const PE4_EXPECTATION_POC_HOLDOUT_SEASON = "2025" as const;

/** Exclude both-base-prior from strength-map fitting (pre-registered). */
export const PE4_EXPECTATION_POC_FIT_ELIGIBILITY =
  "catalogue_catalogue_only" as const;

/**
 * Probability floor before renormalize (numerical stability only).
 * Not tuned on validation.
 */
export const PE4_EXPECTATION_POC_PROBABILITY_FLOOR = 1e-6 as const;

/** Natural log for log-loss (documented). */
export const PE4_EXPECTATION_POC_LOG_BASE = "ln" as const;

export const PE4_EXPECTATION_POC_PRIMARY_METRIC =
  "multiclass_log_loss_1x2" as const;

export const PE4_EXPECTATION_POC_SECONDARY_METRICS = [
  "multiclass_brier_1x2",
  "mean_prob_realized",
  "descriptive_accuracy",
] as const;

/**
 * Model D: fixed-width symmetric bins around D=0.
 * Outer bins are open-ended. Candidate widths only — not fitted to 2024.
 */
export const PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS = [40, 60, 80] as const;

/**
 * Model D: Dirichlet prior mass κ toward global train prior.
 * shrunk = (counts + κ * prior) / (n + κ)
 */
export const PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA = [5, 20, 50] as const;

/** Outer edge multiplier: edges at ± width * OUTER_STEPS (open beyond). */
export const PE4_EXPECTATION_POC_MODEL_D_OUTER_STEPS = 5 as const;

/**
 * Model C: L2 regularization strengths on free parameters.
 * Feature schema: intercept + z-scored D (train-only mean/std).
 */
export const PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS = [0.01, 0.1, 1.0] as const;

export const PE4_EXPECTATION_POC_MODEL_C_MAX_NEWTON_ITERS = 50 as const;
export const PE4_EXPECTATION_POC_MODEL_C_NEWTON_TOL = 1e-8 as const;

/**
 * Model B: not implemented in POC — no local ordinal solver without
 * adding a heavy dependency. Recorded, not blocking.
 */
export const PE4_EXPECTATION_POC_MODEL_B_STATUS =
  "MODEL_B_NOT_IMPLEMENTED_IN_POC" as const;

/**
 * Internal chronological folds on eligible 2023 rows (index fractions).
 * Eval always after train. Skip folds with train < MIN_TRAIN.
 */
export const PE4_EXPECTATION_POC_INTERNAL_FOLDS = [
  { id: "fold_a", trainEndFrac: 0.5, evalEndFrac: 0.7 },
  { id: "fold_b", trainEndFrac: 0.7, evalEndFrac: 0.85 },
  { id: "fold_c", trainEndFrac: 0.85, evalEndFrac: 1.0 },
] as const;

export const PE4_EXPECTATION_POC_MIN_TRAIN_ROWS = 80 as const;

export const PE4_EXPECTATION_POC_SELECTION_RULE =
  "minimize_mean_internal_log_loss_then_mean_brier_then_prefer_stronger_regularization" as const;

export const PE4_EXPECTATION_POC_TIE_BREAK =
  "lower_mean_brier_then_larger_shrink_or_lambda" as const;

export const PE4_EXPECTATION_POC_FEATURE_SCHEMA =
  "home_oriented_D_only_no_venue_dummy" as const;

export const PE4_EXPECTATION_POC_VENUE_NOTE =
  "Canonical PE-4G.3 rows are one HOME-perspective row per fixture; HOME/AWAY is not a varying feature. Venue enters only via the home-oriented 1X2 label distribution." as const;

export type Pe4ExpectationPocProtocol = {
  protocolVersion: typeof PE4_EXPECTATION_POC_PROTOCOL_VERSION;
  requiredDatasetDigest: typeof PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST;
  trainSeason: typeof PE4_EXPECTATION_POC_TRAIN_SEASON;
  validationSeason: typeof PE4_EXPECTATION_POC_VALIDATION_SEASON;
  holdoutSeason: typeof PE4_EXPECTATION_POC_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  fitEligibility: typeof PE4_EXPECTATION_POC_FIT_ELIGIBILITY;
  featureSchema: typeof PE4_EXPECTATION_POC_FEATURE_SCHEMA;
  venueNote: typeof PE4_EXPECTATION_POC_VENUE_NOTE;
  probabilityFloor: typeof PE4_EXPECTATION_POC_PROBABILITY_FLOOR;
  logBase: typeof PE4_EXPECTATION_POC_LOG_BASE;
  primaryMetric: typeof PE4_EXPECTATION_POC_PRIMARY_METRIC;
  secondaryMetrics: typeof PE4_EXPECTATION_POC_SECONDARY_METRICS;
  modelDBinWidths: typeof PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS;
  modelDShrinkKappa: typeof PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA;
  modelDOuterSteps: typeof PE4_EXPECTATION_POC_MODEL_D_OUTER_STEPS;
  modelCL2Lambdas: typeof PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS;
  modelCMaxNewtonIters: typeof PE4_EXPECTATION_POC_MODEL_C_MAX_NEWTON_ITERS;
  modelCNewtonTol: typeof PE4_EXPECTATION_POC_MODEL_C_NEWTON_TOL;
  modelBStatus: typeof PE4_EXPECTATION_POC_MODEL_B_STATUS;
  internalFolds: typeof PE4_EXPECTATION_POC_INTERNAL_FOLDS;
  minTrainRows: typeof PE4_EXPECTATION_POC_MIN_TRAIN_ROWS;
  selectionRule: typeof PE4_EXPECTATION_POC_SELECTION_RULE;
  tieBreak: typeof PE4_EXPECTATION_POC_TIE_BREAK;
  stochasticSeed: null;
  families: readonly [
    "BASELINE_0",
    "MODEL_D_EMPIRICAL_BINS",
    "MODEL_C_MULTINOMIAL_LOGIT",
    "MODEL_B_ORDINAL_NOT_IMPLEMENTED",
  ];
};

export function pe4ExpectationPocProtocol(): Pe4ExpectationPocProtocol {
  return {
    protocolVersion: PE4_EXPECTATION_POC_PROTOCOL_VERSION,
    requiredDatasetDigest: PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
    trainSeason: PE4_EXPECTATION_POC_TRAIN_SEASON,
    validationSeason: PE4_EXPECTATION_POC_VALIDATION_SEASON,
    holdoutSeason: PE4_EXPECTATION_POC_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    fitEligibility: PE4_EXPECTATION_POC_FIT_ELIGIBILITY,
    featureSchema: PE4_EXPECTATION_POC_FEATURE_SCHEMA,
    venueNote: PE4_EXPECTATION_POC_VENUE_NOTE,
    probabilityFloor: PE4_EXPECTATION_POC_PROBABILITY_FLOOR,
    logBase: PE4_EXPECTATION_POC_LOG_BASE,
    primaryMetric: PE4_EXPECTATION_POC_PRIMARY_METRIC,
    secondaryMetrics: PE4_EXPECTATION_POC_SECONDARY_METRICS,
    modelDBinWidths: PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS,
    modelDShrinkKappa: PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA,
    modelDOuterSteps: PE4_EXPECTATION_POC_MODEL_D_OUTER_STEPS,
    modelCL2Lambdas: PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS,
    modelCMaxNewtonIters: PE4_EXPECTATION_POC_MODEL_C_MAX_NEWTON_ITERS,
    modelCNewtonTol: PE4_EXPECTATION_POC_MODEL_C_NEWTON_TOL,
    modelBStatus: PE4_EXPECTATION_POC_MODEL_B_STATUS,
    internalFolds: PE4_EXPECTATION_POC_INTERNAL_FOLDS,
    minTrainRows: PE4_EXPECTATION_POC_MIN_TRAIN_ROWS,
    selectionRule: PE4_EXPECTATION_POC_SELECTION_RULE,
    tieBreak: PE4_EXPECTATION_POC_TIE_BREAK,
    stochasticSeed: null,
    families: [
      "BASELINE_0",
      "MODEL_D_EMPIRICAL_BINS",
      "MODEL_C_MULTINOMIAL_LOGIT",
      "MODEL_B_ORDINAL_NOT_IMPLEMENTED",
    ],
  };
}

/** Canonical JSON for hashing (sorted keys via deterministic stringify). */
export function stringifyPe4ExpectationPocProtocol(
  protocol: Pe4ExpectationPocProtocol,
): string {
  return JSON.stringify(protocol, Object.keys(protocol).sort(), 2);
}

export function digestPe4ExpectationPocProtocol(
  protocol: Pe4ExpectationPocProtocol = pe4ExpectationPocProtocol(),
): string {
  return createHash("sha256")
    .update(stringifyPe4ExpectationPocProtocol(protocol), "utf8")
    .digest("hex");
}
