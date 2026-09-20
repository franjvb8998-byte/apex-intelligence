/**
 * Safe capture-bridge report. No secrets, ranking, or betting fields.
 */

import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import type { LiveExecutionMode } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";
import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import type {
  CaptureBridgeCallAccounting,
  CaptureBridgeReport,
  CaptureDisposition,
  OddsDisposition,
} from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";
import { emptyBridgeReport } from "@/lib/debug/calibration/prospective/live-capture-bridge/capture-bridge-types";

export { emptyBridgeReport };

export function buildCaptureBridgeReport(input: {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  reviewedDiscoveryAtUtc: string;
  reviewedClassification: PlannerDisposition;
  executionStartedAtUtc: string;
  minutesToKickoff: number | null;
  finalClassification: PlannerDisposition | "NOT_CLASSIFIED";
  identityVerified: boolean;
  evidenceFixtureCount: number;
  evidenceCutoff: string;
  sameKickoffExcludedCount: number;
  targetExcluded: boolean;
  oddsDisposition: OddsDisposition;
  fiveArmCount: number;
  includeCandidateIds?: boolean;
  captureDisposition: CaptureDisposition;
  executionMode: LiveExecutionMode;
  dryRun: boolean;
  accounting: CaptureBridgeCallAccounting;
  batchId?: string;
  batchHash?: string;
  recordsHash?: string;
  evidenceManifestHash?: string;
  capturedNBefore: number;
  capturedNAfter: number;
  scoredNBefore: number;
  scoredNAfter: number;
}): CaptureBridgeReport {
  return emptyBridgeReport({
    fixtureId: input.fixtureId,
    competitionId: input.competitionId,
    season: input.season,
    kickoffUtc: input.kickoffUtc,
    reviewedDiscoveryAtUtc: input.reviewedDiscoveryAtUtc,
    reviewedClassification: input.reviewedClassification,
    executionStartedAtUtc: input.executionStartedAtUtc,
    minutesToKickoff: input.minutesToKickoff,
    finalClassification: input.finalClassification,
    identityVerified: input.identityVerified,
    evidenceFixtureCount: input.evidenceFixtureCount,
    evidenceCutoff: input.evidenceCutoff,
    sameKickoffExcludedCount: input.sameKickoffExcludedCount,
    targetExcluded: input.targetExcluded,
    oddsDisposition: input.oddsDisposition,
    fiveArmCount: input.fiveArmCount,
    candidateIds: input.includeCandidateIds ? [...PROSPECTIVE_CANDIDATE_IDS] : [],
    captureDisposition: input.captureDisposition,
    executionMode: input.executionMode,
    dryRun: input.dryRun,
    providerCallAccounting: input.accounting,
    batchId: input.batchId ?? "",
    batchHash: input.batchHash ?? "",
    recordsHash: input.recordsHash ?? "",
    evidenceManifestHash: input.evidenceManifestHash ?? "",
    capturedNBefore: input.capturedNBefore,
    capturedNAfter: input.capturedNAfter,
    scoredNBefore: input.scoredNBefore,
    scoredNAfter: input.scoredNAfter,
  });
}
