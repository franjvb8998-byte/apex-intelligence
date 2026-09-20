/**
 * 5C.6 debug-only prospective scoring contracts. Offline synthetic outcomes only.
 */

import type { ProspectiveCandidateId } from "@/lib/debug/calibration/prospective/candidate-types";
import type { ProspectiveCaptureBatch } from "@/lib/debug/calibration/prospective/capture/capture-types";
import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";

export const PROSPECTIVE_SCORING_VERSION = "apex.calibration.prospective.scoring.5c6.v1";
export const PROSPECTIVE_SCORING_PHASE = "OFFLINE_SCORING_INFRASTRUCTURE" as const;

export const ALLOWED_FINAL_STATUSES = ["FT", "AET", "PEN"] as const;
export type AllowedFinalStatus = (typeof ALLOWED_FINAL_STATUSES)[number];

export const OBSERVED_CLASSES = ["HOME", "DRAW", "AWAY"] as const;
export type ObservedClass = (typeof OBSERVED_CLASSES)[number];

/**
 * PEN/AET policy (reused from frozen reconstruct.countableGoals):
 * supplied homeGoals/awayGoals are the 90-minute + extra-time score.
 * A PEN shootout is never used to choose HOME/DRAW/AWAY.
 */
export const AET_PEN_GOAL_POLICY =
  "90_PLUS_ET_GOALS_NOT_SHOOTOUT" as const;

export type ScoringProviderAccounting = {
  discoveryCalls: number;
  evidenceCalls: number;
  oddsCalls: number;
  outcomeCalls: number;
  totalCalls: number;
};

export const ZERO_SCORING_PROVIDER_CALLS: ScoringProviderAccounting = {
  discoveryCalls: 0,
  evidenceCalls: 0,
  oddsCalls: 0,
  outcomeCalls: 0,
  totalCalls: 0,
};

export type ProspectiveFinalOutcome = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  finalStatus: AllowedFinalStatus;
  homeGoals: number;
  awayGoals: number;
  outcomeCapturedAt: string;
  provenance: "synthetic";
};

export type CandidateScoreRow = {
  candidateId: ProspectiveCandidateId;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  predictedClass: ObservedClass;
  confidence: number;
  observedClass: ObservedClass;
  probabilityAssignedToObservedClass: number;
  isCorrect: boolean;
  logLossContribution: number;
  brierContribution: number;
  brierHomeComponent: number;
  brierDrawComponent: number;
  brierAwayComponent: number;
  observedHome: 0 | 1;
  observedDraw: 0 | 1;
  observedAway: 0 | 1;
};

export type ProspectiveScoredArtifact = {
  scoringVersion: typeof PROSPECTIVE_SCORING_VERSION;
  scoredAt: string;
  sourceBatchId: string;
  sourceBatchHash: string;
  sourceRecordsHash: string;
  sourceEvidenceManifestHash: string;
  candidateFingerprint: string;
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  finalStatus: AllowedFinalStatus;
  homeGoals: number;
  awayGoals: number;
  observedClass: ObservedClass;
  outcomeCapturedAt: string;
  candidateScores: CandidateScoreRow[];
  outcomeHash: string;
  candidateScoresHash: string;
  scoredArtifactHash: string;
};

export type ScoringPersistenceDisposition =
  | "NOT_WRITTEN"
  | "PERSISTED"
  | "ALREADY_SCORED"
  | "FAILED";

export type ScoringReport = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  sourceBatchId: string;
  sourceIntegrityVerified: boolean;
  candidateFingerprintVerified: boolean;
  finalStatus: AllowedFinalStatus | "";
  homeGoals: number | null;
  awayGoals: number | null;
  observedClass: ObservedClass | "";
  outcomeCapturedAt: string;
  scoredAt: string;
  candidateCount: number;
  candidateIds: readonly string[];
  probabilitiesUnchanged: boolean;
  candidateLogLoss: Record<string, number>;
  candidateBrier: Record<string, number>;
  candidateIsCorrect: Record<string, boolean>;
  outcomeHash: string;
  candidateScoresHash: string;
  scoredArtifactHash: string;
  capturedNBefore: number;
  capturedNAfter: number;
  scoredNBefore: number;
  scoredNAfter: number;
  persistenceDisposition: ScoringPersistenceDisposition;
  providerCallAccounting: ScoringProviderAccounting;
};

export type ProspectiveOutcomeSource = {
  kind: "synthetic";
  loadOutcome(fixtureId: string): ProspectiveFinalOutcome | null;
};

export type ScoreProspectiveRequest = {
  pendingBatch: ProspectiveCaptureBatch;
  pendingPath?: string;
  outcome?: ProspectiveFinalOutcome;
  transport?: ProspectiveOutcomeSource;
  clock: CaptureClock;
  scoredAt?: string;
  persistRoot?: string;
  persist?: boolean;
  simulateScoringFailure?: boolean;
  simulatePersistenceFailure?: boolean;
};

export type ScoreProspectiveResult = {
  phase: typeof PROSPECTIVE_SCORING_PHASE;
  artifact: ProspectiveScoredArtifact | null;
  report: ScoringReport;
  pendingBytesUnchanged: boolean;
};

export class ScoringRejectedError extends Error {
  readonly report: ScoringReport;
  readonly disposition: ScoringPersistenceDisposition;

  constructor(message: string, report: ScoringReport, disposition: ScoringPersistenceDisposition = "FAILED") {
    super(message);
    this.name = "ScoringRejectedError";
    this.report = report;
    this.disposition = disposition;
  }
}

export function emptyScoringReport(partial: Partial<ScoringReport> = {}): ScoringReport {
  return {
    fixtureId: "",
    competitionId: "",
    season: "",
    kickoffUtc: "",
    sourceBatchId: "",
    sourceIntegrityVerified: false,
    candidateFingerprintVerified: false,
    finalStatus: "",
    homeGoals: null,
    awayGoals: null,
    observedClass: "",
    outcomeCapturedAt: "",
    scoredAt: "",
    candidateCount: 0,
    candidateIds: [],
    probabilitiesUnchanged: false,
    candidateLogLoss: {},
    candidateBrier: {},
    candidateIsCorrect: {},
    outcomeHash: "",
    candidateScoresHash: "",
    scoredArtifactHash: "",
    capturedNBefore: 0,
    capturedNAfter: 0,
    scoredNBefore: 0,
    scoredNAfter: 0,
    persistenceDisposition: "FAILED",
    providerCallAccounting: { ...ZERO_SCORING_PROVIDER_CALLS },
    ...partial,
  };
}
