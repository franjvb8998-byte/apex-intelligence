/**
 * Deterministic SHA-256 of the frozen 5C.3 operational protocol.
 * Distinct from the 5C.1 candidate fingerprint.
 */

import { createHash } from "node:crypto";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { canonicalJson } from "@/lib/debug/calibration/prospective/capture/capture-manifest";
import { LIVE_PROTOCOL_CONFIG } from "@/lib/debug/calibration/prospective/protocol/protocol-config";

export function protocolCanonicalJson(value: unknown = LIVE_PROTOCOL_CONFIG): string {
  return canonicalJson(value);
}

export function computeProtocolFingerprint(value: unknown = LIVE_PROTOCOL_CONFIG): string {
  return createHash("sha256").update(protocolCanonicalJson(value), "utf8").digest("hex");
}

export const LIVE_PROTOCOL_FINGERPRINT = computeProtocolFingerprint();

export function assertProtocolFingerprintsDistinct(): void {
  if (LIVE_PROTOCOL_FINGERPRINT === CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new Error("protocol fingerprint must remain distinct from the candidate fingerprint");
  }
}
