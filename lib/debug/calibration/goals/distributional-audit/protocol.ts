/**
 * GOALS-1F.1 — Frozen distributional audit protocol.
 * NO model fitting. Parent: G1 k=10.
 */

import { createHash } from "node:crypto";

export const GOALS_DIST_AUDIT_PROTOCOL_VERSION =
  "goals.distributional_audit.v1" as const;

export const GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST =
  "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95" as const;

export const GOALS_DIST_AUDIT_PARENT_G0_PROTOCOL_DIGEST =
  "a63f9e4acea9e559f85213504455be54945106876e2d8c5a38afb1c9fa968712" as const;

export const GOALS_DIST_AUDIT_PARENT_G1_PROTOCOL_DIGEST =
  "ad35f71225febd77bae15f2281d0fbb0ac7cd927eb67392a685daa98dc87414b" as const;

export const GOALS_DIST_AUDIT_PARENT_G1_MODEL =
  "goals.g1.attack_defense_poisson.v1" as const;

export const GOALS_DIST_AUDIT_PARENT_G1_K = 10 as const;

export const GOALS_DIST_AUDIT_PARENT_G3_SELECTED_BETA = 0 as const;

export const GOALS_DIST_AUDIT_DEV_SEASON = "2023" as const;
export const GOALS_DIST_AUDIT_CONFIRMATORY_SEASON = "2024" as const;
export const GOALS_DIST_AUDIT_HOLDOUT_SEASON = "2025" as const;

/** Fixed bootstrap seed — declared before confirmatory conclusions. */
export const GOALS_DIST_AUDIT_BOOTSTRAP_SEED = 20240924 as const;
export const GOALS_DIST_AUDIT_BOOTSTRAP_REPLICATES = 500 as const;

/**
 * Predeclared home/away/total count buckets (not optimized on outcomes).
 * Home/away: 0..4, 5+
 * Total: 0..5, 6+
 */
export const GOALS_DIST_AUDIT_SIDE_BUCKETS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5+",
] as const;

export const GOALS_DIST_AUDIT_TOTAL_BUCKETS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6+",
] as const;

export const GOALS_DIST_AUDIT_TAIL_REGIONS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5+",
] as const;

export const GOALS_DIST_AUDIT_LOW_SCORE_CELLS = [
  "0-0",
  "1-0",
  "0-1",
  "1-1",
] as const;

/** Expected-total strata: tertiles of 2023 eligible G1 predicted totals. */
export const GOALS_DIST_AUDIT_EXPECTED_TOTAL_STRATA = [
  "low",
  "medium",
  "high",
] as const;

export type GoalsDistAuditProtocol = {
  protocolVersion: typeof GOALS_DIST_AUDIT_PROTOCOL_VERSION;
  requiredEvidenceDigest: typeof GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST;
  parentG0ProtocolDigest: typeof GOALS_DIST_AUDIT_PARENT_G0_PROTOCOL_DIGEST;
  parentG1ProtocolDigest: typeof GOALS_DIST_AUDIT_PARENT_G1_PROTOCOL_DIGEST;
  parentG1Model: typeof GOALS_DIST_AUDIT_PARENT_G1_MODEL;
  parentG1ShrinkageK: typeof GOALS_DIST_AUDIT_PARENT_G1_K;
  parentG3SelectedBeta: typeof GOALS_DIST_AUDIT_PARENT_G3_SELECTED_BETA;
  developmentSeason: typeof GOALS_DIST_AUDIT_DEV_SEASON;
  confirmatorySeason: typeof GOALS_DIST_AUDIT_CONFIRMATORY_SEASON;
  holdoutSeason: typeof GOALS_DIST_AUDIT_HOLDOUT_SEASON;
  holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL";
  auditOnly: true;
  noDixonColesFit: true;
  noNegativeBinomialFit: true;
  noHyperparameterSelection: true;
  bootstrapSeed: typeof GOALS_DIST_AUDIT_BOOTSTRAP_SEED;
  bootstrapReplicates: typeof GOALS_DIST_AUDIT_BOOTSTRAP_REPLICATES;
  sideBuckets: typeof GOALS_DIST_AUDIT_SIDE_BUCKETS;
  totalBuckets: typeof GOALS_DIST_AUDIT_TOTAL_BUCKETS;
  tailRegions: typeof GOALS_DIST_AUDIT_TAIL_REGIONS;
  lowScoreCells: typeof GOALS_DIST_AUDIT_LOW_SCORE_CELLS;
  expectedTotalStrata: typeof GOALS_DIST_AUDIT_EXPECTED_TOTAL_STRATA;
  expectedTotalStrataSource: "tertiles_of_2023_g1_expected_total";
  strataFrozenBeforeConfirmatory: true;
  u05Equals00: true;
  labelProvenanceNote: "calibration_actual_under_league_ft_assumption_must_remain_visible";
  stochasticSeed: typeof GOALS_DIST_AUDIT_BOOTSTRAP_SEED;
};

export function goalsDistAuditProtocol(): GoalsDistAuditProtocol {
  return {
    protocolVersion: GOALS_DIST_AUDIT_PROTOCOL_VERSION,
    requiredEvidenceDigest: GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST,
    parentG0ProtocolDigest: GOALS_DIST_AUDIT_PARENT_G0_PROTOCOL_DIGEST,
    parentG1ProtocolDigest: GOALS_DIST_AUDIT_PARENT_G1_PROTOCOL_DIGEST,
    parentG1Model: GOALS_DIST_AUDIT_PARENT_G1_MODEL,
    parentG1ShrinkageK: GOALS_DIST_AUDIT_PARENT_G1_K,
    parentG3SelectedBeta: GOALS_DIST_AUDIT_PARENT_G3_SELECTED_BETA,
    developmentSeason: GOALS_DIST_AUDIT_DEV_SEASON,
    confirmatorySeason: GOALS_DIST_AUDIT_CONFIRMATORY_SEASON,
    holdoutSeason: GOALS_DIST_AUDIT_HOLDOUT_SEASON,
    holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL",
    auditOnly: true,
    noDixonColesFit: true,
    noNegativeBinomialFit: true,
    noHyperparameterSelection: true,
    bootstrapSeed: GOALS_DIST_AUDIT_BOOTSTRAP_SEED,
    bootstrapReplicates: GOALS_DIST_AUDIT_BOOTSTRAP_REPLICATES,
    sideBuckets: GOALS_DIST_AUDIT_SIDE_BUCKETS,
    totalBuckets: GOALS_DIST_AUDIT_TOTAL_BUCKETS,
    tailRegions: GOALS_DIST_AUDIT_TAIL_REGIONS,
    lowScoreCells: GOALS_DIST_AUDIT_LOW_SCORE_CELLS,
    expectedTotalStrata: GOALS_DIST_AUDIT_EXPECTED_TOTAL_STRATA,
    expectedTotalStrataSource: "tertiles_of_2023_g1_expected_total",
    strataFrozenBeforeConfirmatory: true,
    u05Equals00: true,
    labelProvenanceNote:
      "calibration_actual_under_league_ft_assumption_must_remain_visible",
    stochasticSeed: GOALS_DIST_AUDIT_BOOTSTRAP_SEED,
  };
}

export function digestGoalsDistAuditProtocol(
  protocol: GoalsDistAuditProtocol = goalsDistAuditProtocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}
