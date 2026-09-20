/**
 * 5C.4 discovery-only runner. Classifies live fixture metadata. Never captures.
 */

import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { LIVE_PROTOCOL_FINGERPRINT } from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";
import { FIRST_LIVE_PHASE } from "@/lib/debug/calibration/prospective/protocol/protocol-discovery";
import { LIVE_PROTOCOL_CONFIG } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import {
  captureOpportunitiesFrom,
  classifyProjectedFixtures,
  nearestUpcoming,
  upcomingClassifications,
} from "@/lib/debug/calibration/prospective/live/discovery-classify";
import {
  emptyDiscoveryAccounting,
  noteFixtureDiscoveryCall,
} from "@/lib/debug/calibration/prospective/live/discovery-budget";
import { persistDiscoveryArtifact } from "@/lib/debug/calibration/prospective/live/discovery-persist";
import {
  projectSafeFixtures,
  seasonVerificationMethod,
  verifySeasonFromProjected,
} from "@/lib/debug/calibration/prospective/live/discovery-projection";
import { assertOddsUnavailable } from "@/lib/debug/calibration/prospective/live/discovery-transport";
import {
  DISCOVERY_FIXTURE_QUERY,
  DISCOVERY_PROVIDER,
  DiscoveryIntegrityError,
  type DiscoveryRunResult,
  type DiscoveryTransport,
} from "@/lib/debug/calibration/prospective/live/discovery-types";

export type DiscoverLiveFixturesInput = {
  transport: DiscoveryTransport;
  clock: CaptureClock;
  persist?: boolean;
  persistRoot?: string;
};

export async function discoverLiveFixtures(
  input: DiscoverLiveFixturesInput,
): Promise<DiscoveryRunResult> {
  if (FIRST_LIVE_PHASE !== "DISCOVERY_ONLY") {
    throw new DiscoveryIntegrityError("first live phase must remain DISCOVERY_ONLY");
  }
  if (!LIVE_PROTOCOL_CONFIG.discoverySeparatedFromCapture) {
    throw new DiscoveryIntegrityError("discovery must remain separated from capture");
  }
  assertOddsUnavailable(input.transport);

  const discoveredAtUtc = input.clock.now();
  let accounting = emptyDiscoveryAccounting();
  accounting = noteFixtureDiscoveryCall(accounting);
  const payload = await input.transport.getFixtures(DISCOVERY_FIXTURE_QUERY);
  const projected = projectSafeFixtures(payload);
  if (
    projected.pagingObserved.total != null &&
    projected.pagingObserved.total > 1
  ) {
    // Frozen protocol: unpaged single call. Do not follow additional pages.
  }
  const verifiedSeason = verifySeasonFromProjected(projected.fixtures);
  const classifications = classifyProjectedFixtures(
    projected.fixtures,
    input.clock,
    verifiedSeason,
  );
  const opportunities = captureOpportunitiesFrom(classifications);
  const upcoming = upcomingClassifications(classifications);
  const artifact = {
    discoveredAtUtc,
    protocolFingerprint: LIVE_PROTOCOL_FINGERPRINT,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    provider: DISCOVERY_PROVIDER,
    liveCallCount: accounting.totalCalls,
    verifiedSeason,
    seasonVerificationMethod: seasonVerificationMethod(),
    callAccounting: accounting,
    fixtures: projected.fixtures,
    classifications,
    liveCaptureOpportunityDetected: opportunities.length > 0,
    captureOpportunities: opportunities,
    predictionsCaptured: 0 as const,
    createdPredictions: false as const,
    pagingObserved: projected.pagingObserved,
    paginationLoopAttempted: false as const,
  };

  let artifactPath: string | null = null;
  if (input.persist) {
    artifactPath = persistDiscoveryArtifact({
      artifact,
      persistRoot: input.persistRoot,
    }).path;
  }

  return {
    ...artifact,
    phase: FIRST_LIVE_PHASE,
    fixtureCountReturned: projected.fixtures.length,
    upcomingFixtureCount: upcoming.length,
    observedStatuses: [...new Set(projected.fixtures.map((row) => row.statusShort))].sort(),
    nearestUpcoming: nearestUpcoming(classifications),
    artifactPath,
    rawResponsePersisted: false,
    scoresPersisted: false,
  };
}
