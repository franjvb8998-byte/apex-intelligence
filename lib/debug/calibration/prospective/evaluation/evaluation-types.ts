/**
 * 5C.7 debug-only prospective evaluation contracts. Offline synthetic scored artifacts only.
 */

import type { ProspectiveCandidateId } from "@/lib/debug/calibration/prospective/candidate-types";
import type { ObservedClass } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";

export const PROSPECTIVE_EVALUATION_VERSION = "apex.calibration.prospective.evaluation.5c7.v1";
export const PROSPECTIVE_EVALUATION_PHASE = "OFFLINE_EVALUATION_INFRASTRUCTURE" as const;

export const EVALUATION_MODES = ["STRICT", "AUDITED_COLLECTION"] as const;
export type EvaluationMode = (typeof EVALUATION_MODES)[number];
export const EVALUATION_DEFAULT_MODE: EvaluationMode = "STRICT";

export const EVALUATION_CHECKPOINT_STATES = [
  "BELOW_FIRST_CHECKPOINT",
  "CHECKPOINT_100",
  "CHECKPOINT_250",
  "CHECKPOINT_500",
  "ABOVE_500",
] as const;
export type EvaluationCheckpointState = (typeof EVALUATION_CHECKPOINT_STATES)[number];

export const EVALUATION_REJECTION_REASONS = [
  "DUPLICATE_FIXTURE",
  "DUPLICATE_ARM",
  "MISSING_ARM",
  "UNKNOWN_ARM",
  "WRONG_FINGERPRINT",
  "TAMPERED_ARTIFACT",
  "INVALID_PROBABILITY",
  "INCONSISTENT_OBSERVED_CLASS",
  "INVALID_FIXTURE_IDENTITY",
  "INCOMPLETE_SCORE_ROWS",
  "NON_FINITE_METRIC",
  "SCORE_RESULT_MISMATCH",
] as const;
export type EvaluationRejectionReason = (typeof EVALUATION_REJECTION_REASONS)[number];

export const ZERO_EVALUATION_PROVIDER_CALLS = {
  discoveryCalls: 0,
  evidenceCalls: 0,
  oddsCalls: 0,
  outcomeCalls: 0,
  totalCalls: 0,
} as const;

export type EvaluationRejection = {
  fixtureId: string;
  reason: EvaluationRejectionReason;
};

export type CandidateAggregate = {
  candidateId: ProspectiveCandidateId;
  evaluatedN: number;
  meanLogLoss: number;
  meanBrier: number;
  accuracy: number;
  meanConfidence: number;
  numberCorrect: number;
  numberEvaluated: number;
};

export type ClasswiseAggregate = {
  candidateId: ProspectiveCandidateId;
  observedClass: ObservedClass;
  observationCount: number;
  observedFrequency: number;
  meanPredictedProbability: number;
  absoluteCalibrationGap: number;
};

export type EceBinReport = {
  index: number;
  lower: number;
  upper: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
  absoluteGap: number;
};

export type CandidateEceReport = {
  candidateId: ProspectiveCandidateId;
  ece: number;
  bins: readonly EceBinReport[];
};

export type CandidateFixtureObservation = {
  fixtureId: string;
  candidateId: ProspectiveCandidateId;
  logLoss: number;
  brier: number;
  isCorrect: boolean;
  confidence: number;
  observedClass: ObservedClass;
};

export type ProspectiveEvaluationReport = {
  evaluationVersion: typeof PROSPECTIVE_EVALUATION_VERSION;
  phase: typeof PROSPECTIVE_EVALUATION_PHASE;
  candidateFingerprint: string;
  protocolFingerprint: string;
  evaluatedN: number;
  fixtureCount: number;
  candidateRowCount: number;
  checkpointState: EvaluationCheckpointState;
  formalReviewAvailable: boolean;
  firstScoredAt: string;
  lastScoredAt: string;
  firstKickoffUtc: string;
  lastKickoffUtc: string;
  observedHomeCount: number;
  observedDrawCount: number;
  observedAwayCount: number;
  integrityStatus: "PASS" | "EMPTY" | "FAIL";
  rejectionPolicy: EvaluationMode;
  rejectedCount: number;
  rejections: readonly EvaluationRejection[];
  candidateAggregates: readonly CandidateAggregate[];
  classwiseCalibration: readonly ClasswiseAggregate[];
  eceReports: readonly CandidateEceReport[];
  evaluationHash: string;
  providerCallAccounting: typeof ZERO_EVALUATION_PROVIDER_CALLS;
};

export type EvaluateProspectiveRequest = {
  artifacts: readonly ProspectiveScoredArtifact[];
  mode?: EvaluationMode;
};

export type EvaluateProspectiveResult = {
  phase: typeof PROSPECTIVE_EVALUATION_PHASE;
  report: ProspectiveEvaluationReport;
  observations: readonly CandidateFixtureObservation[];
};

export class EvaluationRejectedError extends Error {
  readonly report: ProspectiveEvaluationReport;
  constructor(message: string, report: ProspectiveEvaluationReport) {
    super(message);
    this.name = "EvaluationRejectedError";
    this.report = report;
  }
}

export function emptyEvaluationReport(
  partial: Partial<ProspectiveEvaluationReport> = {},
): ProspectiveEvaluationReport {
  return {
    evaluationVersion: PROSPECTIVE_EVALUATION_VERSION,
    phase: PROSPECTIVE_EVALUATION_PHASE,
    candidateFingerprint: "",
    protocolFingerprint: "",
    evaluatedN: 0,
    fixtureCount: 0,
    candidateRowCount: 0,
    checkpointState: "BELOW_FIRST_CHECKPOINT",
    formalReviewAvailable: false,
    firstScoredAt: "",
    lastScoredAt: "",
    firstKickoffUtc: "",
    lastKickoffUtc: "",
    observedHomeCount: 0,
    observedDrawCount: 0,
    observedAwayCount: 0,
    integrityStatus: "EMPTY",
    rejectionPolicy: EVALUATION_DEFAULT_MODE,
    rejectedCount: 0,
    rejections: [],
    candidateAggregates: [],
    classwiseCalibration: [],
    eceReports: [],
    evaluationHash: "",
    providerCallAccounting: { ...ZERO_EVALUATION_PROVIDER_CALLS },
    ...partial,
  };
}
