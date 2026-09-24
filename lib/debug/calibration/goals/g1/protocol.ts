/**
 * GOALS-1D — Frozen protocol goals.g1.attack_defense_poisson.v1
 * Formulas / candidates / eligibility frozen before confirmatory 2024.
 * selectedShrinkageK is locked only after 2023 development selection.
 */

import { createHash } from "node:crypto";
import {
  GOALS_G0_PROTOCOL_VERSION,
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/g0/protocol";

export const GOALS_G1_PROTOCOL_VERSION =
  "goals.g1.attack_defense_poisson.v1" as const;
export const GOALS_G1_MODEL_VERSION =
  "goals.g1.attack_defense_poisson.v1" as const;

export const GOALS_G1_REQUIRED_EVIDENCE_DIGEST =
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST;

export const GOALS_G1_PARENT_G0_PROTOCOL_VERSION = GOALS_G0_PROTOCOL_VERSION;
export const GOALS_G1_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_G1_DEV_SEASON = "2023" as const;
export const GOALS_G1_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_G1_HOLDOUT_SEASON = "2025" as const;

export const GOALS_G1_REGULATION_LABEL_POLICY = "REGULATION_90_ONLY" as const;
export const GOALS_G1_LABEL_PROVENANCE_NOTE =
  "calibration_actual_under_league_ft_assumption_must_remain_visible" as const;

/** Development-only candidate family — small, predeclared. */
export const GOALS_G1_SHRINKAGE_CANDIDATES = [2, 5, 10] as const;
export type GoalsG1ShrinkageK = (typeof GOALS_G1_SHRINKAGE_CANDIDATES)[number];

/** Diagnostic-only raw rates; not eligible for confirmatory selection. */
export const GOALS_G1_RAW_DIAGNOSTIC_K = 0 as const;

export const GOALS_G1_PRIMARY_SELECTION_METRIC =
  "joint_score_log_loss" as const;
export const GOALS_G1_SECONDARY_SELECTION_METRIC =
  "total_goal_log_loss" as const;

export const GOALS_G1_CALIBRATION_BINS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001,
] as const;
export const GOALS_G1_MIN_BIN_SUPPORT = 10 as const;

export type GoalsG1Protocol = {
  protocolVersion: typeof GOALS_G1_PROTOCOL_VERSION;
  modelVersion: typeof GOALS_G1_MODEL_VERSION;
  requiredEvidenceDigest: typeof GOALS_G1_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolVersion: typeof GOALS_G1_PARENT_G0_PROTOCOL_VERSION;
  parentG0ProtocolDigest: typeof GOALS_G1_PARENT_G0_PROTOCOL_DIGEST;
  developmentSeason: typeof GOALS_G1_DEV_SEASON;
  confirmatorySeason: typeof GOALS_G1_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_G1_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  regulationLabelPolicy: typeof GOALS_G1_REGULATION_LABEL_POLICY;
  labelProvenanceNote: typeof GOALS_G1_LABEL_PROVENANCE_NOTE;
  modelFamily: "INDEPENDENT_POISSON_TEAM_ATTACK_DEFENSE_G1";
  muHomeFormula: "leagueHomeRate * homeAttackStrength * awayDefenseStrength";
  muAwayFormula: "leagueAwayRate * awayAttackStrength * homeDefenseStrength";
  homeAttackStrength: "homeAttackRate / leagueHomeRate";
  homeDefenseStrength: "homeDefenseRate / leagueAwayRate";
  awayAttackStrength: "awayAttackRate / leagueAwayRate";
  awayDefenseStrength: "awayDefenseRate / leagueHomeRate";
  defenseOrientation: "gt1_concedes_more_than_league_average";
  shrinkageFamily: "empirical_bayes_rate_toward_league";
  shrinkageFormula: "(n*r + k*L) / (n+k)";
  shrinkageCandidates: typeof GOALS_G1_SHRINKAGE_CANDIDATES;
  rawDiagnosticK: typeof GOALS_G1_RAW_DIAGNOSTIC_K;
  primarySelectionMetric: typeof GOALS_G1_PRIMARY_SELECTION_METRIC;
  secondarySelectionMetric: typeof GOALS_G1_SECONDARY_SELECTION_METRIC;
  selectedShrinkageK: GoalsG1ShrinkageK | null;
  selectionSeason: typeof GOALS_G1_DEV_SEASON;
  eligibility: "league_baseline_available_finite_positive_mu";
  nZeroFallback: "strength_equals_1_BASE_PRIOR";
  noPriorSeasonImport: true;
  noOpponentAdjustment: true;
  noRecentFormWeighting: true;
  noDixonColes: true;
  noNegativeBinomial: true;
  noElo: true;
  noCommonStrengthPredictor: true;
  noFittedHfa: true;
  noOdds: true;
  homeAdvantageVia: "league_home_away_rates_and_venue_role_team_rates_only";
  marketsReuse: "goals.g0.poisson_markets";
  oneXTwoIsDiagnosticOnly: true;
  stochasticSeed: null;
};

