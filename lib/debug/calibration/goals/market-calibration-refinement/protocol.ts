/**
 * GOALS-1G.3 — Frozen match-total calibration refinement protocol.
 * Candidates R0–R3 only. Development=2023 selection. 2024 previously observed.
 * Parent: G1 k=10 + G1.2 PARTIAL_CALIBRATION_CANDIDATE.
 */

import { createHash } from "node:crypto";

export const GOALS_MCAL_REF_PROTOCOL_VERSION =
  "goals.market_calibration.refinement.v1" as const;

export const GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_MCAL_REF_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_MCAL_REF_PARENT_G1_K = 10 as const;

export const GOALS_MCAL_REF_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_MCAL_REF_PARENT_F1_PROTOCOL_DIGEST =
  "70972c5007d68833977eeda491913abf30138fb3b3d0c0624d19ba16a247f067" as const;

export const GOALS_MCAL_REF_PARENT_G11_PROTOCOL_DIGEST =
  "4a408a2381440c75b83c8169b40e8d9b55f482b1fde3b848680a2d2e51ebb97b" as const;

export const GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST =
  "b1a054ab4c570bf5e70bb924891cd639fba01706a1e92ce5184d401aef23d00e" as const;

export const GOALS_MCAL_REF_PARENT_G12_VERDICT =
  "PARTIAL_CALIBRATION_CANDIDATE" as const;

export const GOALS_MCAL_REF_DEV_SEASON = "2023" as const;
export const GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_MCAL_REF_HOLDOUT_SEASON = "2025" as const;

/** 2024 is confirmatory only — previously observed; never selection-eligible. */
export const GOALS_MCAL_REF_2024_PREVIOUSLY_OBSERVED = true as const;
export const GOALS_MCAL_REF_2024_SELECTION_ELIGIBLE = false as const;

export const GOALS_MCAL_REF_LOGIT_EPSILON = 1e-6 as const;
export const GOALS_MCAL_REF_RIDGE_LAMBDA = 1e-4 as const;

export const GOALS_MCAL_REF_BOOTSTRAP_SEED = 20240926 as const;
export const GOALS_MCAL_REF_BOOTSTRAP_REPLICATES = 500 as const;

export const GOALS_MCAL_REF_INTERNAL_FOLDS = [
  { id: "fold_a", trainEndFrac: 0.5, evalEndFrac: 0.7 },
  { id: "fold_b", trainEndFrac: 0.7, evalEndFrac: 0.85 },
  { id: "fold_c", trainEndFrac: 0.85, evalEndFrac: 1.0 },
] as const;

export const GOALS_MCAL_REF_MIN_TRAIN_FIXTURES = 80 as const;

export const GOALS_MCAL_REF_MATCH_TOTAL_MARKETS = [
  "MATCH_TOTAL_OVER_0_5",
  "MATCH_TOTAL_OVER_1_5",
  "MATCH_TOTAL_OVER_2_5",
  "MATCH_TOTAL_OVER_3_5",
  "MATCH_TOTAL_OVER_4_5",
] as const;

export const GOALS_MCAL_REF_LOW_THRESHOLD_MARKETS = [
  "MATCH_TOTAL_OVER_0_5",
  "MATCH_TOTAL_OVER_1_5",
] as const;

export const GOALS_MCAL_REF_HIGH_THRESHOLD_MARKETS = [
  "MATCH_TOTAL_OVER_2_5",
  "MATCH_TOTAL_OVER_3_5",
  "MATCH_TOTAL_OVER_4_5",
] as const;

export type GoalsMcalRefCandidateId = "R0" | "R1" | "R2" | "R3";

/**
 * Intentionally tiny family:
 * R0 identity, R1 = G.2 shared logistic (reference), R2 intercept-only shared,
 * R3 low-threshold shared logistic only. No threshold-specific / isotonic /
 * spline / 2024-chosen candidates — avoids post-observing 2024 architecture search.
 */
export const GOALS_MCAL_REF_CANDIDATES = ["R0", "R1", "R2", "R3"] as const;

/** Preference when mean-fold LL tied within tolerance (simpler first). */
export const GOALS_MCAL_REF_COMPLEXITY_PREFERENCE = [
  "R0",
  "R2",
  "R3",
  "R1",
] as const;

