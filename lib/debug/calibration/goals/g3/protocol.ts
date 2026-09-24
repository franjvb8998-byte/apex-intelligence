/**
 * GOALS-1E — Frozen protocol goals.g3.opponent_adjusted_attack_defense.v1
 *
 * Parent G1 (k=10) frozen. Opponent adjustment selected on 2023 only.
 * Do NOT edit after confirmatory 2024 metrics are observed.
 */

import { createHash } from "node:crypto";
import {
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
  GOALS_G0_PROTOCOL_VERSION,
} from "@/lib/debug/calibration/goals/g0/protocol";
import {
  GOALS_G1_MODEL_VERSION,
  GOALS_G1_PROTOCOL_VERSION,
} from "@/lib/debug/calibration/goals/g1/protocol";

export const GOALS_G3_PROTOCOL_VERSION =
  "goals.g3.opponent_adjusted_attack_defense.v1" as const;
export const GOALS_G3_MODEL_VERSION =
  "goals.g3.opponent_adjusted_attack_defense.v1" as const;

export const GOALS_G3_REQUIRED_EVIDENCE_DIGEST =
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST;

export const GOALS_G3_PARENT_G0_PROTOCOL_VERSION = GOALS_G0_PROTOCOL_VERSION;
export const GOALS_G3_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_G3_PARENT_G1_PROTOCOL_VERSION = GOALS_G1_PROTOCOL_VERSION;
export const GOALS_G3_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;
export const GOALS_G3_PARENT_G1_MODEL_VERSION = GOALS_G1_MODEL_VERSION;
export const GOALS_G3_FROZEN_SHRINKAGE_K = 10 as const;

export const GOALS_G3_DEV_SEASON = "2023" as const;
export const GOALS_G3_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_G3_HOLDOUT_SEASON = "2025" as const;

export const GOALS_G3_REGULATION_LABEL_POLICY = "REGULATION_90_ONLY" as const;
export const GOALS_G3_LABEL_PROVENANCE_NOTE =
  "calibration_actual_under_league_ft_assumption_must_remain_visible" as const;

/** Reconstruction base from PE-4 common baseline — NOT empirical center. */
export const GOALS_G3_RECONSTRUCTION_BASE = 1580 as const;

/**
 * Elo-point scale for normalized opponent quality.
 * Predeclared; not optimized on outcomes.
 */
export const GOALS_G3_NORMALIZATION_SCALE = 100 as const;

/**
 * Development-only beta candidates. beta=0 is required null (G1 reproduction).
 * Positive beta: scoring vs stronger opponents counts more for attack;
 * conceding vs stronger opponents counts less against defense.
 */
export const GOALS_G3_BETA_CANDIDATES = [0, 0.05, 0.1, 0.15, 0.2] as const;
export type GoalsG3Beta = (typeof GOALS_G3_BETA_CANDIDATES)[number];

export const GOALS_G3_PRIMARY_SELECTION_METRIC =
  "joint_score_log_loss" as const;

/** Fixed descriptive bins for opponent centered strength (predeclared). */
export const GOALS_G3_OPPONENT_CENTERED_BINS = [
  -Infinity, -1.5, -0.5, 0.5, 1.5, Infinity,
] as const;

export const GOALS_G3_CALIBRATION_BINS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001,
] as const;

