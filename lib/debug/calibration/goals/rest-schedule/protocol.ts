/**
 * GOALS-1I.1 — Frozen rest/schedule congestion signal audit protocol.
 * SIGNAL AUDIT ONLY. No fatigue multiplier / G1 mutation / coefficient fit.
 */

import { createHash } from "node:crypto";

export const GOALS_REST_PROTOCOL_VERSION =
  "goals.rest_schedule.signal_audit.v1" as const;

export const GOALS_REST_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_REST_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_REST_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_REST_PARENT_G1_K = 10 as const;

export const GOALS_REST_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_REST_PARENT_F1_VERDICT =
  "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED" as const;

export const GOALS_REST_PARENT_H1_PROTOCOL_DIGEST =
  "6436461e162a5c7f13e3dd80cac64ea417712e9b29adef2d0909e701283af2e7" as const;

export const GOALS_REST_PARENT_H1_VERDICT =
  "NO_INCREMENTAL_RECENT_GOAL_SIGNAL" as const;

export const GOALS_REST_DEV_SEASON = "2023" as const;
export const GOALS_REST_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_REST_HOLDOUT_SEASON = "2025" as const;

/** PL competition only in GOALS-1B evidence (competitionIdFilter=39). */
export const GOALS_REST_SCHEDULE_COVERAGE =
  "PREMIER_LEAGUE_ONLY_COMPETITION_ID_39" as const;

export const GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION =
  "UNAVAILABLE_NO_AS_OF_T_SCHEDULE_SNAPSHOT" as const;

export const GOALS_REST_CROSS_SEASON_HISTORY = "DISABLED_SAME_SEASON_ONLY" as const;

/** Descriptive rest bins (not optimized). */
export const GOALS_REST_BINS = [
  "REST_LE_2",
  "REST_3",
  "REST_4",
  "REST_5",
  "REST_6",
  "REST_7_PLUS",
] as const;

export type GoalsRestBin = (typeof GOALS_REST_BINS)[number];

export const GOALS_REST_LOAD_WINDOWS_DAYS = [7, 14, 28] as const;

export const GOALS_REST_WINSOR_CAP = 2 as const;

export const GOALS_REST_BOOTSTRAP_SEED = 20240924 as const;
export const GOALS_REST_BOOTSTRAP_REPS = 500 as const;

export const GOALS_REST_SHUFFLE_SEED = 515151 as const;
export const GOALS_REST_SHUFFLE_REPS = 100 as const;

/** Continuous |r| below this ⇒ near-zero for classification. */
export const GOALS_REST_NEAR_ZERO_ABS_R = 0.05 as const;

/**
 * Season stage by leagueMatchesPlayedBefore (home+away min already in G1):
 * EARLY: leagueMatchesPlayedBefore < 80
 * MID: 80 <= n < 240
 * LATE: n >= 240
 * (league-wide fixture count before T; deterministic, not outcome-tuned)
 */
export const GOALS_REST_STAGE_EARLY_MAX_EXCL = 80 as const;
export const GOALS_REST_STAGE_MID_MAX_EXCL = 240 as const;

export const GOALS_REST_HYPOTHESIS =
  "League rest/schedule-load features available strictly before kickoff may explain incremental G1 residual variation. Not a fatigue multiplier. PL-only past load (cups/UEFA absent)." as const;

/**
 * Classification (frozen before metrics):
 * REPLICATED_DESCRIPTIVE_SIGNAL:
 *   primary continuous |r| >= NEAR_ZERO in BOTH seasons with same sign,
 *   AND fixture-bootstrap 95% CI for development does not cover 0,
 *   AND team-demeaned association retains same sign with |r| >= 0.5*|raw_r|
 *     OR stratum short-rest vs rest7+ mean residual gap same sign both seasons
 * CONFOUNDED_SIGNAL:
 *   raw meets replication magnitude/sign but team-demeaned flips or collapses
 * WEAK_INCONSISTENT_SIGNAL:
 *   one season only / unstable sign / CI covers 0
 * NO_SIGNAL:
 *   both seasons |r| < NEAR_ZERO for primary restDays→total/attack/defense
 * INSUFFICIENT_SUPPORT:
 *   primary AVAILABLE n < 100 in either season
 */
export const GOALS_REST_CLASSIFICATION_RULE =
  "replicated_requires_both_seasons_abs_r_ge_0.05_same_sign_dev_ci_excludes_0_and_survives_team_demean_or_else_confounded_weak_or_none" as const;

