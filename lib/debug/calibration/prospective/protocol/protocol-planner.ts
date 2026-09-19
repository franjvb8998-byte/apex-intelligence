/**
 * Offline eligibility planner. Synthetic metadata only. Zero network.
 */

import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { LIVE_PROTOCOL_CONFIG } from "@/lib/debug/calibration/prospective/protocol/protocol-config";
import { classifyProviderStatus } from "@/lib/debug/calibration/prospective/protocol/protocol-status";
import {
  OFFLINE_SYNTHETIC_SEASON,
  PROSPECTIVE_COMPETITION_ID,
  PROSPECTIVE_SEASON_UNVERIFIED,
  type DiscoveredFixtureMetadata,
  type PlannerClassification,
  type PlannerDisposition,
} from "@/lib/debug/calibration/prospective/protocol/protocol-types";
import { minutesBeforeKickoffUtc, toUtcIso } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";

export type PlannerOptions = {
  season?: string;
  priorCapturedIds?: ReadonlySet<string>;
};

function seasonAllowed(season: string, configuredSeason: string): boolean {
  if ((LIVE_PROTOCOL_CONFIG.historicalUsedSeasons as readonly string[]).includes(season)) {
    return false;
  }
  if (configuredSeason === PROSPECTIVE_SEASON_UNVERIFIED) {
    return season === OFFLINE_SYNTHETIC_SEASON;
  }
  return season === configuredSeason;
}

function classifyOne(
  fixture: DiscoveredFixtureMetadata,
  asOf: string,
  options: PlannerOptions,
): PlannerClassification {
  const configuredSeason = options.season ?? LIVE_PROTOCOL_CONFIG.prospectiveSeason;
  if (fixture.sourceFailure) {
    return {
      fixtureId: fixture.fixtureId || "unknown",
      disposition: "SOURCE_FAILURE",
      reason: "source failure before capture",
      minutesBeforeKickoff: null,
      eligibleForPrimarySample: false,
      kickoffUtc: null,
    };
  }
  if (!fixture.fixtureId || !fixture.homeTeamId || !fixture.awayTeamId) {
    return {
      fixtureId: fixture.fixtureId || "unknown",
      disposition: "INTEGRITY_REJECTED",
      reason: "missing fixture or team identifiers",
      minutesBeforeKickoff: null,
      eligibleForPrimarySample: false,
      kickoffUtc: null,
    };
  }
  if (String(fixture.competitionId) !== PROSPECTIVE_COMPETITION_ID) {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "INTEGRITY_REJECTED",
      reason: "competition is not Premier League 39",
      minutesBeforeKickoff: null,
      eligibleForPrimarySample: false,
      kickoffUtc: null,
    };
  }
  if (!seasonAllowed(String(fixture.season), configuredSeason)) {
    const used = (LIVE_PROTOCOL_CONFIG.historicalUsedSeasons as readonly string[]).includes(
      String(fixture.season),
    );
    return {
      fixtureId: fixture.fixtureId,
      disposition: "INTEGRITY_REJECTED",
      reason: used
        ? `USED historical season ${fixture.season} is forbidden`
        : `season ${fixture.season} is not the configured prospective season`,
      minutesBeforeKickoff: null,
      eligibleForPrimarySample: false,
      kickoffUtc: null,
    };
  }

  let kickoffUtc: string;
  try {
    kickoffUtc = toUtcIso(fixture.kickoff, "kickoff");
  } catch {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "INTEGRITY_REJECTED",
      reason: "kickoff is missing or not parseable",
      minutesBeforeKickoff: null,
      eligibleForPrimarySample: false,
      kickoffUtc: null,
    };
  }

  if (fixture.alreadyCaptured || options.priorCapturedIds?.has(fixture.fixtureId)) {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "DUPLICATE",
      reason: "already captured under the frozen candidate fingerprint",
      minutesBeforeKickoff: minutesBeforeKickoffUtc(kickoffUtc, asOf),
      eligibleForPrimarySample: false,
      kickoffUtc,
    };
  }

  const status = classifyProviderStatus(fixture.status);
  if (status.disposition === "POSTPONED_BEFORE_CAPTURE") {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "POSTPONED_BEFORE_CAPTURE",
      reason: `postponed before capture (${status.normalized})`,
      minutesBeforeKickoff: minutesBeforeKickoffUtc(kickoffUtc, asOf),
      eligibleForPrimarySample: false,
      kickoffUtc,
    };
  }
  if (status.disposition === "CANCELLED_BEFORE_CAPTURE") {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "CANCELLED_BEFORE_CAPTURE",
      reason: `cancelled or abandoned before capture (${status.normalized})`,
      minutesBeforeKickoff: minutesBeforeKickoffUtc(kickoffUtc, asOf),
      eligibleForPrimarySample: false,
      kickoffUtc,
    };
  }
  if (status.disposition === "INELIGIBLE_STATUS" || status.disposition === "UNKNOWN") {
    return {
      fixtureId: fixture.fixtureId,
      disposition: "INELIGIBLE_STATUS",
      reason:
        status.disposition === "UNKNOWN"
          ? `unknown provider status ${status.normalized} rejected until reviewed`
          : `in-play or final status ${status.normalized} is not eligible`,
      minutesBeforeKickoff: minutesBeforeKickoffUtc(kickoffUtc, asOf),
      eligibleForPrimarySample: false,
      kickoffUtc,
    };
  }

  const minutes = minutesBeforeKickoffUtc(kickoffUtc, asOf);
  const earliest = LIVE_PROTOCOL_CONFIG.earliestCaptureMinutesBeforeKickoff;
  const latest = LIVE_PROTOCOL_CONFIG.latestCaptureMinutesBeforeKickoff;
  let disposition: PlannerDisposition;
  let reason: string;
  if (minutes > earliest) {
    disposition = "TOO_EARLY";
    reason = `T-${minutes} is before the T-${earliest} open`;
  } else if (minutes < latest) {
    disposition = "MISSED_WINDOW";
    reason = minutes <= 0
      ? "kickoff has passed; no retrospective capture"
      : `T-${minutes} is after the T-${latest} close`;
  } else {
    disposition = "IN_WINDOW";
    reason = `inside T-${earliest} to T-${latest}`;
  }

  return {
    fixtureId: fixture.fixtureId,
    disposition,
    reason,
    minutesBeforeKickoff: minutes,
    eligibleForPrimarySample: disposition === "IN_WINDOW",
    kickoffUtc,
  };
}

export function planDiscoveredFixtures(
  fixtures: readonly DiscoveredFixtureMetadata[],
  clock: CaptureClock,
  options: PlannerOptions = {},
): PlannerClassification[] {
  const asOf = clock.now();
  return fixtures.map((fixture) => classifyOne(fixture, asOf, options));
}

export function protocolDryRun(
  fixtures: readonly DiscoveredFixtureMetadata[],
  clock: CaptureClock,
  options: PlannerOptions = {},
): {
  dryRun: true;
  createdPredictions: false;
  networkCalls: 0;
  classifications: PlannerClassification[];
} {
  return {
    dryRun: true,
    createdPredictions: false,
    networkCalls: 0,
    classifications: planDiscoveredFixtures(fixtures, clock, options),
  };
}
