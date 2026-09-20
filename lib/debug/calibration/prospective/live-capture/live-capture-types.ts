/**
 * 5C.5A live-capture orchestration contracts. Offline composition only. No provider I/O.
 */

import type {
  CaptureClock,
  CaptureRunResult,
  PriorCaptureIndex,
  ProspectiveCaptureBatch,
  ProspectiveFixtureInput,
  ProspectiveOddsSnapshot,
  TeamEvidenceCounts,
} from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { PlannerClassification, PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const LIVE_CAPTURE_PHASE = "OFFLINE_ORCHESTRATION_ONLY" as const;
export const ACCEPTED_PROSPECTIVE_SEASON = "2026";
export const EXTRA_LIVE_CAPTURE_LEAKAGE_KEYS = [
  "homeGoals",
  "awayGoals",
  "halftime",
  "fulltime",
  "extratime",
  "penalty",
  "penalties",
  "goals",
  "scores",
] as const;

export type LiveCaptureTeamEvidence = TeamEvidenceCounts;

export type LiveCaptureFixtureInput = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  evidenceAsOf: string;
  preMatchEvidence: {
    home: LiveCaptureTeamEvidence;
    away: LiveCaptureTeamEvidence;
  };
  oddsSnapshot?: ProspectiveOddsSnapshot | null;
};

export type LiveCaptureBatchFn = (
  fixtures: readonly ProspectiveFixtureInput[],
  options: {
    clock: CaptureClock;
    capturedAt?: string;
    createdAt?: string;
    dryRun?: boolean;
    persistRoot?: string;
    priorIndex?: PriorCaptureIndex;
    window?: { earliestCaptureMinutesBeforeKickoff: number; latestCaptureMinutesBeforeKickoff: number } | null;
    simulateFailureAfterTempWrite?: boolean;
  },
) => CaptureRunResult;

export type LiveCaptureRequest = {
  fixtures: readonly LiveCaptureFixtureInput[];
  clock: CaptureClock;
  capturedAt?: string;
  createdAt?: string;
  dryRun?: boolean;
  persistRoot?: string;
  priorIndex?: PriorCaptureIndex;
  simulateFailureAfterTempWrite?: boolean;
  simulateCandidateFailure?: boolean;
  captureImpl?: LiveCaptureBatchFn;
  candidateFingerprint?: string;
};

export type LiveCaptureReadinessRow = {
  fixtureId: string;
  kickoff: string;
  minutesToKickoff: number | null;
  protocolClassification: PlannerDisposition;
  captureEligible: boolean;
  evidenceReady: boolean;
  oddsPresent: boolean;
  fiveArmReady: boolean;
  duplicate: boolean;
  persistenceReady: boolean;
  reason: string;
};

export type LiveCaptureResult = {
  phase: typeof LIVE_CAPTURE_PHASE;
  authorizedLiveCapture: false;
  dryRun: boolean;
  prospectiveN: 0;
  acceptedFixtureCount: number;
  recordCount: number;
  classifications: PlannerClassification[];
  readiness: LiveCaptureReadinessRow[];
  capture: CaptureRunResult | null;
  batch: ProspectiveCaptureBatch | null;
};

export class LiveCaptureRejectedError extends Error {
  readonly classifications: PlannerClassification[];
  constructor(message: string, classifications: PlannerClassification[] = []) {
    super(message);
    this.name = "LiveCaptureRejectedError";
    this.classifications = classifications;
  }
}
