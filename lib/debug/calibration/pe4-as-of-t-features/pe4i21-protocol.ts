/** PE-4I.21 — offline feature eligibility contract. Research only. */

import { createHash } from "node:crypto";

import { PE4I15_PARENT_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import {
  PE4I16_ARTIFACT_SUBDIR,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import {
  PE4I17_ARTIFACT_SUBDIR,
  PE4I17_EMIT_WINDOW_IDS,
  PE4I17_VENUE_MODES,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import { PE4I18_ARTIFACT_SUBDIR } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";
import {
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
  PE4I20_DATASET_ARTIFACT_SUBDIR,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";

export const PE4I21_PROTOCOL_VERSION =
  "pe4.offline_feature_eligibility_contract.v1" as const;
export const PE4I21_SCHEMA_VERSION =
  "pe4.offline_feature_eligibility_contract.schema.v1" as const;
export const PE4I21_PRODUCTION_WIRING = false as const;
export const PE4I21_ARTIFACT_SUBDIR =
  "stage2i21-feature-contract-v1" as const;

/** Preserved research directories. The writer must not create or modify them. */
export const PE4I21_FORBIDDEN_ARTIFACT_SUBDIRS = [
  PE4I16_ARTIFACT_SUBDIR,
  PE4I17_ARTIFACT_SUBDIR,
  PE4I18_ARTIFACT_SUBDIR,
  "stage2i19-strength-catalogue",
  PE4I20_DATASET_ARTIFACT_SUBDIR,
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
] as const;

export const PE4I21_PINNED_DIGESTS = {
  parentQueueDigest: PE4I15_PARENT_QUEUE_DIGEST,
  ledgerDigest:
    "713bc19be6411229a3c5aea1f846a55ccb1fb5121fd419c00e9c9a42fd21b962",
  catalogueDigest:
    "c1bb17e049ee6a14cbbed110bb136370a363cfb5286de1d6df6561a339fce8ed",
  basePathADigest:
    "3cb8788d77cc226d223a5b91e6bd26b09d9377a4ef71302ea18da79fe2bf4590",
  basePathBDigest:
    "f3ca72c6c6ab29842d97d6ddac2d5f810eefa6814cfb8248e307e8365e231154",
  strengthPathADigest:
    "116fb078020056a4c5ee888c466b2262d0148dc7edf2da28f1e8c10b57781dfe",
  pathBDigest:
    "f3ca72c6c6ab29842d97d6ddac2d5f810eefa6814cfb8248e307e8365e231154",
  auditDigest:
    "376ab14acd498eb6601c960fa8ca7edcf1e2086f67e184887e260cc3a39fd2b9",
} as const;

export const PE4I21_PINNED_POPULATION = {
  targetCount: 969,
  primaryTargets: 786,
  separateAuditTargets: 183,
  rowsPerPath: 40_698,
  numericCandidateCount: 117,
  constantZeroCount: 18,
} as const;

export const PE4I21_ROWS_PER_TARGET =
  2 * PE4I17_EMIT_WINDOW_IDS.length * PE4I17_VENUE_MODES.length;

export const PE4I21_PLANNED_ARTIFACTS = [
  "protocol.json",
  "eligibility-manifest.json",
  "alias-groups.json",
  "stratum-manifest.json",
  "design-matrix-rules.json",
  "reproducibility-audit.json",
  "contract-manifest.json",
] as const;

export function pe4I21Protocol() {
  return {
    protocolVersion: PE4I21_PROTOCOL_VERSION,
    schemaVersion: PE4I21_SCHEMA_VERSION,
    parentQueueDigest: PE4I21_PINNED_DIGESTS.parentQueueDigest,
    scope: "research_calibration_offline_only" as const,
    productionWiring: PE4I21_PRODUCTION_WIRING,
    providerCallsForbidden: true as const,
    labelsForbidden: true as const,
    modelingForbidden: true as const,
    noWeights: true as const,
    noOddsEv: true as const,
    no2025Unsealing: true as const,
    datasetMutationForbidden: true as const,
    numericCandidateCount: PE4I21_PINNED_POPULATION.numericCandidateCount,
    constantZeroCount: PE4I21_PINNED_POPULATION.constantZeroCount,
    primaryTargets: PE4I21_PINNED_POPULATION.primaryTargets,
    separateAuditTargets: PE4I21_PINNED_POPULATION.separateAuditTargets,
    rowsPerTarget: PE4I21_ROWS_PER_TARGET,
    windowIds: PE4I17_EMIT_WINDOW_IDS,
    venueModes: PE4I17_VENUE_MODES,
    pinnedDigests: PE4I21_PINNED_DIGESTS,
  };
}

export function digestPe4I21Protocol(): string {
  return createHash("sha256")
    .update(JSON.stringify(pe4I21Protocol()), "utf8")
    .digest("hex");
}
