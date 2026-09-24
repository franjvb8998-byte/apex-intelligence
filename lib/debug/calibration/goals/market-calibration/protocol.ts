/**
 * GOALS-1G.1 — Frozen market-calibration audit protocol.
 * NO calibrator fitting. Parent: G1 k=10.
 */

import { createHash } from "node:crypto";

export const GOALS_MCAL_PROTOCOL_VERSION =
  "goals.market_calibration.audit.v1" as const;

export const GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_MCAL_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_MCAL_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_MCAL_PARENT_G1_MODEL =
  "goals.g1.attack_defense_poisson.v1" as const;

export const GOALS_MCAL_PARENT_G1_K = 10 as const;

export const GOALS_MCAL_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_MCAL_PARENT_F1_PROTOCOL_DIGEST =
  "70972c5007d68833977eeda491913abf30138fb3b3d0c0624d19ba16a247f067" as const;

export const GOALS_MCAL_PARENT_F1_VERDICT =
  "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED" as const;

export const GOALS_MCAL_DEV_SEASON = "2023" as const;
export const GOALS_MCAL_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_MCAL_HOLDOUT_SEASON = "2025" as const;

export const GOALS_MCAL_BOOTSTRAP_SEED = 20240924 as const;
export const GOALS_MCAL_BOOTSTRAP_REPLICATES = 500 as const;

export const GOALS_MCAL_LOGIT_EPSILON = 1e-6 as const;

export const GOALS_MCAL_RELIABILITY_BINS = [
  0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0000001,
] as const;

export const GOALS_MCAL_MIN_BIN_SUPPORT = 10 as const;

/** Rare-event: positive rate < this OR > 1-this. */
export const GOALS_MCAL_RARE_EVENT_RATE = 0.08 as const;

/** Temporal stability thresholds — frozen before 2024 conclusions. */
export const GOALS_MCAL_CITL_GOOD = 0.03 as const;
export const GOALS_MCAL_CITL_MATERIAL = 0.03 as const;
export const GOALS_MCAL_CITL_UNSTABLE = 0.02 as const;
export const GOALS_MCAL_LOW_SUPPORT_MIN_CLASS = 20 as const;

/**
 * Canonical binary propositions (OVER / YES only).
 * Complements are derived, not independent evidence.
 */
export const GOALS_MCAL_CANONICAL_MARKETS = [
  "MATCH_TOTAL_OVER_0_5",
  "MATCH_TOTAL_OVER_1_5",
  "MATCH_TOTAL_OVER_2_5",
  "MATCH_TOTAL_OVER_3_5",
  "MATCH_TOTAL_OVER_4_5",
  "BTTS_YES",
  "HOME_TOTAL_OVER_0_5",
  "HOME_TOTAL_OVER_1_5",
  "HOME_TOTAL_OVER_2_5",
  "AWAY_TOTAL_OVER_0_5",
  "AWAY_TOTAL_OVER_1_5",
  "AWAY_TOTAL_OVER_2_5",
] as const;

export type GoalsMcalCanonicalMarket =
  (typeof GOALS_MCAL_CANONICAL_MARKETS)[number];

export const GOALS_MCAL_BOOTSTRAP_MARKETS = [
  "MATCH_TOTAL_OVER_0_5",
  "MATCH_TOTAL_OVER_1_5",
  "MATCH_TOTAL_OVER_2_5",
  "MATCH_TOTAL_OVER_3_5",
  "MATCH_TOTAL_OVER_4_5",
  "BTTS_YES",
] as const;

