/**
 * PE-4I.4 — Multi-competition bulk acquisition planner (offline only).
 * PROVIDER_CALLS_MADE must remain 0 in this phase.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  createPe4I2AcquisitionCache,
  scheduleUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import { dedupeScheduleFixtures } from "@/lib/debug/calibration/pe4-acquisition/dedupe";
import type { Pe4I2RawScheduleEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I2_HOLDOUT_SEASON,
  PE4I2_PL_TEAMS_2023,
  PE4I2_PL_TEAMS_2024,
  PE4I2_PROTOCOL_VERSION,
  assertSeasonAllowed,
  digestPe4I2Protocol,
  pe4I2Protocol,
  teamsForSeason,
  type Pe4I2AllowedSeason,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { evaluateStatisticsEligibility } from "@/lib/debug/calibration/pe4-acquisition/statistics-eligibility";
import { PE4I4_XG_STATUS } from "@/lib/debug/calibration/pe4-acquisition/performance-fields";
import {
  PE4I4_STAGE1_NAME,
  PE4I4_STAGE2_NAME,
  refusePe4I4LiveBulkExecution,
} from "@/lib/debug/calibration/pe4-acquisition/stages";

export const PE4I4_PLAN_VERSION =
  "pe4.bulk_multi_comp_acquisition_plan.v1" as const;

export const PE4I4_PROVIDER_DAILY_ALLOWANCE_CONTEXT = 7500 as const;

/** Recommended safe Stage-1 schedule batch (covers 39 missing + buffer). */
export const PE4I4_RECOMMENDED_SCHEDULE_BATCH_BUDGET = 50 as const;

/** Recommended Stage-2 statistics batch size per authorized run. */
export const PE4I4_RECOMMENDED_STATISTICS_BATCH_BUDGET = 150 as const;

export type Pe4I4ClubSeasonUnit = {
  unitKey: string;
  providerTeamId: string;
  season: Pe4I2AllowedSeason;
  cached: boolean;
  cacheRootRelative: string | null;
};

export type Pe4I4Pe4I3CacheVerification = {
  found: boolean;
  unitKey: string;
  contentDigest: string | null;
  fixturesReturned: number | null;
  uniqueFixtures: number | null;
  selectedTeamId: string;
  selectedSeason: "2024";
  loadOk: boolean;
  message: string;
};

export type Pe4I4CallEstimates = {
  estimatedScheduleCalls: number;
  estimatedUniqueLeagueFixtures: number;
  estimatedAdditionalCupEuropeFixturesLower: number;
  estimatedAdditionalCupEuropeFixturesUpper: number;
  estimatedStatisticsCallsRange: { lower: number; upper: number };
  estimatedTotalProviderCallsRange: { lower: number; upper: number };
  assumptions: string[];
};

export type Pe4I4BulkAcquisitionPlan = {
  planVersion: typeof PE4I4_PLAN_VERSION;
  protocolVersion: typeof PE4I2_PROTOCOL_VERSION;
  protocolDigest: string;
  planDigest: string;
  targetSeasons: readonly Pe4I2AllowedSeason[];
  uniqueClubs2023: readonly string[];
  uniqueClubs2024: readonly string[];
  clubSeasonUnits: Pe4I4ClubSeasonUnit[];
  cachedScheduleUnits: number;
  missingScheduleUnits: number;
  estimatedScheduleCalls: number;
  pe4i3Cache: Pe4I4Pe4I3CacheVerification;
  estimates: Pe4I4CallEstimates;
  stage1: {
    name: typeof PE4I4_STAGE1_NAME;
    units: number;
    alreadyCached: number;
    estimatedNewCalls: number;
    stopCondition: string;
    statisticsCallsAllowed: false;
  };
  stage2: {
    name: typeof PE4I4_STAGE2_NAME;
    requiresStage1ExactQueue: true;
    estimatedCallsRange: { lower: number; upper: number };
    stopCondition: string;
  };
  recommendedScheduleBatchBudget: typeof PE4I4_RECOMMENDED_SCHEDULE_BATCH_BUDGET;
  recommendedStatisticsBatchBudget: typeof PE4I4_RECOMMENDED_STATISTICS_BATCH_BUDGET;
  providerDailyAllowanceContext: typeof PE4I4_PROVIDER_DAILY_ALLOWANCE_CONTEXT;
  xgStatus: typeof PE4I4_XG_STATUS;
  holdoutSeason: typeof PE4I2_HOLDOUT_SEASON;
  liveBulk: ReturnType<typeof refusePe4I4LiveBulkExecution>;
  providerCallsMade: 0;
  liveEnabled: false;
};

