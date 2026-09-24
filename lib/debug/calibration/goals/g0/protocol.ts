/**
 * GOALS-1C — Frozen protocol goals.g0.league_baseline.v1
 * MUST NOT be edited after confirmatory 2024 metrics are observed.
 */

import { createHash } from "node:crypto";

export const GOALS_G0_PROTOCOL_VERSION = "goals.g0.league_baseline.v1" as const;
export const GOALS_G0_MODEL_VERSION = "goals.g0.independent_poisson.v1" as const;

export const GOALS_G0_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_G0_DEV_SEASON = "2023" as const;
export const GOALS_G0_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_G0_HOLDOUT_SEASON = "2025" as const;

export const GOALS_G0_REGULATION_LABEL_POLICY = "REGULATION_90_ONLY" as const;
export const GOALS_G0_LABEL_PROVENANCE_NOTE =
  "calibration_actual_under_league_ft_assumption_must_remain_visible" as const;

/** Truncation for 1X2 / exact-score diagnostics only — markets use analytic formulas. */
export const GOALS_G0_DIAGNOSTIC_MAX_GOALS = 20 as const;

export const GOALS_G0_CALIBRATION_BINS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001,
] as const;

export const GOALS_G0_MIN_BIN_SUPPORT = 10 as const;

export type GoalsG0Protocol = {
  protocolVersion: typeof GOALS_G0_PROTOCOL_VERSION;
  modelVersion: typeof GOALS_G0_MODEL_VERSION;
  requiredEvidenceDigest: typeof GOALS_G0_REQUIRED_EVIDENCE_DIGEST;
  developmentSeason: typeof GOALS_G0_DEV_SEASON;
  confirmatorySeason: typeof GOALS_G0_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_G0_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  regulationLabelPolicy: typeof GOALS_G0_REGULATION_LABEL_POLICY;
  labelProvenanceNote: typeof GOALS_G0_LABEL_PROVENANCE_NOTE;
  eligibility:
    "leagueMatchesPlayedBefore_gt_0_and_finite_positive_muHome_muAway";
  earlySeasonFallback: "UNAVAILABLE_no_prior_season_import";
  modelFamily: "INDEPENDENT_POISSON_LEAGUE_ENVIRONMENT_G0";
  features: "league_home_away_goal_rates_as_of_T_only";
  noTeamIdentity: true;
  noElo: true;
  noCommonStrength: true;
  noFittedHfa: true;
  noOdds: true;
  diagnosticMaxGoals: typeof GOALS_G0_DIAGNOSTIC_MAX_GOALS;
  marketsAnalytic: true;
  oneXTwoIsDiagnosticOnly: true;
  stochasticSeed: null;
};

export function goalsG0Protocol(): GoalsG0Protocol {
  return {
    protocolVersion: GOALS_G0_PROTOCOL_VERSION,
    modelVersion: GOALS_G0_MODEL_VERSION,
    requiredEvidenceDigest: GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
    developmentSeason: GOALS_G0_DEV_SEASON,
    confirmatorySeason: GOALS_G0_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_G0_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    regulationLabelPolicy: GOALS_G0_REGULATION_LABEL_POLICY,
    labelProvenanceNote: GOALS_G0_LABEL_PROVENANCE_NOTE,
    eligibility:
      "leagueMatchesPlayedBefore_gt_0_and_finite_positive_muHome_muAway",
    earlySeasonFallback: "UNAVAILABLE_no_prior_season_import",
    modelFamily: "INDEPENDENT_POISSON_LEAGUE_ENVIRONMENT_G0",
    features: "league_home_away_goal_rates_as_of_T_only",
    noTeamIdentity: true,
    noElo: true,
    noCommonStrength: true,
    noFittedHfa: true,
    noOdds: true,
    diagnosticMaxGoals: GOALS_G0_DIAGNOSTIC_MAX_GOALS,
    marketsAnalytic: true,
    oneXTwoIsDiagnosticOnly: true,
    stochasticSeed: null,
  };
}

export function digestGoalsG0Protocol(
  protocol: GoalsG0Protocol = goalsG0Protocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