export type GoalsRestProtocol = {
  protocolVersion: typeof GOALS_REST_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_REST_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_REST_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_REST_PARENT_G1_PROTOCOL_DIGEST;
  parentG1ShrinkageK: typeof GOALS_REST_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_REST_PARENT_G3_SELECTED_BETA;
  parentF1Verdict: typeof GOALS_REST_PARENT_F1_VERDICT;
  parentH1ProtocolDigest: typeof GOALS_REST_PARENT_H1_PROTOCOL_DIGEST;
  parentH1Verdict: typeof GOALS_REST_PARENT_H1_VERDICT;
  developmentSeason: typeof GOALS_REST_DEV_SEASON;
  confirmatorySeason: typeof GOALS_REST_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_REST_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  scheduleCoverage: typeof GOALS_REST_SCHEDULE_COVERAGE;
  futureScheduleAnticipation: typeof GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION;
  crossSeasonHistory: typeof GOALS_REST_CROSS_SEASON_HISTORY;
  hypothesis: typeof GOALS_REST_HYPOTHESIS;
  restBins: typeof GOALS_REST_BINS;
  loadWindowsDays: typeof GOALS_REST_LOAD_WINDOWS_DAYS;
  winsorCap: typeof GOALS_REST_WINSOR_CAP;
  bootstrapSeed: typeof GOALS_REST_BOOTSTRAP_SEED;
  bootstrapReps: typeof GOALS_REST_BOOTSTRAP_REPS;
  shuffleSeed: typeof GOALS_REST_SHUFFLE_SEED;
  shuffleReps: typeof GOALS_REST_SHUFFLE_REPS;
  nearZeroAbsR: typeof GOALS_REST_NEAR_ZERO_ABS_R;
  stageEarlyMaxExclusive: typeof GOALS_REST_STAGE_EARLY_MAX_EXCL;
  stageMidMaxExclusive: typeof GOALS_REST_STAGE_MID_MAX_EXCL;
  classificationRule: typeof GOALS_REST_CLASSIFICATION_RULE;
  featureSemanticsPrefix: "league";
  noFatigueMultiplier: true;
  noCoefficientFit: true;
  noG1Modification: true;
  noCalibration: true;
  noOdds: true;
  noEv: true;
  noProductionWiring: true;
  signalAuditOnly: true;
  relativeRestSignConvention: "homeRestDays_minus_awayRestDays";
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_REST_BOOTSTRAP_SEED;
};

export function goalsRestProtocol(): GoalsRestProtocol {
  return {
    protocolVersion: GOALS_REST_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_REST_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_REST_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_REST_PARENT_G1_PROTOCOL_DIGEST,
    parentG1ShrinkageK: GOALS_REST_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_REST_PARENT_G3_SELECTED_BETA,
    parentF1Verdict: GOALS_REST_PARENT_F1_VERDICT,
    parentH1ProtocolDigest: GOALS_REST_PARENT_H1_PROTOCOL_DIGEST,
    parentH1Verdict: GOALS_REST_PARENT_H1_VERDICT,
    developmentSeason: GOALS_REST_DEV_SEASON,
    confirmatorySeason: GOALS_REST_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_REST_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    scheduleCoverage: GOALS_REST_SCHEDULE_COVERAGE,
    futureScheduleAnticipation: GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION,
    crossSeasonHistory: GOALS_REST_CROSS_SEASON_HISTORY,
    hypothesis: GOALS_REST_HYPOTHESIS,
    restBins: GOALS_REST_BINS,
    loadWindowsDays: GOALS_REST_LOAD_WINDOWS_DAYS,
    winsorCap: GOALS_REST_WINSOR_CAP,
    bootstrapSeed: GOALS_REST_BOOTSTRAP_SEED,
    bootstrapReps: GOALS_REST_BOOTSTRAP_REPS,
    shuffleSeed: GOALS_REST_SHUFFLE_SEED,
    shuffleReps: GOALS_REST_SHUFFLE_REPS,
    nearZeroAbsR: GOALS_REST_NEAR_ZERO_ABS_R,
    stageEarlyMaxExclusive: GOALS_REST_STAGE_EARLY_MAX_EXCL,
    stageMidMaxExclusive: GOALS_REST_STAGE_MID_MAX_EXCL,
    classificationRule: GOALS_REST_CLASSIFICATION_RULE,
    featureSemanticsPrefix: "league",
    noFatigueMultiplier: true,
    noCoefficientFit: true,
    noG1Modification: true,
    noCalibration: true,
    noOdds: true,
    noEv: true,
    noProductionWiring: true,
    signalAuditOnly: true,
    relativeRestSignConvention: "homeRestDays_minus_awayRestDays",
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_REST_BOOTSTRAP_SEED,
  };
}

export function digestGoalsRestProtocol(
  protocol: GoalsRestProtocol = goalsRestProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}

export function restBinFromDays(days: number): GoalsRestBin {
  if (days <= 2) return "REST_LE_2";
  if (days <= 3) return "REST_3";
  if (days <= 4) return "REST_4";
  if (days <= 5) return "REST_5";
  if (days <= 6) return "REST_6";
  return "REST_7_PLUS";
}

export function seasonStageFromLeaguePlayed(
  leagueMatchesPlayedBefore: number,
): "EARLY" | "MID" | "LATE" {
  if (leagueMatchesPlayedBefore < GOALS_REST_STAGE_EARLY_MAX_EXCL) return "EARLY";
  if (leagueMatchesPlayedBefore < GOALS_REST_STAGE_MID_MAX_EXCL) return "MID";
  return "LATE";
}
