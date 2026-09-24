/**
 * GOALS-1G.2 — Frozen constrained market-calibration POC protocol.
 * CAL_0 (identity) vs CAL_1 (logistic). Development-only fitting.
 * Parent: G1 k=10. No isotonic. No production wiring.
 */

import { createHash } from "node:crypto";

export const GOALS_MCAL_POC_PROTOCOL_VERSION =
  "goals.market_calibration.poc.v1" as const;

export const GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_MCAL_POC_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_MCAL_POC_PARENT_G1_MODEL =
  "goals.g1.attack_defense_poisson.v1" as const;

export const GOALS_MCAL_POC_PARENT_G1_K = 10 as const;

export const GOALS_MCAL_POC_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_MCAL_POC_PARENT_F1_PROTOCOL_DIGEST =
  "70972c5007d68833977eeda491913abf30138fb3b3d0c0624d19ba16a247f067" as const;

export const GOALS_MCAL_POC_PARENT_F1_VERDICT =
  "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED" as const;

export const GOALS_MCAL_POC_PARENT_G1_1_PROTOCOL_DIGEST =
  "4a408a2381440c75b83c8169b40e8d9b55f482b1fde3b848680a2d2e51ebb97b" as const;

export const GOALS_MCAL_POC_PARENT_G1_1_VERDICT =
  "READY_FOR_GOALS_1G2_CALIBRATION_POC" as const;

export const GOALS_MCAL_POC_DEV_SEASON = "2023" as const;
export const GOALS_MCAL_POC_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_MCAL_POC_HOLDOUT_SEASON = "2025" as const;

export const GOALS_MCAL_POC_LOGIT_EPSILON = 1e-6 as const;

/** Ridge toward identity (a→0, b→1). Frozen before fold results. */
export const GOALS_MCAL_POC_RIDGE_LAMBDA = 1e-4 as const;

export const GOALS_MCAL_POC_BOOTSTRAP_SEED = 20240925 as const;
export const GOALS_MCAL_POC_BOOTSTRAP_REPLICATES = 500 as const;

export const GOALS_MCAL_POC_RELIABILITY_BINS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001,
] as const;

export const GOALS_MCAL_POC_MIN_BIN_SUPPORT = 10 as const;

/**
 * O0.5 policy: included in GROUP_MATCH_TOTAL shared (a,b) only —
 * no O0.5-dedicated logistic. Shared transform preserves mono when b>0.
 */
export const GOALS_MCAL_POC_O05_POLICY =
  "SHARED_MATCH_TOTAL_TRANSFORM_INCLUDES_O05_NO_DEDICATED_FIT" as const;

export const GOALS_MCAL_POC_O05_POLICY_RATIONALE =
  "Under 0.5 is rare (0-0). Dedicated O0.5 logistic is forbidden. O0.5 rides the shared match-total CAL_1 so monotonicity with other Over thresholds is preserved when b>0. Material O0.5 LL worsen on development folds rejects match-total CAL_1." as const;

/**
 * Selection (frozen before fold results):
 * CAL_1 wins a group iff ALL hold on mean chronological folds:
 *   1) meanFoldLL(CAL_0) - meanFoldLL(CAL_1) >= MIN_MEAN_FOLD_LL_IMPROVEMENT
 *   2) meanFoldBrier(CAL_1) - meanFoldBrier(CAL_0) <= MAX_MEAN_FOLD_BRIER_WORSEN
 *   3) every fold and full-dev refit has finite a,b with b > 0
 *   4) for GROUP_MATCH_TOTAL only:
 *        meanFoldLL_O05(CAL_1) - meanFoldLL_O05(CAL_0) <= O05_MAX_MEAN_FOLD_LL_WORSEN
 * Else CAL_0.
 */
export const GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT = 0.001 as const;
export const GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN = 0.0005 as const;
export const GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN = 0.002 as const;

export const GOALS_MCAL_POC_SELECTION_RULE =
  "cal1_if_mean_fold_ll_improves_by_min_and_brier_not_materially_worse_and_b_gt_0_and_match_total_o05_not_materially_worse" as const;

export const GOALS_MCAL_POC_INTERNAL_FOLDS = [
  { id: "fold_a", trainEndFrac: 0.5, evalEndFrac: 0.7 },
  { id: "fold_b", trainEndFrac: 0.7, evalEndFrac: 0.85 },
  { id: "fold_c", trainEndFrac: 0.85, evalEndFrac: 1.0 },
] as const;

export const GOALS_MCAL_POC_MIN_TRAIN_FIXTURES = 80 as const;

