/**
 * Frozen 5C.3 operational live-capture protocol. No live calls. No adaptive tuning.
 */

import {
  CANDIDATE_MANIFEST_FINGERPRINT,
} from "@/lib/debug/calibration/prospective/candidate-config";
import {
  PROSPECTIVE_CANDIDATE_VERSION,
  PROSPECTIVE_CHECKPOINTS,
  USED_HISTORICAL_SEASONS,
} from "@/lib/debug/calibration/prospective/candidate-types";
import type { CaptureWindowMinutes } from "@/lib/debug/calibration/prospective/capture/capture-types";
import {
  LIVE_PROTOCOL_BASE_COMMIT,
  LIVE_PROTOCOL_VERSION,
  PROSPECTIVE_COMPETITION_ID,
  PROSPECTIVE_SEASON_UNVERIFIED,
  type LiveProtocolConfig,
  type ProtocolApiBudget,
} from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const LIVE_CAPTURE_WINDOW = {
  targetCaptureMinutesBeforeKickoff: 60,
  earliestCaptureMinutesBeforeKickoff: 75,
  latestCaptureMinutesBeforeKickoff: 45,
} as const;

export const LIVE_PROTOCOL_API_BUDGET: ProtocolApiBudget = {
  maxFixtureDiscoveryCalls: 1,
  maxEvidenceCalls: 1,
  maxOddsCalls: 20,
  maxTotalCalls: 22,
};

export const LIVE_PROTOCOL_CONFIG: LiveProtocolConfig = {
  version: LIVE_PROTOCOL_VERSION,
  baseCommit: LIVE_PROTOCOL_BASE_COMMIT,
  competitionId: PROSPECTIVE_COMPETITION_ID,
  prospectiveSeason: PROSPECTIVE_SEASON_UNVERIFIED,
  targetCaptureMinutesBeforeKickoff: LIVE_CAPTURE_WINDOW.targetCaptureMinutesBeforeKickoff,
  earliestCaptureMinutesBeforeKickoff: LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff,
  latestCaptureMinutesBeforeKickoff: LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff,
  candidateVersion: PROSPECTIVE_CANDIDATE_VERSION,
  candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
  oddsRequired: false,
  historicalUsedSeasons: USED_HISTORICAL_SEASONS,
  reportingCheckpoints: PROSPECTIVE_CHECKPOINTS,
  noAdaptiveTuning: true,
  noRetrospectiveBackfill: true,
  noCherryPicking: true,
  discoverySeparatedFromCapture: true,
  utcCanonical: true,
  sameKickoffEvidenceExclusive: true,
  sparseEvidenceAllowed: true,
  zeroEvidenceAllowed: true,
  provider: "api-football",
  allowedEndpointFamilies: [
    "fixture_discovery",
    "prior_fixture_evidence",
    "optional_prematch_odds",
  ],
  allowedEndpoints: [
    "GET /fixtures?league=39&season={prospectiveSeason}",
    "GET /odds?fixture={fixtureId}",
  ],
  deniedEndpoints: [
    "GET /fixtures/lineups",
    "GET /fixtures/events",
    "GET /fixtures/statistics",
    "GET /fixtures/headtohead",
    "GET /teams/statistics",
    "GET /standings",
    "GET /injuries",
    "GET /players",
  ],
  fixtureDiscoveryPaging: "UNPAGED_SINGLE_CALL",
  maxPagingLoops: 0,
  evidenceCallsPerCandidate: 0,
  sharedEvidenceSnapshot: true,
  apiBudget: LIVE_PROTOCOL_API_BUDGET,
  retryOnlyWhileInsideWindow: true,
  neverCaptureAfterLatest: true,
  neverBackfillAfterKickoff: true,
};

export function liveProtocolCaptureWindow(): CaptureWindowMinutes {
  return {
    earliestCaptureMinutesBeforeKickoff: LIVE_CAPTURE_WINDOW.earliestCaptureMinutesBeforeKickoff,
    latestCaptureMinutesBeforeKickoff: LIVE_CAPTURE_WINDOW.latestCaptureMinutesBeforeKickoff,
  };
}

export function assertFiniteApiBudget(budget: ProtocolApiBudget = LIVE_PROTOCOL_API_BUDGET): void {
  const values = [
    budget.maxFixtureDiscoveryCalls,
    budget.maxEvidenceCalls,
    budget.maxOddsCalls,
    budget.maxTotalCalls,
  ];
  if (!values.every((value) => Number.isInteger(value) && value >= 0 && Number.isFinite(value))) {
    throw new Error("API budget ceilings must be finite non-negative integers");
  }
  if (budget.maxTotalCalls < budget.maxFixtureDiscoveryCalls + budget.maxEvidenceCalls) {
    throw new Error("maxTotalCalls must cover discovery and evidence ceilings");
  }
  if (budget.maxTotalCalls < 1) {
    throw new Error("API budget must not allow unlimited collection");
  }
}
