/**
 * GOALS-1H.1 — Frozen recent attack/defense form signal audit protocol.
 * SIGNAL AUDIT ONLY. No blend/theta/G1 mutation/calibration.
 */

import { createHash } from "node:crypto";

export const GOALS_RAD_PROTOCOL_VERSION =
  "goals.recent_attack_defense.signal_audit.v1" as const;

export const GOALS_RAD_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_RAD_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_RAD_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_RAD_PARENT_G1_K = 10 as const;

export const GOALS_RAD_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_RAD_PARENT_F1_PROTOCOL_DIGEST =
  "70972c5007d68833977eeda491913abf30138fb3b3d0c0624d19ba16a247f067" as const;

export const GOALS_RAD_PARENT_F1_VERDICT =
  "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED" as const;

export const GOALS_RAD_PARENT_G11_PROTOCOL_DIGEST =
  "4a408a2381440c75b83c8169b40e8d9b55f482b1fde3b848680a2d2e51ebb97b" as const;

export const GOALS_RAD_PARENT_G12_PROTOCOL_DIGEST =
  "b1a054ab4c570bf5e70bb924891cd639fba01706a1e92ce5184d401aef23d00e" as const;

export const GOALS_RAD_PARENT_G12_VERDICT =
  "PARTIAL_CALIBRATION_CANDIDATE" as const;

export const GOALS_RAD_PARENT_G13_PROTOCOL_DIGEST =
  "d29871a4a3f9ac59f98df794e3d561ec02d1e0a215abac4d4ef035df26058901" as const;

export const GOALS_RAD_PARENT_G13_VERDICT =
  "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE" as const;

export const GOALS_RAD_DEV_SEASON = "2023" as const;
export const GOALS_RAD_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_RAD_HOLDOUT_SEASON = "2025" as const;

export const GOALS_RAD_LAST_N_WINDOWS = [3, 5, 8] as const;
export const GOALS_RAD_CALENDAR_DAY_WINDOWS = [28, 56] as const;
export const GOALS_RAD_RECENCY_HALF_LIFE_DAYS = 28 as const;
export const GOALS_RAD_HORIZONS = [1, 2, 3] as const;

export const GOALS_RAD_BOOTSTRAP_SEED = 20241001 as const;
export const GOALS_RAD_BOOTSTRAP_ITERATIONS = 500 as const;
export const GOALS_RAD_SHUFFLE_SEED = 424243 as const;
export const GOALS_RAD_SHUFFLE_ITERATIONS = 100 as const;

/** Predeclared |residual| strata (descriptive). */
export const GOALS_RAD_ABS_RESIDUAL_STRATA = [
  { id: "lt_1", maxExclusive: 1 },
  { id: "1_to_2", maxExclusive: 2 },
  { id: "ge_2", maxExclusive: Number.POSITIVE_INFINITY },
] as const;

export const GOALS_RAD_WINSOR_CAP = 2 as const;

/** Classification thresholds frozen before metrics. */
export const GOALS_RAD_NEAR_ZERO_ABS_R = 0.05 as const;

export const GOALS_RAD_ATTACK_RESIDUAL_SEMANTICS =
  "actualGoalsFor_minus_G1_expectedGoalsFor_positive_means_scored_more_than_G1_expected" as const;

export const GOALS_RAD_DEFENSE_RESIDUAL_SEMANTICS =
  "actualGoalsAgainst_minus_G1_expectedGoalsAgainst_positive_means_conceded_more_than_G1_expected_defensive_underperformance" as const;

export const GOALS_RAD_HYPOTHESIS =
  "Recent team scoring/conceding residuals vs G1 may contain incremental short-horizon information beyond G1 longer venue-role history. Not WDL/Elo/xG/opponent-adj/calibrator." as const;