export const GOALS_MCAL_POC_GROUP_MATCH_TOTAL = [
  "MATCH_TOTAL_OVER_0_5",
  "MATCH_TOTAL_OVER_1_5",
  "MATCH_TOTAL_OVER_2_5",
  "MATCH_TOTAL_OVER_3_5",
  "MATCH_TOTAL_OVER_4_5",
] as const;

export const GOALS_MCAL_POC_GROUP_HOME_TOTAL = [
  "HOME_TOTAL_OVER_0_5",
  "HOME_TOTAL_OVER_1_5",
  "HOME_TOTAL_OVER_2_5",
] as const;

export const GOALS_MCAL_POC_GROUP_AWAY_TOTAL = [
  "AWAY_TOTAL_OVER_0_5",
  "AWAY_TOTAL_OVER_1_5",
  "AWAY_TOTAL_OVER_2_5",
] as const;

export const GOALS_MCAL_POC_GROUP_BTTS = ["BTTS_YES"] as const;

export const GOALS_MCAL_POC_CANONICAL_MARKETS = [
  ...GOALS_MCAL_POC_GROUP_MATCH_TOTAL,
  ...GOALS_MCAL_POC_GROUP_BTTS,
  ...GOALS_MCAL_POC_GROUP_HOME_TOTAL,
  ...GOALS_MCAL_POC_GROUP_AWAY_TOTAL,
] as const;

export type GoalsMcalPocCanonicalMarket =
  (typeof GOALS_MCAL_POC_CANONICAL_MARKETS)[number];

export type GoalsMcalPocGroupId =
  | "GROUP_MATCH_TOTAL"
  | "GROUP_HOME_TOTAL"
  | "GROUP_AWAY_TOTAL"
  | "BTTS";

export const GOALS_MCAL_POC_GROUPS: Record<
  GoalsMcalPocGroupId,
  readonly GoalsMcalPocCanonicalMarket[]
> = {
  GROUP_MATCH_TOTAL: GOALS_MCAL_POC_GROUP_MATCH_TOTAL,
  GROUP_HOME_TOTAL: GOALS_MCAL_POC_GROUP_HOME_TOTAL,
  GROUP_AWAY_TOTAL: GOALS_MCAL_POC_GROUP_AWAY_TOTAL,
  BTTS: GOALS_MCAL_POC_GROUP_BTTS,
};

export const GOALS_MCAL_POC_MONOTONE_GROUPS: readonly GoalsMcalPocGroupId[] = [
  "GROUP_MATCH_TOTAL",
  "GROUP_HOME_TOTAL",
  "GROUP_AWAY_TOTAL",
] as const;

export type GoalsMcalPocProtocol = {
  protocolVersion: typeof GOALS_MCAL_POC_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_MCAL_POC_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST;
  parentG1Model: typeof GOALS_MCAL_POC_PARENT_G1_MODEL;
  parentG1ShrinkageK: typeof GOALS_MCAL_POC_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_MCAL_POC_PARENT_G3_SELECTED_BETA;
  parentF1ProtocolDigest: typeof GOALS_MCAL_POC_PARENT_F1_PROTOCOL_DIGEST;
  parentF1Verdict: typeof GOALS_MCAL_POC_PARENT_F1_VERDICT;
  parentG11ProtocolDigest: typeof GOALS_MCAL_POC_PARENT_G1_1_PROTOCOL_DIGEST;
  parentG11Verdict: typeof GOALS_MCAL_POC_PARENT_G1_1_VERDICT;
  developmentSeason: typeof GOALS_MCAL_POC_DEV_SEASON;
  confirmatorySeason: typeof GOALS_MCAL_POC_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_MCAL_POC_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  candidateFamilies: readonly ["CAL_0", "CAL_1"];
  noIsotonic: true;
  noHighCapacityCalibration: true;
  noDixonColes: true;
  noNegativeBinomial: true;
  noProductionWiring: true;
  researchPocOnly: true;
  logitEpsilon: typeof GOALS_MCAL_POC_LOGIT_EPSILON;
  ridgeLambda: typeof GOALS_MCAL_POC_RIDGE_LAMBDA;
  o05Policy: typeof GOALS_MCAL_POC_O05_POLICY;
  o05PolicyRationale: typeof GOALS_MCAL_POC_O05_POLICY_RATIONALE;
  groups: typeof GOALS_MCAL_POC_GROUPS;
  monotoneGroups: typeof GOALS_MCAL_POC_MONOTONE_GROUPS;
  internalFolds: typeof GOALS_MCAL_POC_INTERNAL_FOLDS;
  minTrainFixtures: typeof GOALS_MCAL_POC_MIN_TRAIN_FIXTURES;
  selectionRule: typeof GOALS_MCAL_POC_SELECTION_RULE;
  minMeanFoldLlImprovement: typeof GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT;
  maxMeanFoldBrierWorsen: typeof GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN;
  o05MaxMeanFoldLlWorsen: typeof GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN;
  reliabilityBins: typeof GOALS_MCAL_POC_RELIABILITY_BINS;
  minBinSupport: typeof GOALS_MCAL_POC_MIN_BIN_SUPPORT;
  bootstrapSeed: typeof GOALS_MCAL_POC_BOOTSTRAP_SEED;
  bootstrapReplicates: typeof GOALS_MCAL_POC_BOOTSTRAP_REPLICATES;
  bttsDefaultHypothesis: "CAL_0_UNLESS_DEVELOPMENT_MIN_GAIN";
  failClosedOnNonPositiveSlope: true;
  noPostHocMonotonicityRepair: true;
  complementsAreDerived: true;
  selectionUsesDevelopmentOnly: true;
  confirmatoryOnceAfterSelection: true;
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_MCAL_POC_BOOTSTRAP_SEED;
};