export type GoalsMcalProtocol = {
  protocolVersion: typeof GOALS_MCAL_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_MCAL_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_MCAL_PARENT_G1_PROTOCOL_DIGEST;
  parentG1Model: typeof GOALS_MCAL_PARENT_G1_MODEL;
  parentG1ShrinkageK: typeof GOALS_MCAL_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_MCAL_PARENT_G3_SELECTED_BETA;
  parentF1ProtocolDigest: typeof GOALS_MCAL_PARENT_F1_PROTOCOL_DIGEST;
  parentF1Verdict: typeof GOALS_MCAL_PARENT_F1_VERDICT;
  developmentSeason: typeof GOALS_MCAL_DEV_SEASON;
  confirmatorySeason: typeof GOALS_MCAL_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_MCAL_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  auditOnly: true;
  noCalibratorFitting: true;
  noDixonColes: true;
  noNegativeBinomial: true;
  canonicalMarkets: typeof GOALS_MCAL_CANONICAL_MARKETS;
  complementsAreDerived: true;
  reliabilityBins: typeof GOALS_MCAL_RELIABILITY_BINS;
  minBinSupport: typeof GOALS_MCAL_MIN_BIN_SUPPORT;
  rareEventRate: typeof GOALS_MCAL_RARE_EVENT_RATE;
  logitEpsilon: typeof GOALS_MCAL_LOGIT_EPSILON;
  bootstrapSeed: typeof GOALS_MCAL_BOOTSTRAP_SEED;
  bootstrapReplicates: typeof GOALS_MCAL_BOOTSTRAP_REPLICATES;
  bootstrapMarkets: typeof GOALS_MCAL_BOOTSTRAP_MARKETS;
  citlGood: typeof GOALS_MCAL_CITL_GOOD;
  citlMaterial: typeof GOALS_MCAL_CITL_MATERIAL;
  citlUnstable: typeof GOALS_MCAL_CITL_UNSTABLE;
  lowSupportMinClass: typeof GOALS_MCAL_LOW_SUPPORT_MIN_CLASS;
  temporalRulesFrozenBeforeConfirmatory: true;
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_MCAL_BOOTSTRAP_SEED;
};

export function goalsMcalProtocol(): GoalsMcalProtocol {
  return {
    protocolVersion: GOALS_MCAL_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_MCAL_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_MCAL_PARENT_G1_PROTOCOL_DIGEST,
    parentG1Model: GOALS_MCAL_PARENT_G1_MODEL,
    parentG1ShrinkageK: GOALS_MCAL_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_MCAL_PARENT_G3_SELECTED_BETA,
    parentF1ProtocolDigest: GOALS_MCAL_PARENT_F1_PROTOCOL_DIGEST,
    parentF1Verdict: GOALS_MCAL_PARENT_F1_VERDICT,
    developmentSeason: GOALS_MCAL_DEV_SEASON,
    confirmatorySeason: GOALS_MCAL_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_MCAL_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    auditOnly: true,
    noCalibratorFitting: true,
    noDixonColes: true,
    noNegativeBinomial: true,
    canonicalMarkets: GOALS_MCAL_CANONICAL_MARKETS,
    complementsAreDerived: true,
    reliabilityBins: GOALS_MCAL_RELIABILITY_BINS,
    minBinSupport: GOALS_MCAL_MIN_BIN_SUPPORT,
    rareEventRate: GOALS_MCAL_RARE_EVENT_RATE,
    logitEpsilon: GOALS_MCAL_LOGIT_EPSILON,
    bootstrapSeed: GOALS_MCAL_BOOTSTRAP_SEED,
    bootstrapReplicates: GOALS_MCAL_BOOTSTRAP_REPLICATES,
    bootstrapMarkets: GOALS_MCAL_BOOTSTRAP_MARKETS,
    citlGood: GOALS_MCAL_CITL_GOOD,
    citlMaterial: GOALS_MCAL_CITL_MATERIAL,
    citlUnstable: GOALS_MCAL_CITL_UNSTABLE,
    lowSupportMinClass: GOALS_MCAL_LOW_SUPPORT_MIN_CLASS,
    temporalRulesFrozenBeforeConfirmatory: true,
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_MCAL_BOOTSTRAP_SEED,
  };
}

export function digestGoalsMcalProtocol(
  protocol: GoalsMcalProtocol = goalsMcalProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