export type GoalsRadProtocol = {
  protocolVersion: typeof GOALS_RAD_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_RAD_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_RAD_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_RAD_PARENT_G1_PROTOCOL_DIGEST;
  parentG1ShrinkageK: typeof GOALS_RAD_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_RAD_PARENT_G3_SELECTED_BETA;
  parentF1ProtocolDigest: typeof GOALS_RAD_PARENT_F1_PROTOCOL_DIGEST;
  parentF1Verdict: typeof GOALS_RAD_PARENT_F1_VERDICT;
  parentG11ProtocolDigest: typeof GOALS_RAD_PARENT_G11_PROTOCOL_DIGEST;
  parentG12ProtocolDigest: typeof GOALS_RAD_PARENT_G12_PROTOCOL_DIGEST;
  parentG12Verdict: typeof GOALS_RAD_PARENT_G12_VERDICT;
  parentG13ProtocolDigest: typeof GOALS_RAD_PARENT_G13_PROTOCOL_DIGEST;
  parentG13Verdict: typeof GOALS_RAD_PARENT_G13_VERDICT;
  developmentSeason: typeof GOALS_RAD_DEV_SEASON;
  confirmatorySeason: typeof GOALS_RAD_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_RAD_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  hypothesis: typeof GOALS_RAD_HYPOTHESIS;
  attackResidualSemantics: typeof GOALS_RAD_ATTACK_RESIDUAL_SEMANTICS;
  defenseResidualSemantics: typeof GOALS_RAD_DEFENSE_RESIDUAL_SEMANTICS;
  lastNWindows: typeof GOALS_RAD_LAST_N_WINDOWS;
  calendarDayWindows: typeof GOALS_RAD_CALENDAR_DAY_WINDOWS;
  recencyHalfLifeDays: typeof GOALS_RAD_RECENCY_HALF_LIFE_DAYS;
  horizons: typeof GOALS_RAD_HORIZONS;
  absResidualStrata: typeof GOALS_RAD_ABS_RESIDUAL_STRATA;
  winsorCap: typeof GOALS_RAD_WINSOR_CAP;
  nearZeroAbsR: typeof GOALS_RAD_NEAR_ZERO_ABS_R;
  bootstrapSeed: typeof GOALS_RAD_BOOTSTRAP_SEED;
  bootstrapIterations: typeof GOALS_RAD_BOOTSTRAP_ITERATIONS;
  shuffleSeed: typeof GOALS_RAD_SHUFFLE_SEED;
  shuffleIterations: typeof GOALS_RAD_SHUFFLE_ITERATIONS;
  seasonsIndependent: true;
  noWindowOptimization: true;
  noBlendCoefficient: true;
  noTheta: true;
  noDecayOptimization: true;
  noRegressionFit: true;
  noEloBoost: true;
  noProbabilityMutation: true;
  noNewExpectedGoalsFormula: true;
  noCalibration: true;
  noOdds: true;
  noEv: true;
  noG1Modification: true;
  noProductionWiring: true;
  signalAuditOnly: true;
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_RAD_BOOTSTRAP_SEED;
};

export function goalsRadProtocol(): GoalsRadProtocol {
  return {
    protocolVersion: GOALS_RAD_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_RAD_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_RAD_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_RAD_PARENT_G1_PROTOCOL_DIGEST,
    parentG1ShrinkageK: GOALS_RAD_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_RAD_PARENT_G3_SELECTED_BETA,
    parentF1ProtocolDigest: GOALS_RAD_PARENT_F1_PROTOCOL_DIGEST,
    parentF1Verdict: GOALS_RAD_PARENT_F1_VERDICT,
    parentG11ProtocolDigest: GOALS_RAD_PARENT_G11_PROTOCOL_DIGEST,
    parentG12ProtocolDigest: GOALS_RAD_PARENT_G12_PROTOCOL_DIGEST,
    parentG12Verdict: GOALS_RAD_PARENT_G12_VERDICT,
    parentG13ProtocolDigest: GOALS_RAD_PARENT_G13_PROTOCOL_DIGEST,
    parentG13Verdict: GOALS_RAD_PARENT_G13_VERDICT,
    developmentSeason: GOALS_RAD_DEV_SEASON,
    confirmatorySeason: GOALS_RAD_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_RAD_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    hypothesis: GOALS_RAD_HYPOTHESIS,
    attackResidualSemantics: GOALS_RAD_ATTACK_RESIDUAL_SEMANTICS,
    defenseResidualSemantics: GOALS_RAD_DEFENSE_RESIDUAL_SEMANTICS,
    lastNWindows: GOALS_RAD_LAST_N_WINDOWS,
    calendarDayWindows: GOALS_RAD_CALENDAR_DAY_WINDOWS,
    recencyHalfLifeDays: GOALS_RAD_RECENCY_HALF_LIFE_DAYS,
    horizons: GOALS_RAD_HORIZONS,
    absResidualStrata: GOALS_RAD_ABS_RESIDUAL_STRATA,
    winsorCap: GOALS_RAD_WINSOR_CAP,
    nearZeroAbsR: GOALS_RAD_NEAR_ZERO_ABS_R,
    bootstrapSeed: GOALS_RAD_BOOTSTRAP_SEED,
    bootstrapIterations: GOALS_RAD_BOOTSTRAP_ITERATIONS,
    shuffleSeed: GOALS_RAD_SHUFFLE_SEED,
    shuffleIterations: GOALS_RAD_SHUFFLE_ITERATIONS,
    seasonsIndependent: true,
    noWindowOptimization: true,
    noBlendCoefficient: true,
    noTheta: true,
    noDecayOptimization: true,
    noRegressionFit: true,
    noEloBoost: true,
    noProbabilityMutation: true,
    noNewExpectedGoalsFormula: true,
    noCalibration: true,
    noOdds: true,
    noEv: true,
    noG1Modification: true,
    noProductionWiring: true,
    signalAuditOnly: true,
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_RAD_BOOTSTRAP_SEED,
  };
}

export function digestGoalsRadProtocol(
  protocol: GoalsRadProtocol = goalsRadProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
