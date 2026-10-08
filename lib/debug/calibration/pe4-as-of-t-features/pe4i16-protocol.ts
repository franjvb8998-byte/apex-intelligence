/**
 * PE-4I.16 — Offline ledger materialization + as-of-T feature vector builders.
 * Research/calibration only. No fitting, weights, odds/EV, or production wiring.
 */

import { createHash } from "node:crypto";
import {
  PE4I15_PARENT_QUEUE_DIGEST,
  PE4I15_PRODUCTION_WIRING,
} from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";

export const PE4I16_PROTOCOL_VERSION =
  "pe4.offline_ledger_and_feature_vectors.v1" as const;

export const PE4I16_SCHEMA_VERSION =
  "pe4.offline_ledger_features.schema.v1" as const;

export const PE4I16_SCOPE = "research_calibration_offline_only" as const;

export const PE4I16_PRODUCTION_WIRING = false as const;

export const PE4I16_ARTIFACT_SUBDIR = "stage2i16-ledger" as const;

export const PE4I16_PARENT_QUEUE_DIGEST = PE4I15_PARENT_QUEUE_DIGEST;

export type Pe4I16Protocol = {
  protocolVersion: typeof PE4I16_PROTOCOL_VERSION;
  schemaVersion: typeof PE4I16_SCHEMA_VERSION;
  parentQueueDigest: typeof PE4I16_PARENT_QUEUE_DIGEST;
  scope: typeof PE4I16_SCOPE;
  productionWiring: typeof PE4I16_PRODUCTION_WIRING;
  pe4i15ProductionWiring: typeof PE4I15_PRODUCTION_WIRING;
  modelingForbidden: true;
  noWeights: true;
  noOddsEv: true;
  no2025Unsealing: true;
  providerCallsForbidden: true;
};

export function pe4I16Protocol(): Pe4I16Protocol {
  return {
    protocolVersion: PE4I16_PROTOCOL_VERSION,
    schemaVersion: PE4I16_SCHEMA_VERSION,
    parentQueueDigest: PE4I16_PARENT_QUEUE_DIGEST,
    scope: PE4I16_SCOPE,
    productionWiring: PE4I16_PRODUCTION_WIRING,
    pe4i15ProductionWiring: PE4I15_PRODUCTION_WIRING,
    modelingForbidden: true,
    noWeights: true,
    noOddsEv: true,
    no2025Unsealing: true,
    providerCallsForbidden: true,
  };
}

export function digestPe4I16Protocol(
  protocol: Pe4I16Protocol = pe4I16Protocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol), "utf8")
    .digest("hex");
}
