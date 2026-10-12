/** PE-4I.20 — offline strength-integrated dataset + renewed structural audit. */

import { createHash } from "node:crypto";

import { PE4I15_PARENT_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";

export const PE4I20_PROTOCOL_VERSION =
  "pe4.offline_strength_integrated_dev_dataset.v1" as const;
export const PE4I20_AUDIT_PROTOCOL_VERSION =
  "pe4.offline_strength_structure_audit.v1" as const;
export const PE4I20_SCHEMA_VERSION =
  "pe4.offline_strength_integrated_dev_dataset.schema.v1" as const;
export const PE4I20_PRODUCTION_WIRING = false as const;
export const PE4I20_DATASET_ARTIFACT_SUBDIR =
  "stage2i20-strength-integrated-dev-dataset-v1" as const;
export const PE4I20_AUDIT_ARTIFACT_SUBDIR =
  "stage2i20-strength-structure-audit-v1" as const;

export function pe4I20Protocol() {
  return {
    protocolVersion: PE4I20_PROTOCOL_VERSION,
    auditProtocolVersion: PE4I20_AUDIT_PROTOCOL_VERSION,
    schemaVersion: PE4I20_SCHEMA_VERSION,
    parentQueueDigest: PE4I15_PARENT_QUEUE_DIGEST,
    scope: "research_calibration_offline_only" as const,
    productionWiring: PE4I20_PRODUCTION_WIRING,
    providerCallsForbidden: true as const,
    labelsForbiddenFromStructuralAudit: true as const,
    modelingForbidden: true as const,
    noWeights: true as const,
    noOddsEv: true as const,
    no2025Unsealing: true as const,
    incompleteStrengthBehavior: "UNAVAILABLE_NULL_NO_PARTIAL_MEAN" as const,
  };
}

export function digestPe4I20Protocol(): string {
  return createHash("sha256")
    .update(JSON.stringify(pe4I20Protocol()), "utf8")
    .digest("hex");
}
