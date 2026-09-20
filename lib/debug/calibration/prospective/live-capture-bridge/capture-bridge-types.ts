/**
 * 5C.5B.2 debug-only controlled capture-bridge contracts. Synthetic transports only.
 */

import type { CaptureClock, ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { LiveExecutionMode } from "@/lib/debug/calibration/prospective/live-execution/live-execution-types";
import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const CAPTURE_BRIDGE_PHASE = "OFFLINE_CONTROLLED_CAPTURE_BRIDGE" as const;
export const CAPTURE_BRIDGE_LIVE_PROVIDER_ENABLED = false;

export type ReviewedCaptureHandoff = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  reviewedDiscoveryAtUtc: string;
  reviewedClassification: PlannerDisposition;
};

export type CaptureBridgeEvidenceUniverse = {
  target: unknown;
  fixtures: unknown[];
};

export type CaptureBridgeTransport = {
  kind: "synthetic";
  loadEvidenceUniverse(handoff: ReviewedCaptureHandoff): CaptureBridgeEvidenceUniverse;
  loadOdds?(fixtureId: string): unknown | null;
};

export type CaptureBridgeBudgetPlan = {
  priorDiscoveryCalls: number;
  plannedEvidenceCalls: number;
  plannedOddsCalls: number;
  plannedTotalCalls: number;
};

export type CaptureBridgeCallAccounting = {
  priorDiscoveryCalls: number;
  evidenceCalls: number;
  oddsCalls: number;
  outcomeCalls: number;
  totalCalls: number;
  plannedTotalCalls: number;
};

export const ZERO_BRIDGE_SPENT_CALLS = {
  evidenceCalls: 0,
  oddsCalls: 0,
  outcomeCalls: 0,
  totalCalls: 0,
} as const;

export type OddsDisposition = "ATTACHED" | "ABSENT" | "DROPPED_LATE" | "DROPPED_INVALID" | "TRANSPORT_FAILED";
export type CaptureDisposition = "CAPTURED" | "DRY_RUN" | "REJECTED" | "FAILED";

export type CaptureBridgeReport = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  reviewedDiscoveryAtUtc: string;
  reviewedClassification: PlannerDisposition | "";
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
  candidateIds: readonly string[];
  captureDisposition: CaptureDisposition;
  executionMode: LiveExecutionMode;
  dryRun: boolean;
  providerCallAccounting: CaptureBridgeCallAccounting;
  batchId: string;
  batchHash: string;
  recordsHash: string;
  evidenceManifestHash: string;
  capturedNBefore: number;
  capturedNAfter: number;
  scoredNBefore: number;
  scoredNAfter: number;
};

export type CaptureBridgeRequest = {
  handoff: ReviewedCaptureHandoff;
  transport: CaptureBridgeTransport;
  clock: CaptureClock;
  capturedAt?: string;
  mode?: LiveExecutionMode;
  persistRoot?: string;
  priorDiscoveryCalls?: number;
  plannedEvidenceCalls?: number;
  plannedOddsCalls?: number;
  authorizeLiveProvider?: boolean;
  simulateCandidateFailure?: boolean;
  simulatePersistenceFailure?: boolean;
  simulateEvidenceFailure?: boolean;
};

export type CaptureBridgeResult = {
  phase: typeof CAPTURE_BRIDGE_PHASE;
  report: CaptureBridgeReport;
  dryRun: boolean;
  batch: ProspectiveCaptureBatch | null;
};

export class CaptureBridgeRejectedError extends Error {
  readonly report: CaptureBridgeReport;
  constructor(message: string, report: CaptureBridgeReport) {
    super(message);
    this.name = "CaptureBridgeRejectedError";
    this.report = report;
  }
}

export function emptyBridgeReport(partial: Partial<CaptureBridgeReport> = {}): CaptureBridgeReport {
  return {
    fixtureId: "",
    competitionId: "",
    season: "",
    kickoffUtc: "",
    reviewedDiscoveryAtUtc: "",
    reviewedClassification: "",
    executionStartedAtUtc: "",
    minutesToKickoff: null,
    finalClassification: "NOT_CLASSIFIED",
    identityVerified: false,
    evidenceFixtureCount: 0,
    evidenceCutoff: "",
    sameKickoffExcludedCount: 0,
    targetExcluded: false,
    oddsDisposition: "ABSENT",
    fiveArmCount: 0,
    candidateIds: [],
    captureDisposition: "REJECTED",
    executionMode: "DRY_RUN",
    dryRun: true,
    providerCallAccounting: {
      priorDiscoveryCalls: 1,
      evidenceCalls: 0,
      oddsCalls: 0,
      outcomeCalls: 0,
      totalCalls: 0,
      plannedTotalCalls: 2,
    },
    batchId: "",
    batchHash: "",
    recordsHash: "",
    evidenceManifestHash: "",
    capturedNBefore: 0,
    capturedNAfter: 0,
    scoredNBefore: 0,
    scoredNAfter: 0,
    ...partial,
  };
}