/**
 * Frozen guardrails (before fold results):
 * 1) meanFoldAggLL(R0)-meanFoldAggLL(c) >= MIN_AGG_LL_IMPROVEMENT  (non-R0)
 * 2) meanFoldAggBrier(c)-meanFoldAggBrier(R0) <= MAX_BRIER_WORSEN
 * 3) meanFoldO05LL(c)-meanFoldO05LL(R0) <= O05_MAX_LL_WORSEN
 * 4) meanFoldO15LL(c)-meanFoldO15LL(R0) <= O15_MAX_LL_WORSEN
 * 5) R3 high thresholds exactly raw
 * 6) coherence (R3: no cross-boundary mono violations)
 * Tie: within TIE_LL_TOLERANCE prefer R0 > R2 > R3 > R1
 */
export const GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT = 0.001 as const;
export const GOALS_MCAL_REF_MAX_BRIER_WORSEN = 0.0005 as const;
export const GOALS_MCAL_REF_O05_MAX_LL_WORSEN = 0.002 as const;
export const GOALS_MCAL_REF_O15_MAX_LL_WORSEN = 0.002 as const;
export const GOALS_MCAL_REF_TIE_LL_TOLERANCE = 0.0005 as const;

export const GOALS_MCAL_REF_SELECTION_RULE =
  "eligible_by_frozen_guardrails_then_best_mean_fold_agg_ll_with_complexity_preference_on_tie" as const;

export const GOALS_MCAL_REF_FAMILY_RATIONALE =
  "Closed set of four candidates only: identity, G.2 shared logistic reference, intercept-only shared (b=1), and low-threshold shared logistic for O0.5/O1.5. Intentionally small to avoid 2024-driven architecture search after G.2 confirmatory observation." as const;

export type GoalsMcalRefProtocol = {
  protocolVersion: typeof GOALS_MCAL_REF_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST;
  parentG1ShrinkageK: typeof GOALS_MCAL_REF_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_MCAL_REF_PARENT_G3_SELECTED_BETA;
  parentF1ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_F1_PROTOCOL_DIGEST;
  parentG11ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G11_PROTOCOL_DIGEST;
  parentG12ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST;
  parentG12Verdict: typeof GOALS_MCAL_REF_PARENT_G12_VERDICT;
  developmentSeason: typeof GOALS_MCAL_REF_DEV_SEASON;
  observedConfirmatorySeason: typeof GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_MCAL_REF_HOLDOUT_SEASON;
  confirmatory2024PreviouslyObserved: typeof GOALS_MCAL_REF_2024_PREVIOUSLY_OBSERVED;
  confirmatory2024SelectionEligible: typeof GOALS_MCAL_REF_2024_SELECTION_ELIGIBLE;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  candidates: typeof GOALS_MCAL_REF_CANDIDATES;
  complexityPreference: typeof GOALS_MCAL_REF_COMPLEXITY_PREFERENCE;
  familyRationale: typeof GOALS_MCAL_REF_FAMILY_RATIONALE;
  matchTotalMarkets: typeof GOALS_MCAL_REF_MATCH_TOTAL_MARKETS;
  lowThresholdMarkets: typeof GOALS_MCAL_REF_LOW_THRESHOLD_MARKETS;
  highThresholdMarkets: typeof GOALS_MCAL_REF_HIGH_THRESHOLD_MARKETS;
  noThresholdSpecificFits: true;
  noIsotonic: true;
  noSplines: true;
  noPostHocProbabilitySorting: true;
  noO05OnlyCalibrator: true;
  noO15OnlyCalibrator: true;
  noParametersFrom2024: true;
  noProductionWiring: true;
  researchOnly: true;
  logitEpsilon: typeof GOALS_MCAL_REF_LOGIT_EPSILON;
  ridgeLambda: typeof GOALS_MCAL_REF_RIDGE_LAMBDA;
  internalFolds: typeof GOALS_MCAL_REF_INTERNAL_FOLDS;
  minTrainFixtures: typeof GOALS_MCAL_REF_MIN_TRAIN_FIXTURES;
  selectionRule: typeof GOALS_MCAL_REF_SELECTION_RULE;
  minAggLlImprovement: typeof GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT;
  maxBrierWorsen: typeof GOALS_MCAL_REF_MAX_BRIER_WORSEN;
  o05MaxLlWorsen: typeof GOALS_MCAL_REF_O05_MAX_LL_WORSEN;
  o15MaxLlWorsen: typeof GOALS_MCAL_REF_O15_MAX_LL_WORSEN;
  tieLlTolerance: typeof GOALS_MCAL_REF_TIE_LL_TOLERANCE;
  bootstrapSeed: typeof GOALS_MCAL_REF_BOOTSTRAP_SEED;
  bootstrapReplicates: typeof GOALS_MCAL_REF_BOOTSTRAP_REPLICATES;
  r2SlopeFixed: 1;
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_MCAL_REF_BOOTSTRAP_SEED;
};

