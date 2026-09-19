/**
 * Deterministic canonical serialization and SHA-256 hashing for capture batches.
 */

import { createHash } from "node:crypto";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
} from "@/lib/debug/calibration/prospective/candidate-config";
import type {
  ProspectiveCaptureBatch,
  ProspectiveEvidenceSnapshot,
} from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { ProspectivePredictionRecord } from "@/lib/debug/calibration/prospective/candidate-types";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function hashRecords(records: readonly ProspectivePredictionRecord[]): string {
  return sha256Canonical(records);
}

export function hashEvidenceManifest(
  snapshots: readonly ProspectiveEvidenceSnapshot[],
): string {
  return sha256Canonical(snapshots);
}

export function deriveBatchId(input: {
  candidateFingerprint: string;
  createdAt: string;
  fixtureIds: readonly string[];
  recordsHash: string;
}): string {
  const fixtureIds = [...input.fixtureIds].sort((left, right) => left.localeCompare(right));
  return sha256Canonical({
    candidateFingerprint: input.candidateFingerprint,
    createdAt: input.createdAt,
    fixtureIds,
    recordsHash: input.recordsHash,
  });
}

export function hashBatchMaterial(input: {
  batchId: string;
  createdAt: string;
  candidateVersion: string;
  candidateFingerprint: string;
  fixtureCount: number;
  recordCount: number;
  fixtureIds: readonly string[];
  fixtures: ProspectiveCaptureBatch["fixtures"];
  records: readonly ProspectivePredictionRecord[];
  evidenceSnapshots: readonly ProspectiveEvidenceSnapshot[];
  evidenceManifestHash: string;
  recordsHash: string;
}): string {
  return sha256Canonical(input);
}

export function assertFrozenFingerprint(value: string): void {
  if (value !== CANDIDATE_MANIFEST_FINGERPRINT) {
    throw new Error(`candidate fingerprint must remain ${CANDIDATE_MANIFEST_FINGERPRINT}`);
  }
}
