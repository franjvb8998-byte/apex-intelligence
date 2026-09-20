/**
 * Map injected pre-match evidence onto the frozen 5C.2 snapshot contract.
 * 5C.5A does not collect evidence from the provider or from sibling fixtures.
 */

import type { ProspectiveFixtureInput } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { isEligiblePriorEvidence } from "@/lib/debug/calibration/prospective/protocol/protocol-evidence";
import type { LiveCaptureFixtureInput } from "@/lib/debug/calibration/prospective/live-capture/live-capture-types";

export function toProspectiveFixtureInput(fixture: LiveCaptureFixtureInput): ProspectiveFixtureInput {
  return {
    fixtureId: fixture.fixtureId,
    competitionId: fixture.competitionId,
    season: fixture.season,
    kickoff: fixture.kickoffUtc,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeTeamName: fixture.homeTeamName,
    awayTeamName: fixture.awayTeamName,
    evidenceAsOf: fixture.evidenceAsOf,
    preMatchEvidence: fixture.preMatchEvidence,
    oddsSnapshot: fixture.oddsSnapshot ?? null,
  };
}

export function siblingMaySupplyEvidence(
  prior: LiveCaptureFixtureInput,
  target: LiveCaptureFixtureInput,
): boolean {
  return prior.fixtureId !== target.fixtureId && isEligiblePriorEvidence(prior.kickoffUtc, target.kickoffUtc);
}