export function goalsG1Protocol(
  selectedShrinkageK: GoalsG1ShrinkageK | null = null,
): GoalsG1Protocol {
  return {
    protocolVersion: GOALS_G1_PROTOCOL_VERSION,
    modelVersion: GOALS_G1_MODEL_VERSION,
    requiredEvidenceDigest: GOALS_G1_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolVersion: GOALS_G1_PARENT_G0_PROTOCOL_VERSION,
    parentG0ProtocolDigest: GOALS_G1_PARENT_G0_PROTOCOL_DIGEST,
    developmentSeason: GOALS_G1_DEV_SEASON,
    confirmatorySeason: GOALS_G1_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_G1_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    regulationLabelPolicy: GOALS_G1_REGULATION_LABEL_POLICY,
    labelProvenanceNote: GOALS_G1_LABEL_PROVENANCE_NOTE,
    modelFamily: "INDEPENDENT_POISSON_TEAM_ATTACK_DEFENSE_G1",
    muHomeFormula: "leagueHomeRate * homeAttackStrength * awayDefenseStrength",
    muAwayFormula: "leagueAwayRate * awayAttackStrength * homeDefenseStrength",
    homeAttackStrength: "homeAttackRate / leagueHomeRate",
    homeDefenseStrength: "homeDefenseRate / leagueAwayRate",
    awayAttackStrength: "awayAttackRate / leagueAwayRate",
    awayDefenseStrength: "awayDefenseRate / leagueHomeRate",
    defenseOrientation: "gt1_concedes_more_than_league_average",
    shrinkageFamily: "empirical_bayes_rate_toward_league",
    shrinkageFormula: "(n*r + k*L) / (n+k)",
    shrinkageCandidates: GOALS_G1_SHRINKAGE_CANDIDATES,
    rawDiagnosticK: GOALS_G1_RAW_DIAGNOSTIC_K,
    primarySelectionMetric: GOALS_G1_PRIMARY_SELECTION_METRIC,
    secondarySelectionMetric: GOALS_G1_SECONDARY_SELECTION_METRIC,
    selectedShrinkageK,
    selectionSeason: GOALS_G1_DEV_SEASON,
    eligibility: "league_baseline_available_finite_positive_mu",
    nZeroFallback: "strength_equals_1_BASE_PRIOR",
    noPriorSeasonImport: true,
    noOpponentAdjustment: true,
    noRecentFormWeighting: true,
    noDixonColes: true,
    noNegativeBinomial: true,
    noElo: true,
    noCommonStrengthPredictor: true,
    noFittedHfa: true,
    noOdds: true,
    homeAdvantageVia: "league_home_away_rates_and_venue_role_team_rates_only",
    marketsReuse: "goals.g0.poisson_markets",
    oneXTwoIsDiagnosticOnly: true,
    stochasticSeed: null,
  };
}

export function digestGoalsG1Protocol(protocol: GoalsG1Protocol): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