export function goalsMcalRefProtocol(): GoalsMcalRefProtocol {
  return {
    protocolVersion: GOALS_MCAL_REF_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_MCAL_REF_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST,
    parentG1ShrinkageK: GOALS_MCAL_REF_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_MCAL_REF_PARENT_G3_SELECTED_BETA,
    parentF1ProtocolDigest: GOALS_MCAL_REF_PARENT_F1_PROTOCOL_DIGEST,
    parentG11ProtocolDigest: GOALS_MCAL_REF_PARENT_G11_PROTOCOL_DIGEST,
    parentG12ProtocolDigest: GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST,
    parentG12Verdict: GOALS_MCAL_REF_PARENT_G12_VERDICT,
    developmentSeason: GOALS_MCAL_REF_DEV_SEASON,
    observedConfirmatorySeason: GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_MCAL_REF_HOLDOUT_SEASON,
    confirmatory2024PreviouslyObserved: GOALS_MCAL_REF_2024_PREVIOUSLY_OBSERVED,
    confirmatory2024SelectionEligible: GOALS_MCAL_REF_2024_SELECTION_ELIGIBLE,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    candidates: GOALS_MCAL_REF_CANDIDATES,
    complexityPreference: GOALS_MCAL_REF_COMPLEXITY_PREFERENCE,
    familyRationale: GOALS_MCAL_REF_FAMILY_RATIONALE,
    matchTotalMarkets: GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
    lowThresholdMarkets: GOALS_MCAL_REF_LOW_THRESHOLD_MARKETS,
    highThresholdMarkets: GOALS_MCAL_REF_HIGH_THRESHOLD_MARKETS,
    noThresholdSpecificFits: true,
    noIsotonic: true,
    noSplines: true,
    noPostHocProbabilitySorting: true,
    noO05OnlyCalibrator: true,
    noO15OnlyCalibrator: true,
    noParametersFrom2024: true,
    noProductionWiring: true,
    researchOnly: true,
    logitEpsilon: GOALS_MCAL_REF_LOGIT_EPSILON,
    ridgeLambda: GOALS_MCAL_REF_RIDGE_LAMBDA,
    internalFolds: GOALS_MCAL_REF_INTERNAL_FOLDS,
    minTrainFixtures: GOALS_MCAL_REF_MIN_TRAIN_FIXTURES,
    selectionRule: GOALS_MCAL_REF_SELECTION_RULE,
    minAggLlImprovement: GOALS_MCAL_REF_MIN_AGG_LL_IMPROVEMENT,
    maxBrierWorsen: GOALS_MCAL_REF_MAX_BRIER_WORSEN,
    o05MaxLlWorsen: GOALS_MCAL_REF_O05_MAX_LL_WORSEN,
    o15MaxLlWorsen: GOALS_MCAL_REF_O15_MAX_LL_WORSEN,
    tieLlTolerance: GOALS_MCAL_REF_TIE_LL_TOLERANCE,
    bootstrapSeed: GOALS_MCAL_REF_BOOTSTRAP_SEED,
    bootstrapReplicates: GOALS_MCAL_REF_BOOTSTRAP_REPLICATES,
    r2SlopeFixed: 1,
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_MCAL_REF_BOOTSTRAP_SEED,
  };
}

export function digestGoalsMcalRefProtocol(
  protocol: GoalsMcalRefProtocol = goalsMcalRefProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
