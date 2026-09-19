/**
 * 5C.2 prospective capture contracts. Debug-only. No result scoring.
 */

import type {
  ProspectiveCandidateId,
  ProspectivePredictionRecord,
} from "@/lib/debug/calibration/prospective/candidate-types";

export const PROSPECTIVE_DATA_DIR = "data/prospective";
export const PROSPECTIVE_PENDING_DIR = "data/prospective/pending";
export const PROSPECTIVE_SCORED_DIR = "data/prospective/scored";

export const CAPTURE_WINDOW_PLACEHOLDER = {
  earliestCaptureMinutesBeforeKickoff: "UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL",
  latestCaptureMinutesBeforeKickoff: "UNASSIGNED_UNTIL_5C3_LIVE_PROTOCOL",
} as const;

export const FORBIDDEN_CAPTURE_INPUT_KEYS = [
  "finalHomeGoals",
  "finalAwayGoals",
  "winner",
  "result",
  "score",
  "actualHomeGoals",
  "actualAwayGoals",
  "actualOutcome",
  "scoredAt",
] as const;

export const FORBIDDEN_FINAL_STATUSES = ["FT", "AET", "PEN"] as const;

export type TeamEvidenceCounts = {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type PreMatchTeamEvidence = {
  home: TeamEvidenceCounts;
  away: TeamEvidenceCounts;
};

export type ProspectiveOddsSnapshot = {
  capturedAt: string;
  source: string;
  home: number;
  draw: number;
  away: number;
};

export type ProspectiveFixtureInput = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  evidenceAsOf: string;
  preMatchEvidence: PreMatchTeamEvidence;
  oddsSnapshot?: ProspectiveOddsSnapshot | null;
};

export type ProspectiveEvidenceSnapshot = {
  fixtureId: string;
  capturedAt: string;
  evidenceAsOf: string;
  home: TeamEvidenceCounts;
  away: TeamEvidenceCounts;
  source: {
    competitionId: string;
    season: string;
  };
  oddsSnapshot: ProspectiveOddsSnapshot | null;
};

export type CaptureWindowMinutes = {
  earliestCaptureMinutesBeforeKickoff: number;
  latestCaptureMinutesBeforeKickoff: number;
};

export type CaptureClock = {
  now: () => string;
};

export type CapturedFixtureHeader = {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string;
  capturedAt: string;
  evidenceAsOf: string;
  oddsPresent: boolean;
};

export type ProspectiveCaptureBatch = {
  batchId: string;
  createdAt: string;
  candidateVersion: string;
  candidateFingerprint: string;
  fixtureCount: number;
  recordCount: number;
  fixtureIds: string[];
  fixtures: CapturedFixtureHeader[];
  records: ProspectivePredictionRecord[];
  evidenceSnapshots: ProspectiveEvidenceSnapshot[];
  evidenceManifestHash: string;
  recordsHash: string;
  batchHash: string;
};

export type PriorCaptureEntry = {
  fixtureId: string;
  candidateFingerprint: string;
  batchId: string;
};

export type PriorCaptureIndex = {
  entries: PriorCaptureEntry[];
};

export type CaptureIntegritySummary = {
  timeGuards: "PASS";
  evidenceGuards: "PASS";
  duplicateGuards: "PASS";
  hashVerification: "PASS";
  pendingOutcomeVerification: "PASS";
};

export type CaptureReportFixture = {
  fixtureId: string;
  teams: string;
  kickoff: string;
  capturedAt: string;
  evidenceAsOf: string;
  oddsPresent: boolean;
  candidateIds: ProspectiveCandidateId[];
};

export type CaptureReport = {
  batchId: string;
  createdAt: string;
  candidateFingerprint: string;
  fixtureCount: number;
  recordCount: number;
  fixtures: CaptureReportFixture[];
  integrity: CaptureIntegritySummary;
};

export type CapturePersistResult = {
  path: string;
  batchId: string;
  recordsHash: string;
  evidenceManifestHash: string;
  batchHash: string;
};

export type CaptureRunResult = {
  dryRun: boolean;
  batch: ProspectiveCaptureBatch;
  report: CaptureReport;
  persisted: CapturePersistResult | null;
};

export type CaptureOptions = {
  clock: CaptureClock;
  createdAt?: string;
  capturedAt?: string;
  window?: CaptureWindowMinutes | null;
  dryRun?: boolean;
  persistRoot?: string;
  priorIndex?: PriorCaptureIndex;
  simulateFailureAfterTempWrite?: boolean;
};
