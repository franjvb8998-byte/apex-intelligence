/**
 * 5C.3 live prospective protocol contracts. Offline only. No collection.
 */

export const LIVE_PROTOCOL_VERSION = "apex.calibration.prospective.5c3.v1";
export const LIVE_PROTOCOL_BASE_COMMIT = "82162ad2cea7132cede9631ff268ad1c0fcee608";
export const PROSPECTIVE_COMPETITION_ID = "39";
export const PROSPECTIVE_SEASON_UNVERIFIED = "UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY";
export const OFFLINE_SYNTHETIC_SEASON = "2099";

export const SAMPLE_DISPOSITIONS = [
  "CAPTURED_PENDING",
  "MISSED_WINDOW",
  "POSTPONED_BEFORE_CAPTURE",
  "CANCELLED_BEFORE_CAPTURE",
  "INELIGIBLE_STATUS",
  "DUPLICATE",
  "INTEGRITY_REJECTED",
  "SOURCE_FAILURE",
] as const;
export type SampleDisposition = (typeof SAMPLE_DISPOSITIONS)[number];

export const PLANNER_DISPOSITIONS = [
  ...SAMPLE_DISPOSITIONS,
  "TOO_EARLY",
  "IN_WINDOW",
] as const;
export type PlannerDisposition = (typeof PLANNER_DISPOSITIONS)[number];

export type DiscoveredFixtureMetadata = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  alreadyCaptured?: boolean;
  sourceFailure?: boolean;
};

export type PlannerClassification = {
  fixtureId: string;
  disposition: PlannerDisposition;
  reason: string;
  minutesBeforeKickoff: number | null;
  eligibleForPrimarySample: boolean;
  kickoffUtc: string | null;
};

export type ProtocolApiBudget = {
  maxFixtureDiscoveryCalls: number;
  maxEvidenceCalls: number;
  maxOddsCalls: number;
  maxTotalCalls: number;
};

export type LiveProtocolConfig = {
  version: string;
  baseCommit: string;
  competitionId: string;
  prospectiveSeason: string;
  targetCaptureMinutesBeforeKickoff: number;
  earliestCaptureMinutesBeforeKickoff: number;
  latestCaptureMinutesBeforeKickoff: number;
  candidateVersion: string;
  candidateFingerprint: string;
  oddsRequired: boolean;
  historicalUsedSeasons: readonly string[];
  reportingCheckpoints: readonly number[];
  noAdaptiveTuning: boolean;
  noRetrospectiveBackfill: boolean;
  noCherryPicking: boolean;
  discoverySeparatedFromCapture: boolean;
  utcCanonical: boolean;
  sameKickoffEvidenceExclusive: boolean;
  sparseEvidenceAllowed: boolean;
  zeroEvidenceAllowed: boolean;
  provider: string;
  allowedEndpointFamilies: readonly string[];
  allowedEndpoints: readonly string[];
  deniedEndpoints: readonly string[];
  fixtureDiscoveryPaging: string;
  maxPagingLoops: number;
  evidenceCallsPerCandidate: number;
  sharedEvidenceSnapshot: boolean;
  apiBudget: ProtocolApiBudget;
  retryOnlyWhileInsideWindow: boolean;
  neverCaptureAfterLatest: boolean;
  neverBackfillAfterKickoff: boolean;
};