export type GoalsG3Protocol = {
  protocolVersion: typeof GOALS_G3_PROTOCOL_VERSION;
  modelVersion: typeof GOALS_G3_MODEL_VERSION;
  requiredEvidenceDigest: typeof GOALS_G3_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolVersion: typeof GOALS_G3_PARENT_G0_PROTOCOL_VERSION;
  parentG0ProtocolDigest: typeof GOALS_G3_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolVersion: typeof GOALS_G3_PARENT_G1_PROTOCOL_VERSION;
  parentG1ProtocolDigest: typeof GOALS_G3_PARENT_G1_PROTOCOL_DIGEST;
  parentG1ModelVersion: typeof GOALS_G3_PARENT_G1_MODEL_VERSION;
  frozenShrinkageK: typeof GOALS_G3_FROZEN_SHRINKAGE_K;
  developmentSeason: typeof GOALS_G3_DEV_SEASON;
  confirmatorySeason: typeof GOALS_G3_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_G3_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  regulationLabelPolicy: typeof GOALS_G3_REGULATION_LABEL_POLICY;
  labelProvenanceNote: typeof GOALS_G3_LABEL_PROVENANCE_NOTE;
  modelFamily: "INDEPENDENT_POISSON_OPPONENT_ADJUSTED_ATTACK_DEFENSE_G3";
  opponentStrengthRepresentation: "pe4_common_fixed_baseline_index_as_of_M";
  opponentStrengthIsSeparateAttackDefense: false;
  opponentStrengthIsGenericQualityProxy: true;
  reconstructionBase: typeof GOALS_G3_RECONSTRUCTION_BASE;
  empiricalCenterSource: "mean_catalogue_opponent_strength_dev_2023";
  normalizationScale: typeof GOALS_G3_NORMALIZATION_SCALE;
  adjustmentFamily: "exp_beta_normalized_common_strength";
  attackAdjustment: "goalsFor * exp(+beta * z)";
  defenseAdjustment: "goalsAgainst * exp(-beta * z)";
  betaCandidates: typeof GOALS_G3_BETA_CANDIDATES;
  selectedBeta: GoalsG3Beta | null;
  primarySelectionMetric: typeof GOALS_G3_PRIMARY_SELECTION_METRIC;
  selectionSeason: typeof GOALS_G3_DEV_SEASON;
  basePriorOpponentPolicy: "neutral_adjustment_equals_1";
  unavailableOpponentPolicy: "neutral_adjustment_equals_1_PARTIAL";
  temporalRule: "kickoff_lt_M_for_opponent_strength";
  noRetuneShrinkageK: true;
  noOpponentAdjustmentAtTargetT: true;
  noDixonColes: true;
  noNegativeBinomial: true;
  noEloPoisson: true;
  noFittedHfa: true;
  noOdds: true;
  marketsReuse: "goals.g0.poisson_markets";
  oneXTwoIsDiagnosticOnly: true;
  stochasticSeed: null;
};

export function goalsG3Protocol(
  selectedBeta: GoalsG3Beta | null = null,
): GoalsG3Protocol {
  return {
    protocolVersion: GOALS_G3_PROTOCOL_VERSION,
    modelVersion: GOALS_G3_MODEL_VERSION,
    requiredEvidenceDigest: GOALS_G3_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolVersion: GOALS_G3_PARENT_G0_PROTOCOL_VERSION,
    parentG0ProtocolDigest: GOALS_G3_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolVersion: GOALS_G3_PARENT_G1_PROTOCOL_VERSION,
    parentG1ProtocolDigest: GOALS_G3_PARENT_G1_PROTOCOL_DIGEST,
    parentG1ModelVersion: GOALS_G3_PARENT_G1_MODEL_VERSION,
    frozenShrinkageK: GOALS_G3_FROZEN_SHRINKAGE_K,
    developmentSeason: GOALS_G3_DEV_SEASON,
    confirmatorySeason: GOALS_G3_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_G3_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    regulationLabelPolicy: GOALS_G3_REGULATION_LABEL_POLICY,
    labelProvenanceNote: GOALS_G3_LABEL_PROVENANCE_NOTE,
    modelFamily: "INDEPENDENT_POISSON_OPPONENT_ADJUSTED_ATTACK_DEFENSE_G3",
    opponentStrengthRepresentation: "pe4_common_fixed_baseline_index_as_of_M",
    opponentStrengthIsSeparateAttackDefense: false,
    opponentStrengthIsGenericQualityProxy: true,
    reconstructionBase: GOALS_G3_RECONSTRUCTION_BASE,
    empiricalCenterSource: "mean_catalogue_opponent_strength_dev_2023",
    normalizationScale: GOALS_G3_NORMALIZATION_SCALE,
    adjustmentFamily: "exp_beta_normalized_common_strength",
    attackAdjustment: "goalsFor * exp(+beta * z)",
    defenseAdjustment: "goalsAgainst * exp(-beta * z)",
    betaCandidates: GOALS_G3_BETA_CANDIDATES,
    selectedBeta,
    primarySelectionMetric: GOALS_G3_PRIMARY_SELECTION_METRIC,
    selectionSeason: GOALS_G3_DEV_SEASON,
    basePriorOpponentPolicy: "neutral_adjustment_equals_1",
    unavailableOpponentPolicy: "neutral_adjustment_equals_1_PARTIAL",
    temporalRule: "kickoff_lt_M_for_opponent_strength",
    noRetuneShrinkageK: true,
    noOpponentAdjustmentAtTargetT: true,
    noDixonColes: true,
    noNegativeBinomial: true,
    noEloPoisson: true,
    noFittedHfa: true,
    noOdds: true,
    marketsReuse: "goals.g0.poisson_markets",
    oneXTwoIsDiagnosticOnly: true,
    stochasticSeed: null,
  };
}

export function digestGoalsG3Protocol(protocol: GoalsG3Protocol): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