function smokeCacheRoot(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "smoke-i3");
}

function mainCacheRoot(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

export function verifyPe4I3SmokeCache(
  cwd = process.cwd(),
): Pe4I4Pe4I3CacheVerification {
  const unitKey = scheduleUnitKey("33", "2024");
  const root = smokeCacheRoot(cwd);
  if (!existsSync(root)) {
    return {
      found: false,
      unitKey,
      contentDigest: null,
      fixturesReturned: null,
      uniqueFixtures: null,
      selectedTeamId: "33",
      selectedSeason: "2024",
      loadOk: false,
      message: "smoke-i3 cache root missing",
    };
  }
  try {
    const cache = createPe4I2AcquisitionCache(root);
    const unit = cache.getUnit(unitKey);
    if (!unit || unit.status !== "completed") {
      return {
        found: false,
        unitKey,
        contentDigest: unit?.contentDigest ?? null,
        fixturesReturned: null,
        uniqueFixtures: null,
        selectedTeamId: "33",
        selectedSeason: "2024",
        loadOk: false,
        message: "schedule unit not completed in smoke cache",
      };
    }
    const raw = cache.readRawJson(unitKey) as {
      payload?: Pe4I2RawScheduleEnvelope;
    } | null;
    const envelope = raw?.payload;
    if (!envelope?.fixtures) {
      return {
        found: true,
        unitKey,
        contentDigest: unit.contentDigest,
        fixturesReturned: null,
        uniqueFixtures: null,
        selectedTeamId: "33",
        selectedSeason: "2024",
        loadOk: false,
        message: "envelope missing fixtures",
      };
    }
    const deduped = dedupeScheduleFixtures(envelope.fixtures);
    if (!deduped.ok) {
      return {
        found: true,
        unitKey,
        contentDigest: unit.contentDigest,
        fixturesReturned: envelope.fixtures.length,
        uniqueFixtures: null,
        selectedTeamId: "33",
        selectedSeason: "2024",
        loadOk: false,
        message: deduped.message,
      };
    }
    return {
      found: true,
      unitKey,
      contentDigest: envelope.contentDigest,
      fixturesReturned: envelope.fixtures.length,
      uniqueFixtures: deduped.fixtures.length,
      selectedTeamId: "33",
      selectedSeason: "2024",
      loadOk: true,
      message: "PE-4I.3 smoke schedule loaded and normalized offline",
    };
  } catch (err) {
    return {
      found: true,
      unitKey,
      contentDigest: null,
      fixturesReturned: null,
      uniqueFixtures: null,
      selectedTeamId: "33",
      selectedSeason: "2024",
      loadOk: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function isScheduleCached(
  unitKey: string,
  caches: readonly Pe4I2AcquisitionCache[],
): { cached: boolean; rootRelative: string | null } {
  for (const cache of caches) {
    const u = cache.getUnit(unitKey);
    if (u?.status === "completed") {
      const rel = path
        .relative(process.cwd(), cache.rootDir)
        .replace(/\\/g, "/");
      return { cached: true, rootRelative: rel };
    }
  }
  return { cached: false, rootRelative: null };
}

export function listUsableAcquisitionCaches(
  cwd = process.cwd(),
): Pe4I2AcquisitionCache[] {
  const out: Pe4I2AcquisitionCache[] = [];
  for (const root of [smokeCacheRoot(cwd), mainCacheRoot(cwd)]) {
    if (existsSync(root)) out.push(createPe4I2AcquisitionCache(root));
  }
  return out;
}

export function buildCallEstimates(input: {
  missingScheduleUnits: number;
}): Pe4I4CallEstimates {
  // Structural: PL has 20 clubs × 19 opponents = 380 unique league fixtures / season.
  const estimatedUniqueLeagueFixtures = 380 * 2; // 2023 + 2024
  // From PE-4I.3 MU sample: competitive non-PL primary-eligible ≈ 15 UEL + 3 FA + 3 LC.
  // Across European qualifiers + cup tree with club overlap → structural band.
  const estimatedAdditionalCupEuropeFixturesLower = 100 * 2;
  const estimatedAdditionalCupEuropeFixturesUpper = 250 * 2;
  const lower =
    estimatedUniqueLeagueFixtures + estimatedAdditionalCupEuropeFixturesLower;
  const upper =
    estimatedUniqueLeagueFixtures + estimatedAdditionalCupEuropeFixturesUpper;
  const schedule = input.missingScheduleUnits;
  return {
    estimatedScheduleCalls: schedule,
    estimatedUniqueLeagueFixtures,
    estimatedAdditionalCupEuropeFixturesLower,
    estimatedAdditionalCupEuropeFixturesUpper,
    estimatedStatisticsCallsRange: { lower, upper },
    estimatedTotalProviderCallsRange: {
      lower: schedule + lower,
      upper: schedule + upper,
    },
    assumptions: [
      "PL unique league fixtures = 380 per provider season × 2 seasons",
      "Team-level schedule appearances are 2× league fixtures before fixture-id dedupe",
      "Cup/Europe unique fixtures estimated from MU 2024 competitive mix scaled across PL clubs with overlap",
      "Friendlies / Summer Series / Community Shield excluded from primary statistics queue",
      "Exact Stage-2 queue unknown until Stage-1 schedules are acquired",
      "PE-4I.3 MU 2024 schedule counts as 1 cached schedule unit when present",
    ],
  };
}

export function buildPe4I4BulkAcquisitionPlan(input?: {
  cwd?: string;
  caches?: Pe4I2AcquisitionCache[];
}): Pe4I4BulkAcquisitionPlan {
  const cwd = input?.cwd ?? process.cwd();
  assertSeasonAllowed("2023");
  assertSeasonAllowed("2024");

  const cacheList = input?.caches ?? listUsableAcquisitionCaches(cwd);

  const uniqueClubs2023 = [...teamsForSeason("2023")].sort(
    (a, b) => Number(a) - Number(b),
  );
  const uniqueClubs2024 = [...teamsForSeason("2024")].sort(
    (a, b) => Number(a) - Number(b),
  );

  const clubSeasonUnits: Pe4I4ClubSeasonUnit[] = [];
  for (const season of ["2023", "2024"] as const) {
    const teams = season === "2023" ? uniqueClubs2023 : uniqueClubs2024;
    for (const teamId of teams) {
      const unitKey = scheduleUnitKey(teamId, season);
      const { cached, rootRelative } = isScheduleCached(unitKey, cacheList);
      clubSeasonUnits.push({
        unitKey,
        providerTeamId: teamId,
        season,
        cached,
        cacheRootRelative: rootRelative,
      });
    }
  }
  clubSeasonUnits.sort((a, b) => a.unitKey.localeCompare(b.unitKey));

  const cachedScheduleUnits = clubSeasonUnits.filter((u) => u.cached).length;
  const missingScheduleUnits = clubSeasonUnits.length - cachedScheduleUnits;
  const estimates = buildCallEstimates({ missingScheduleUnits });
  const pe4i3Cache = verifyPe4I3SmokeCache(cwd);

  const protocol = pe4I2Protocol();
  const material = {
    planVersion: PE4I4_PLAN_VERSION,
    protocolDigest: digestPe4I2Protocol(protocol),
    units: clubSeasonUnits.map((u) => ({
      unitKey: u.unitKey,
      cached: u.cached,
    })),
    estimates,
  };
  const planDigest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return {
    planVersion: PE4I4_PLAN_VERSION,
    protocolVersion: PE4I2_PROTOCOL_VERSION,
    protocolDigest: digestPe4I2Protocol(protocol),
    planDigest,
    targetSeasons: ["2023", "2024"],
    uniqueClubs2023,
    uniqueClubs2024,
    clubSeasonUnits,
    cachedScheduleUnits,
    missingScheduleUnits,
    estimatedScheduleCalls: missingScheduleUnits,
    pe4i3Cache,
    estimates,
    stage1: {
      name: PE4I4_STAGE1_NAME,
      units: clubSeasonUnits.length,
      alreadyCached: cachedScheduleUnits,
      estimatedNewCalls: missingScheduleUnits,
      stopCondition:
        "All missing club-season schedules acquired OR budget exhausted; then build exact unique statistics queue and STOP (no Stage-2 calls)",
      statisticsCallsAllowed: false,
    },
    stage2: {
      name: PE4I4_STAGE2_NAME,
      requiresStage1ExactQueue: true,
      estimatedCallsRange: estimates.estimatedStatisticsCallsRange,
      stopCondition:
        "Each eligible unique fixture acquired exactly once OR batch maxCalls exhausted; resume-safe",
    },
    recommendedScheduleBatchBudget: PE4I4_RECOMMENDED_SCHEDULE_BATCH_BUDGET,
    recommendedStatisticsBatchBudget: PE4I4_RECOMMENDED_STATISTICS_BATCH_BUDGET,
    providerDailyAllowanceContext: PE4I4_PROVIDER_DAILY_ALLOWANCE_CONTEXT,
    xgStatus: PE4I4_XG_STATUS,
    holdoutSeason: PE4I2_HOLDOUT_SEASON,
    liveBulk: refusePe4I4LiveBulkExecution(),
    providerCallsMade: 0,
    liveEnabled: false,
  };
}

/**
 * Build Stage-2 primary statistics queue from discovered schedule envelopes.
 * Offline / post-Stage-1 only.
 */
export function buildPrimaryStatisticsQueue(input: {
  envelopes: readonly Pe4I2RawScheduleEnvelope[];
  acquisitionNowUtc: string;
}): {
  fixtureIds: string[];
  excluded: Array<{ fixtureId: string; reason: string }>;
  queueDigest: string;
} {
  const allRows = input.envelopes.flatMap((e) =>
    e.fixtures.map((f) => ({
      ...f,
      discoveredFromProviderSeason: e.requestedSeason,
    })),
  );
  const deduped = dedupeScheduleFixtures(allRows);
  if (!deduped.ok) {
    throw new Error(deduped.message);
  }
  const fixtureIds: string[] = [];
  const excluded: Array<{ fixtureId: string; reason: string }> = [];
  for (const f of deduped.fixtures) {
    const seasonRow = allRows.find(
      (r) => r.providerFixtureId === f.providerFixtureId,
    );
    const elig = evaluateStatisticsEligibility({
      providerFixtureId: f.providerFixtureId,
      status: f.status,
      kickoffUtc: f.kickoffUtc,
      providerCompetitionId: f.providerCompetitionId,
      competitionClass: f.competitionClass,
      discoveredFromProviderSeason:
        seasonRow?.discoveredFromProviderSeason ?? "2024",
      acquisitionNowUtc: input.acquisitionNowUtc,
    });
    if (elig.eligibleForPrimaryQueue) fixtureIds.push(f.providerFixtureId);
    else
      excluded.push({
        fixtureId: f.providerFixtureId,
        reason: elig.reason,
      });
  }
  fixtureIds.sort();
  return {
    fixtureIds,
    excluded,
    queueDigest: createHash("sha256")
      .update(fixtureIds.join("\n"), "utf8")
      .digest("hex"),
  };
}

/** Expose roster sizes for tests without inventing IDs. */
export function rosterCounts() {
  return {
    n2023: PE4I2_PL_TEAMS_2023.length,
    n2024: PE4I2_PL_TEAMS_2024.length,
    clubSeasonUnits: PE4I2_PL_TEAMS_2023.length + PE4I2_PL_TEAMS_2024.length,
  };
}
