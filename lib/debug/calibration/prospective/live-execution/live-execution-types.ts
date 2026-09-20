/**
 * 5C.5B.1 debug-only live-execution contracts. Offline synthetic payloads only.
 */

import type { CaptureClock, PriorCaptureIndex } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { LiveCaptureResult } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";
import type { PlannerClassification, PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const LIVE_EXECUTION_PHASE = "OFFLINE_LIVE_EXECUTION_ADAPTER" as const;

export const LIVE_EXECUTION_MODE_DRY_RUN = "DRY_RUN" as const;
export const LIVE_EXECUTION_MODE_PERSIST_PENDING = "PERSIST_PENDING" as const;
export const LIVE_EXECUTION_DEFAULT_MODE = LIVE_EXECUTION_MODE_DRY_RUN;

export const LIVE_EXECUTION_MODES = [
  LIVE_EXECUTION_MODE_DRY_RUN,
  LIVE_EXECUTION_MODE_PERSIST_PENDING,
] as const;

export type LiveExecutionMode = (typeof LIVE_EXECUTION_MODES)[number];

export type LiveExecutionCallAccounting = {
  discoveryCalls: number;
  evidenceCalls: number;
  oddsCalls: number;
  totalCalls: number;
};

export const ZERO_PROVIDER_CALLS: LiveExecutionCallAccounting = {
  discoveryCalls: 0,
  evidenceCalls: 0,
  oddsCalls: 0,
  totalCalls: 0,
};

export type ProjectedTargetFixture = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
};

export type ProjectedPriorFixture = ProjectedTargetFixture & {
  homeGoals: number | null;
  awayGoals: number | null;
};

export type LiveExecutionEvidenceProvenance = {
  targetFixtureId: string;
  targetKickoff: string;
  evidenceAsOf: string;
  competitionId: string;
  season: string;
  homeTeamId: string;
  awayTeamId: string;
  priorsInspected: number;
  priorsAccepted: number;
  homeEvidenceMatchCount: number;
  awayEvidenceMatchCount: number;
  latestAcceptedKickoff: string | null;
};

export type LiveExecutionHashVerification = "PASS" | "FAIL" | "NOT_RUN";
export type LiveExecutionPersistenceStatus = "NOT_WRITTEN" | "PERSISTED" | "FAILED";

export type LiveExecutionReport = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  capturedAtUtc: string;
  minutesToKickoff: number | null;
  status: string;
  protocolClassification: PlannerDisposition | "NOT_CLASSIFIED";
  evidencePresent: boolean;
  homeEvidenceCount: number;
  awayEvidenceCount: number;
  latestEvidenceKickoff: string | null;
  oddsPresent: boolean;
  executionMode: LiveExecutionMode;
  candidateFingerprint: string;
  candidateIds: readonly string[];
  recordCount: number;
  hashVerification: LiveExecutionHashVerification;
  persistenceStatus: LiveExecutionPersistenceStatus;
  prospectiveNBefore: number;
  prospectiveNAfter: number;
  providerCallAccounting: LiveExecutionCallAccounting;
};

export type LiveExecutionUniversePayload = {
  target: unknown;
  fixtures: unknown[];
};

export type LiveExecutionTransport = {
  kind: "synthetic" | "live";
  loadUniverse(): LiveExecutionUniversePayload;
  loadOdds?(fixtureId: string): unknown | null;
};

export type LiveExecutionRequest = {
  clock: CaptureClock;
  capturedAt?: string;
  createdAt?: string;
  mode?: LiveExecutionMode;
  persistRoot?: string;
  priorIndex?: PriorCaptureIndex;
  transport?: LiveExecutionTransport;
  target?: unknown;
  fixtures?: unknown[];
  odds?: unknown | null;
  simulateEvidenceFailure?: boolean;
  simulateCandidateFailure?: boolean;
  simulatePersistenceFailure?: boolean;
  simulateIntegrityFailure?: boolean;
};

export type LiveExecutionResult = {
  phase: typeof LIVE_EXECUTION_PHASE;
  mode: LiveExecutionMode;
  dryRun: boolean;
  report: LiveExecutionReport;
  capture: LiveCaptureResult | null;
  classification: PlannerClassification | null;
  provenance: LiveExecutionEvidenceProvenance | null;
  projectedTarget: ProjectedTargetFixture;
  callAccounting: LiveExecutionCallAccounting;
};

export class LiveExecutionRejectedError extends Error {
  readonly protocolClassification: PlannerDisposition | "NOT_CLASSIFIED";
  readonly report: LiveExecutionReport;
  readonly classifications: PlannerClassification[];

  constructor(
    message: string,
    report: LiveExecutionReport,
    classifications: PlannerClassification[] = [],
  ) {
    super(message);
    this.name = "LiveExecutionRejectedError";
    this.report = report;
    this.classifications = classifications;
    this.protocolClassification = report.protocolClassification;
  }
}
