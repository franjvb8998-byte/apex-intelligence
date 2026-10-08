/**
 * PE-4I.15 — Provenance contract + digest helper for feature vectors.
 * Planning-phase: digests declared inputs; no fitted weights.
 */

import { createHash } from "node:crypto";
import { PE4I15_PROVENANCE_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import type { Pe4I15WindowId } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import type { Pe4I15HoldoutClassification } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import type { Pe4I15FeatureFamilyId } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";

export type Pe4I15FeatureAvailabilitySummary = {
  familyId: Pe4I15FeatureFamilyId;
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  observationCount: number;
  missingCount: number;
};

export type Pe4I15FeatureVectorProvenance = {
  provenanceVersion: typeof PE4I15_PROVENANCE_VERSION;
  targetFixtureId: string;
  targetKickoffUtc: string;
  evidenceCutoffUtc: string;
  historyFixtureIds: readonly string[];
  windowId: Pe4I15WindowId;
  observationCount: number;
  competitionCounts: Readonly<Record<string, number>>;
  availability: readonly Pe4I15FeatureAvailabilitySummary[];
  holdoutClassification: Pe4I15HoldoutClassification;
  protocolVersion: string;
  /** sha256 hex of canonical payload (set by digest helper). */
  digest: string;
};

function canonicalCompetitionCounts(
  counts: Readonly<Record<string, number>>,
): string {
  return Object.keys(counts)
    .sort()
    .map((k) => `${k}:${counts[k]}`)
    .join(",");
}

function canonicalAvailability(
  rows: readonly Pe4I15FeatureAvailabilitySummary[],
): string {
  return [...rows]
    .map((r) =>
      [
        r.familyId,
        r.status,
        String(r.observationCount),
        String(r.missingCount),
      ].join("~"),
    )
    .sort()
    .join("|");
}

export function buildFeatureVectorProvenancePayload(input: {
  targetFixtureId: string;
  targetKickoffUtc: string;
  evidenceCutoffUtc: string;
  historyFixtureIds: readonly string[];
  windowId: Pe4I15WindowId;
  observationCount: number;
  competitionCounts: Readonly<Record<string, number>>;
  availability: readonly Pe4I15FeatureAvailabilitySummary[];
  holdoutClassification: Pe4I15HoldoutClassification;
  protocolVersion: string;
}): Omit<Pe4I15FeatureVectorProvenance, "digest"> & { digestMaterial: string } {
  const historySorted = [...input.historyFixtureIds].sort();
  const digestMaterial = [
    PE4I15_PROVENANCE_VERSION,
    input.protocolVersion,
    input.targetFixtureId,
    input.targetKickoffUtc,
    input.evidenceCutoffUtc,
    historySorted.join(","),
    input.windowId,
    String(input.observationCount),
    canonicalCompetitionCounts(input.competitionCounts),
    canonicalAvailability(input.availability),
    input.holdoutClassification,
  ].join("\n");

  return {
    provenanceVersion: PE4I15_PROVENANCE_VERSION,
    targetFixtureId: input.targetFixtureId,
    targetKickoffUtc: input.targetKickoffUtc,
    evidenceCutoffUtc: input.evidenceCutoffUtc,
    historyFixtureIds: historySorted,
    windowId: input.windowId,
    observationCount: input.observationCount,
    competitionCounts: { ...input.competitionCounts },
    availability: [...input.availability],
    holdoutClassification: input.holdoutClassification,
    protocolVersion: input.protocolVersion,
    digestMaterial,
  };
}

export function digestFeatureVectorProvenance(
  input: Parameters<typeof buildFeatureVectorProvenancePayload>[0],
): Pe4I15FeatureVectorProvenance {
  const built = buildFeatureVectorProvenancePayload(input);
  const digest = createHash("sha256")
    .update(built.digestMaterial, "utf8")
    .digest("hex");
  return {
    provenanceVersion: built.provenanceVersion,
    targetFixtureId: built.targetFixtureId,
    targetKickoffUtc: built.targetKickoffUtc,
    evidenceCutoffUtc: built.evidenceCutoffUtc,
    historyFixtureIds: built.historyFixtureIds,
    windowId: built.windowId,
    observationCount: built.observationCount,
    competitionCounts: built.competitionCounts,
    availability: built.availability,
    holdoutClassification: built.holdoutClassification,
    protocolVersion: built.protocolVersion,
    digest,
  };
}
