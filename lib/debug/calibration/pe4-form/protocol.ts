/**
 * PE-4H.1 — Frozen residual-form signal audit protocol.
 * pe4.residual_form.signal_audit.v1
 *
 * MUST NOT be edited after signal results are observed.
 * No PE adjustment / Elo / probability change in this phase.
 */

import { createHash } from "node:crypto";
import {
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
  digestPe4ExpectationPocProtocol,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import { digestPe4ExpectationRefinementProtocol } from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";

export const PE4_FORM_SIGNAL_PROTOCOL_VERSION =
  "pe4.residual_form.signal_audit.v1" as const;

export const PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST =
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST;

export const PE4_FORM_SIGNAL_PARENT_POC_PROTOCOL_DIGEST =
  digestPe4ExpectationPocProtocol();

export const PE4_FORM_SIGNAL_PARENT_REFINEMENT_PROTOCOL_DIGEST =
  digestPe4ExpectationRefinementProtocol();

/** Frozen backbone: PE-4G.4 MODEL_C (not C2). */
export const PE4_FORM_SIGNAL_EXPECTATION_FAMILY =
  "MODEL_C_MULTINOMIAL_LOGIT" as const;

export const PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION =
  "pe4.expectation.poc.model_c.v1" as const;

export const PE4_FORM_SIGNAL_LOW_INFO_POLICY =
  "GLOBAL_TRAIN_PRIOR_WITH_QUALITY_METADATA" as const;

export const PE4_FORM_SIGNAL_DEV_SEASON = "2023" as const;
export const PE4_FORM_SIGNAL_CONFIRMATORY_SEASON = "2024" as const;
export const PE4_FORM_SIGNAL_HOLDOUT_SEASON = "2025" as const;

export const PE4_FORM_SIGNAL_RESIDUAL_DEFINITION =
  "realizedTargetPoints_minus_expectedTargetPoints" as const;

/** Match-count history windows (diagnostics only — not optimized). */
export const PE4_FORM_SIGNAL_LAST_N_WINDOWS = [3, 5, 8] as const;

/** Calendar history windows in days. */
export const PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS = [28, 56] as const;

/**
 * Recency-weighted mean: ONE fixed half-life diagnostic (days), not tuned.
 * Weight for a prior match at lag_days: 0.5^(lag_days / halfLifeDays).
 */
export const PE4_FORM_SIGNAL_RECENCY_HALF_LIFE_DAYS = 28 as const;

export const PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED = true as const;

/** Next-residual horizons (matches ahead within season/team). */
export const PE4_FORM_SIGNAL_HORIZONS = [1, 2, 3] as const;

/**
 * Predeclared historical-residual ranges for descriptive reliability.
 * Theoretical R ∈ [0−EP_max, 3−EP_min] ≈ roughly (−1.5, 2.5) typical;
 * these edges are protocol-fixed, not outcome-optimized.
 */
export const PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGES = [
  { id: "le_m075", maxExclusive: -0.75 },
  { id: "m075_m025", maxExclusive: -0.25 },
  { id: "m025_p025", maxExclusive: 0.25 },
  { id: "p025_p075", maxExclusive: 0.75 },
  { id: "ge_p075", maxExclusive: Number.POSITIVE_INFINITY },
] as const;

export const PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGE_EDGES = [
  Number.NEGATIVE_INFINITY,
  -0.75,
  -0.25,
  0.25,
  0.75,
  Number.POSITIVE_INFINITY,
] as const;

/** Predeclared expected-points ranges (favorite / balanced / underdog). */
export const PE4_FORM_SIGNAL_EP_RANGES = [
  { id: "underdog_ep_lt_1.0", maxExclusive: 1.0 },
  { id: "balanced_ep_1.0_1.6", maxExclusive: 1.6 },
  { id: "favorite_ep_ge_1.6", maxExclusive: Number.POSITIVE_INFINITY },
] as const;

export const PE4_FORM_SIGNAL_EP_RANGE_EDGES = [
  Number.NEGATIVE_INFINITY,
  1.0,
  1.6,
  Number.POSITIVE_INFINITY,
] as const;

/**
 * Cluster bootstrap for fixture-aware uncertainty.
 * Fixed seed + iterations — not tuned after results.
 */
export const PE4_FORM_SIGNAL_BOOTSTRAP_SEED = 20240924 as const;
export const PE4_FORM_SIGNAL_BOOTSTRAP_ITERATIONS = 200 as const;

/** Shuffle diagnostic seed / iterations. */
export const PE4_FORM_SIGNAL_SHUFFLE_SEED = 424242 as const;
export const PE4_FORM_SIGNAL_SHUFFLE_ITERATIONS = 100 as const;

export const PE4_FORM_SIGNAL_CROSS_SEASON_HISTORY =
  "DISABLED_SEASONS_INDEPENDENT" as const;

export const PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE =
  "last_5" as const;

export type Pe4FormSignalProtocol = {
  protocolVersion: typeof PE4_FORM_SIGNAL_PROTOCOL_VERSION;
  requiredDatasetDigest: typeof PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST;
  parentPocProtocolDigest: string;
  parentRefinementProtocolDigest: string;
  expectationFamily: typeof PE4_FORM_SIGNAL_EXPECTATION_FAMILY;
  expectationModelVersion: typeof PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION;
  lowInfoPolicy: typeof PE4_FORM_SIGNAL_LOW_INFO_POLICY;
  developmentSeason: typeof PE4_FORM_SIGNAL_DEV_SEASON;
  confirmatorySeason: typeof PE4_FORM_SIGNAL_CONFIRMATORY_SEASON;
  holdoutSeason: typeof PE4_FORM_SIGNAL_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  residualDefinition: typeof PE4_FORM_SIGNAL_RESIDUAL_DEFINITION;
  lastNWindows: typeof PE4_FORM_SIGNAL_LAST_N_WINDOWS;
  calendarDayWindows: typeof PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS;
  includeRecencyWeighted: typeof PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED;
  recencyHalfLifeDays: typeof PE4_FORM_SIGNAL_RECENCY_HALF_LIFE_DAYS;
  horizons: typeof PE4_FORM_SIGNAL_HORIZONS;
  histResidualRangeEdges: typeof PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGE_EDGES;
  epRangeEdges: typeof PE4_FORM_SIGNAL_EP_RANGE_EDGES;
  bootstrapSeed: typeof PE4_FORM_SIGNAL_BOOTSTRAP_SEED;
  bootstrapIterations: typeof PE4_FORM_SIGNAL_BOOTSTRAP_ITERATIONS;
  shuffleSeed: typeof PE4_FORM_SIGNAL_SHUFFLE_SEED;
  shuffleIterations: typeof PE4_FORM_SIGNAL_SHUFFLE_ITERATIONS;
  crossSeasonHistory: typeof PE4_FORM_SIGNAL_CROSS_SEASON_HISTORY;
  primaryHistoryForTable: typeof PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE;
  gdResidualStatus: "UNAVAILABLE";
  noPeAdjustment: true;
  noOptimizedDecay: true;
  noOptimizedWindow: true;
  stochasticSeedNote: "bootstrap_and_shuffle_only_fixed_seeds";
};

export function pe4FormSignalProtocol(): Pe4FormSignalProtocol {
  return {
    protocolVersion: PE4_FORM_SIGNAL_PROTOCOL_VERSION,
    requiredDatasetDigest: PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST,
    parentPocProtocolDigest: PE4_FORM_SIGNAL_PARENT_POC_PROTOCOL_DIGEST,
    parentRefinementProtocolDigest:
      PE4_FORM_SIGNAL_PARENT_REFINEMENT_PROTOCOL_DIGEST,
    expectationFamily: PE4_FORM_SIGNAL_EXPECTATION_FAMILY,
    expectationModelVersion: PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION,
    lowInfoPolicy: PE4_FORM_SIGNAL_LOW_INFO_POLICY,
    developmentSeason: PE4_FORM_SIGNAL_DEV_SEASON,
    confirmatorySeason: PE4_FORM_SIGNAL_CONFIRMATORY_SEASON,
    holdoutSeason: PE4_FORM_SIGNAL_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    residualDefinition: PE4_FORM_SIGNAL_RESIDUAL_DEFINITION,
    lastNWindows: PE4_FORM_SIGNAL_LAST_N_WINDOWS,
    calendarDayWindows: PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS,
    includeRecencyWeighted: PE4_FORM_SIGNAL_INCLUDE_RECENCY_WEIGHTED,
    recencyHalfLifeDays: PE4_FORM_SIGNAL_RECENCY_HALF_LIFE_DAYS,
    horizons: PE4_FORM_SIGNAL_HORIZONS,
    histResidualRangeEdges: PE4_FORM_SIGNAL_HIST_RESIDUAL_RANGE_EDGES,
    epRangeEdges: PE4_FORM_SIGNAL_EP_RANGE_EDGES,
    bootstrapSeed: PE4_FORM_SIGNAL_BOOTSTRAP_SEED,
    bootstrapIterations: PE4_FORM_SIGNAL_BOOTSTRAP_ITERATIONS,
    shuffleSeed: PE4_FORM_SIGNAL_SHUFFLE_SEED,
    shuffleIterations: PE4_FORM_SIGNAL_SHUFFLE_ITERATIONS,
    crossSeasonHistory: PE4_FORM_SIGNAL_CROSS_SEASON_HISTORY,
    primaryHistoryForTable: PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE,
    gdResidualStatus: "UNAVAILABLE",
    noPeAdjustment: true,
    noOptimizedDecay: true,
    noOptimizedWindow: true,
    stochasticSeedNote: "bootstrap_and_shuffle_only_fixed_seeds",
  };
}

export function stringifyPe4FormSignalProtocol(
  protocol: Pe4FormSignalProtocol,
): string {
  return JSON.stringify(protocol, Object.keys(protocol).sort(), 2);
}

export function digestPe4FormSignalProtocol(
  protocol: Pe4FormSignalProtocol = pe4FormSignalProtocol(),
): string {
  return createHash("sha256")
    .update(stringifyPe4FormSignalProtocol(protocol), "utf8")
    .digest("hex");
}
