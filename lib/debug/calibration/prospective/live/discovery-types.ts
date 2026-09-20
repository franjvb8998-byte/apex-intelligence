/**
 * 5C.4 discovery-only contracts. Safe projected metadata. No capture. No scoring.
 */

import type { PlannerDisposition } from "@/lib/debug/calibration/prospective/protocol/protocol-types";

export const DISCOVERY_PROVIDER = "api-football" as const;
export const DISCOVERY_ALLOWED_PATH = "/fixtures" as const;
export const DISCOVERY_NEXT_COUNT = 20;
export const DISCOVERY_DATA_DIR = "data/prospective/discovery";

export const DISCOVERY_ALLOWED_QUERY_KEYS = ["league", "next", "season"] as const;
export const DISCOVERY_FORBIDDEN_PATHS = [
  "/odds",
  "/fixtures/statistics",
  "/fixtures/events",
  "/fixtures/lineups",
  "/teams/statistics",
  "/standings",
  "/fixtures/headtohead",
  "/leagues",
] as const;

export const DISCOVERY_FORBIDDEN_PAYLOAD_KEYS = [
  "goals",
  "score",
  "scores",
  "winner",
  "halftime",
  "fulltime",
  "extratime",
  "penalties",
  "penalty",
  "events",
  "statistics",
  "lineups",
] as const;

export const SEASON_VERIFICATION_METHOD =
  "unique league.season extracted from a single GET /fixtures?league=39&next=20 response; no /leagues; no calendar inference";

export type DiscoveryFixtureQuery = {
  league: string;
  next?: number;
  season?: string;
};

export const DISCOVERY_FIXTURE_QUERY: DiscoveryFixtureQuery = {
  league: "39",
  next: DISCOVERY_NEXT_COUNT,
};

export type SafeDiscoveredFixture = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  statusShort: string;
  statusLong: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
};

export type DiscoveryCallAccounting = {
  fixtureDiscoveryCalls: number;
  seasonDiscoveryCalls: number;
  oddsCalls: number;
  evidenceCalls: number;
  totalCalls: number;
};

export type DiscoveryClassification = {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  statusShort: string;
  statusLong: string;
  minutesUntilKickoff: number | null;
  classification: PlannerDisposition;
  reason: string;
};

export type DiscoveryCaptureOpportunity = {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffUtc: string;
  minutesUntilKickoff: number | null;
  statusShort: string;
  statusLong: string;
};

export type DiscoveryArtifact = {
  discoveredAtUtc: string;
  protocolFingerprint: string;
  candidateFingerprint: string;
  provider: typeof DISCOVERY_PROVIDER;
  liveCallCount: number;
  verifiedSeason: string | null;
  seasonVerificationMethod: string;
  callAccounting: DiscoveryCallAccounting;
  fixtures: SafeDiscoveredFixture[];
  classifications: DiscoveryClassification[];
  liveCaptureOpportunityDetected: boolean;
  captureOpportunities: DiscoveryCaptureOpportunity[];
  predictionsCaptured: 0;
  createdPredictions: false;
  pagingObserved: { current: number | null; total: number | null };
  paginationLoopAttempted: false;
};

export type DiscoveryRunResult = DiscoveryArtifact & {
  phase: "DISCOVERY_ONLY";
  fixtureCountReturned: number;
  upcomingFixtureCount: number;
  observedStatuses: string[];
  nearestUpcoming: DiscoveryClassification[];
  artifactPath: string | null;
  rawResponsePersisted: false;
  scoresPersisted: false;
};

export type DiscoveryTransport = {
  getFixtures(query: DiscoveryFixtureQuery): Promise<unknown>;
};

export class DiscoveryIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryIntegrityError";
  }
}

export class DiscoveryBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryBudgetError";
  }
}