export function goalsMcalPocProtocol(): GoalsMcalPocProtocol {
  return {
    protocolVersion: GOALS_MCAL_POC_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_MCAL_POC_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST,
    parentG1Model: GOALS_MCAL_POC_PARENT_G1_MODEL,
    parentG1ShrinkageK: GOALS_MCAL_POC_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_MCAL_POC_PARENT_G3_SELECTED_BETA,
    parentF1ProtocolDigest: GOALS_MCAL_POC_PARENT_F1_PROTOCOL_DIGEST,
    parentF1Verdict: GOALS_MCAL_POC_PARENT_F1_VERDICT,
    parentG11ProtocolDigest: GOALS_MCAL_POC_PARENT_G1_1_PROTOCOL_DIGEST,
    parentG11Verdict: GOALS_MCAL_POC_PARENT_G1_1_VERDICT,
    developmentSeason: GOALS_MCAL_POC_DEV_SEASON,
    confirmatorySeason: GOALS_MCAL_POC_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_MCAL_POC_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    candidateFamilies: ["CAL_0", "CAL_1"] as const,
    noIsotonic: true,
    noHighCapacityCalibration: true,
    noDixonColes: true,
    noNegativeBinomial: true,
    noProductionWiring: true,
    researchPocOnly: true,
    logitEpsilon: GOALS_MCAL_POC_LOGIT_EPSILON,
    ridgeLambda: GOALS_MCAL_POC_RIDGE_LAMBDA,
    o05Policy: GOALS_MCAL_POC_O05_POLICY,
    o05PolicyRationale: GOALS_MCAL_POC_O05_POLICY_RATIONALE,
    groups: GOALS_MCAL_POC_GROUPS,
    monotoneGroups: GOALS_MCAL_POC_MONOTONE_GROUPS,
    internalFolds: GOALS_MCAL_POC_INTERNAL_FOLDS,
    minTrainFixtures: GOALS_MCAL_POC_MIN_TRAIN_FIXTURES,
    selectionRule: GOALS_MCAL_POC_SELECTION_RULE,
    minMeanFoldLlImprovement: GOALS_MCAL_POC_MIN_MEAN_FOLD_LL_IMPROVEMENT,
    maxMeanFoldBrierWorsen: GOALS_MCAL_POC_MAX_MEAN_FOLD_BRIER_WORSEN,
    o05MaxMeanFoldLlWorsen: GOALS_MCAL_POC_O05_MAX_MEAN_FOLD_LL_WORSEN,
    reliabilityBins: GOALS_MCAL_POC_RELIABILITY_BINS,
    minBinSupport: GOALS_MCAL_POC_MIN_BIN_SUPPORT,
    bootstrapSeed: GOALS_MCAL_POC_BOOTSTRAP_SEED,
    bootstrapReplicates: GOALS_MCAL_POC_BOOTSTRAP_REPLICATES,
    bttsDefaultHypothesis: "CAL_0_UNLESS_DEVELOPMENT_MIN_GAIN",
    failClosedOnNonPositiveSlope: true,
    noPostHocMonotonicityRepair: true,
    complementsAreDerived: true,
    selectionUsesDevelopmentOnly: true,
    confirmatoryOnceAfterSelection: true,
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_MCAL_POC_BOOTSTRAP_SEED,
  };
}

export function digestGoalsMcalPocProtocol(
  protocol: GoalsMcalPocProtocol = goalsMcalPocProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
