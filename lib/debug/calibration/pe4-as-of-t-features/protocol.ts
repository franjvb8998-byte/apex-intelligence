/**
 * PE-4I.15 — As-of-T historical feature construction planning protocol.
 * Research/calibration only. No fitting, weights, odds/EV, or production wiring.
 */

import { createHash } from "node:crypto";
import { PE4I5_FROZEN_STAGE2_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";

export const PE4I15_PROTOCOL_VERSION =
  "pe4.as_of_t_feature_construction_plan.v1" as const;

export const PE4I15_SCHEMA_VERSION =
  "pe4.as_of_t_feature_plan.schema.v1" as const;

export const PE4I15_LEDGER_VERSION =
  "pe4.as_of_t_historical_ledger.v1" as const;

export const PE4I15_PROVENANCE_VERSION =
  "pe4.as_of_t_feature_provenance.v1" as const;

/** Frozen acquisition queue digest from PE-4I.5 / PE-4I.14 (documented offline). */
export const PE4I15_PARENT_QUEUE_DIGEST = PE4I5_FROZEN_STAGE2_QUEUE_DIGEST;

export const PE4I15_SCOPE = "research_calibration_offline_only" as const;

export const PE4I15_PRODUCTION_WIRING = false as const;

export const PE4I15_MODELING_FORBIDDEN = true as const;

export type Pe4I15Protocol = {
  protocolVersion: typeof PE4I15_PROTOCOL_VERSION;
  schemaVersion: typeof PE4I15_SCHEMA_VERSION;
  ledgerVersion: typeof PE4I15_LEDGER_VERSION;
  provenanceVersion: typeof PE4I15_PROVENANCE_VERSION;
  parentQueueDigest: typeof PE4I15_PARENT_QUEUE_DIGEST;
  scope: typeof PE4I15_SCOPE;
  productionWiring: typeof PE4I15_PRODUCTION_WIRING;
  modelingForbidden: typeof PE4I15_MODELING_FORBIDDEN;
  noWeights: true;
  noOddsEv: true;
  no2025Unsealing: true;
};

export function pe4I15Protocol(): Pe4I15Protocol {
  return {
    protocolVersion: PE4I15_PROTOCOL_VERSION,
    schemaVersion: PE4I15_SCHEMA_VERSION,
    ledgerVersion: PE4I15_LEDGER_VERSION,
    provenanceVersion: PE4I15_PROVENANCE_VERSION,
    parentQueueDigest: PE4I15_PARENT_QUEUE_DIGEST,
    scope: PE4I15_SCOPE,
    productionWiring: PE4I15_PRODUCTION_WIRING,
    modelingForbidden: PE4I15_MODELING_FORBIDDEN,
    noWeights: true,
    noOddsEv: true,
    no2025Unsealing: true,
  };
}

export function digestPe4I15Protocol(
  protocol: Pe4I15Protocol = pe4I15Protocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol), "utf8")
    .digest("hex");
}
