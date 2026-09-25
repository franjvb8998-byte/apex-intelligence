/**
 * PE-4I.2 — Deterministic acquisition planner (inspectable before execution).
 */

import { createHash } from "node:crypto";
import {
  PE4I2_ALLOWED_SEASONS,
  PE4I2_HOLDOUT_SEASON,
  PE4I2_PROTOCOL_VERSION,
  PE4I2_TARGET_LEAGUE_PROVIDER_ID,
  assertSeasonAllowed,
  digestPe4I2Protocol,
  pe4I2Protocol,
  teamsForSeason,
  type Pe4I2AllowedSeason,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  scheduleUnitKey,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
  type Pe4I2CacheUnitStatus,
} from "@/lib/debug/calibration/pe4-acquisition/cache";

export type Pe4I2ScheduleUnit = {
  unitKey: string;
  kind: "team_season_schedule";
  providerTeamId: string;
  season: Pe4I2AllowedSeason;
  cacheStatus: Pe4I2CacheUnitStatus;
};

export type Pe4I2StatisticsUnit = {
  unitKey: string;
  kind: "fixture_statistics";
  providerFixtureId: string;
  cacheStatus: Pe4I2CacheUnitStatus;
};

export type Pe4I2AcquisitionPlan = {
  protocolVersion: typeof PE4I2_PROTOCOL_VERSION;
  protocolDigest: string;
  targetLeagueProviderId: typeof PE4I2_TARGET_LEAGUE_PROVIDER_ID;
  seasons: readonly Pe4I2AllowedSeason[];
  teamsBySeason: Record<Pe4I2AllowedSeason, readonly string[]>;
  scheduleUnits: Pe4I2ScheduleUnit[];
  /** Populated after schedule discovery; empty in pre-discovery plan. */
  statisticsUnits: Pe4I2StatisticsUnit[];
  estimates: {
    scheduleCalls: number;
    statisticsCalls: number;
    cachedScheduleUnits: number;
    cachedStatisticsUnits: number;
    remainingScheduleCalls: number;
    remainingStatisticsCalls: number;
    maxPossibleCallsForRun: number;
  };
  liveEnabled: false;
  holdoutSeason: typeof PE4I2_HOLDOUT_SEASON;
  holdoutRejected: true;
  planDigest: string;
};

function unitCacheStatus(
  cache: Pe4I2AcquisitionCache | null,
  unitKey: string,
): Pe4I2CacheUnitStatus {
  if (!cache) return "absent";
  return cache.getUnit(unitKey)?.status ?? "absent";
}

export function digestAcquisitionPlan(plan: Omit<Pe4I2AcquisitionPlan, "planDigest">): string {
  const material = {
    protocolDigest: plan.protocolDigest,
    seasons: plan.seasons,
    teamsBySeason: plan.teamsBySeason,
    scheduleUnitKeys: plan.scheduleUnits.map((u) => u.unitKey),
    statisticsUnitKeys: plan.statisticsUnits.map((u) => u.unitKey),
    estimates: plan.estimates,
  };
  return createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");
}

/**
 * Build pre-discovery schedule plan for PL clubs 2023+2024.
 * Rejects any holdout season attempt.
 */
export function buildPe4I2AcquisitionPlan(input: {
  seasons?: readonly string[];
  cache?: Pe4I2AcquisitionCache | null;
  /** Optional discovered fixture ids for statistics phase. */
  discoveredFixtureIds?: readonly string[];
  /** Hard maxCalls for the eventual run (required for estimate clamp reporting). */
  maxCalls: number;
}): Pe4I2AcquisitionPlan {
  if (!Number.isInteger(input.maxCalls) || input.maxCalls < 0) {
    throw new Error("maxCalls must be a non-negative integer");
  }
  const rawSeasons = input.seasons ?? PE4I2_ALLOWED_SEASONS;
  for (const s of rawSeasons) {
    if (s === PE4I2_HOLDOUT_SEASON) {
      throw new Error(
        `PE-4I.2 holdout firewall: cannot plan season ${PE4I2_HOLDOUT_SEASON}`,
      );
    }
  }
  const seasons = [...rawSeasons]
    .map((s) => assertSeasonAllowed(s))
    .sort() as Pe4I2AllowedSeason[];

  const teamsBySeason = {
    "2023": teamsForSeason("2023"),
    "2024": teamsForSeason("2024"),
  } as Record<Pe4I2AllowedSeason, readonly string[]>;

  const scheduleUnits: Pe4I2ScheduleUnit[] = [];
  for (const season of seasons) {
    for (const teamId of [...teamsBySeason[season]].sort(
      (a, b) => Number(a) - Number(b),
    )) {
      const unitKey = scheduleUnitKey(teamId, season);
      scheduleUnits.push({
        unitKey,
        kind: "team_season_schedule",
        providerTeamId: teamId,
        season,
        cacheStatus: unitCacheStatus(input.cache ?? null, unitKey),
      });
    }
  }
  scheduleUnits.sort((a, b) => a.unitKey.localeCompare(b.unitKey));

  const fixtureIds = [
    ...new Set((input.discoveredFixtureIds ?? []).map((x) => x.trim())),
  ]
    .filter(Boolean)
    .sort();
  const statisticsUnits: Pe4I2StatisticsUnit[] = fixtureIds.map((id) => {
    const unitKey = statisticsUnitKey(id);
    return {
      unitKey,
      kind: "fixture_statistics",
      providerFixtureId: id,
      cacheStatus: unitCacheStatus(input.cache ?? null, unitKey),
    };
  });

  const cachedScheduleUnits = scheduleUnits.filter(
    (u) => u.cacheStatus === "completed",
  ).length;
  const cachedStatisticsUnits = statisticsUnits.filter(
    (u) => u.cacheStatus === "completed",
  ).length;
  const remainingScheduleCalls = scheduleUnits.length - cachedScheduleUnits;
  const remainingStatisticsCalls =
    statisticsUnits.length - cachedStatisticsUnits;
  const maxPossibleCallsForRun =
    remainingScheduleCalls + remainingStatisticsCalls;

  const protocol = pe4I2Protocol();
  const base = {
    protocolVersion: PE4I2_PROTOCOL_VERSION,
    protocolDigest: digestPe4I2Protocol(protocol),
    targetLeagueProviderId: PE4I2_TARGET_LEAGUE_PROVIDER_ID,
    seasons,
    teamsBySeason,
    scheduleUnits,
    statisticsUnits,
    estimates: {
      scheduleCalls: scheduleUnits.length,
      statisticsCalls: statisticsUnits.length,
      cachedScheduleUnits,
      cachedStatisticsUnits,
      remainingScheduleCalls,
      remainingStatisticsCalls,
      maxPossibleCallsForRun,
    },
    liveEnabled: false as const,
    holdoutSeason: PE4I2_HOLDOUT_SEASON,
    holdoutRejected: true as const,
  };
  return {
    ...base,
    planDigest: digestAcquisitionPlan(base),
  };
}

/** Shuffle invariance helper for tests. */
export function buildPlanFromShuffledTeams(input: {
  maxCalls: number;
  season: Pe4I2AllowedSeason;
  teamIds: readonly string[];
}): string {
  assertSeasonAllowed(input.season);
  const units = [...input.teamIds]
    .map((teamId) => scheduleUnitKey(teamId, input.season))
    .sort();
  return createHash("sha256").update(units.join("\n"), "utf8").digest("hex");
}
