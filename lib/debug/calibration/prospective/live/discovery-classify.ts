/**
 * Discovery-window classification using the frozen 5C.3 planner.
 * IN_WINDOW is an alert only. This module never captures.
 */

import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { planDiscoveredFixtures } from "@/lib/debug/calibration/prospective/protocol/protocol-planner";
import type { DiscoveredFixtureMetadata } from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import type {
  DiscoveryCaptureOpportunity,
  DiscoveryClassification,
  SafeDiscoveredFixture,
} from "@/lib/debug/calibration/prospective/live/discovery-types";

export function classifyProjectedFixtures(
  fixtures: readonly SafeDiscoveredFixture[],
  clock: CaptureClock,
  verifiedSeason: string,
): DiscoveryClassification[] {
  const metadata: DiscoveredFixtureMetadata[] = fixtures.map((row) => ({
    fixtureId: row.fixtureId,
    competitionId: row.competitionId,
    season: row.season,
    kickoff: row.kickoffUtc,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    status: row.statusShort,
  }));
  const planned = planDiscoveredFixtures(metadata, clock, { season: verifiedSeason });
  const byId = new Map(fixtures.map((row) => [row.fixtureId, row]));
  return planned.map((row) => {
    const source = byId.get(row.fixtureId);
    return {
      fixtureId: row.fixtureId,
      homeTeamName: source?.homeTeamName ?? "",
      awayTeamName: source?.awayTeamName ?? "",
      kickoffUtc: source?.kickoffUtc ?? row.kickoffUtc ?? "",
      statusShort: source?.statusShort ?? "",
      statusLong: source?.statusLong ?? "",
      minutesUntilKickoff: row.minutesBeforeKickoff,
      classification: row.disposition,
      reason: row.reason,
    };
  });
}

export function captureOpportunitiesFrom(
  classifications: readonly DiscoveryClassification[],
): DiscoveryCaptureOpportunity[] {
  return classifications
    .filter((row) => row.classification === "IN_WINDOW")
    .map((row) => ({
      fixtureId: row.fixtureId,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      kickoffUtc: row.kickoffUtc,
      minutesUntilKickoff: row.minutesUntilKickoff,
      statusShort: row.statusShort,
      statusLong: row.statusLong,
    }));
}

export function upcomingClassifications(
  classifications: readonly DiscoveryClassification[],
): DiscoveryClassification[] {
  return classifications.filter(
    (row) => row.minutesUntilKickoff != null && row.minutesUntilKickoff > 0,
  );
}

export function nearestUpcoming(
  classifications: readonly DiscoveryClassification[],
  limit = 8,
): DiscoveryClassification[] {
  return [...upcomingClassifications(classifications)]
    .sort((left, right) => {
      const kickoff = left.kickoffUtc.localeCompare(right.kickoffUtc);
      if (kickoff !== 0) return kickoff;
      return left.fixtureId.localeCompare(right.fixtureId);
    })
    .slice(0, limit);
}
