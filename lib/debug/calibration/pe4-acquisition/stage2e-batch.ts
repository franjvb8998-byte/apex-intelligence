/**
 * PE-4I.10 — Stage-2E fifth bounded statistics batch.
 * Same frozen queue / auth / hard max 150. Adds cumulative competition coverage
 * matrix (observed-sample xG labels only — not model branches) + provider season
 * 2024 cumulative audit across all Stage-2 evidence. No modeling.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { acquireStatisticsUnit } from "@/lib/debug/calibration/pe4-acquisition/acquire-unit";
import { createPe4I2CallBudget } from "@/lib/debug/calibration/pe4-acquisition/budget";
import {
  createPe4I2AcquisitionCache,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import { calendarKickoffYear } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I4_XG_STATUS } from "@/lib/debug/calibration/pe4-acquisition/performance-fields";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  PE4I6_XG_COVERAGE_THRESHOLDS,
  PE4I7_CANONICAL_STATS_FIELDS,
  inventoryRawFields,
  measureFieldCoverage,
  measureXgCoverage,
  type Pe4I6FixtureMeta,
} from "@/lib/debug/calibration/pe4-acquisition/stage2a-coverage";
import { PE4I6_STAGE2A_HARD_MAX_CALLS } from "@/lib/debug/calibration/pe4-acquisition/stage2-auth";
import {
  isStatisticsCached,
  listStatisticsCaches,
  loadFrozenStage2Queue,
  selectStatisticsBatch,
  type Pe4I6BatchSelection,
} from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import { createStatisticsOnlyTransport } from "@/lib/debug/calibration/pe4-acquisition/statistics-only-transport";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";
import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";

export const PE4I10_STAGE2E_VERSION =
  "pe4.stage2e_statistics_batch.v1" as const;

export const PE4I10_ARTIFACT_SUBDIR = "stage2e-i10" as const;

/** Authoritative post-PE-4I.9 cache state before Stage-2E. */
export const PE4I10_EXPECTED_INITIAL_CACHE_HITS = 601 as const;
export const PE4I10_EXPECTED_INITIAL_UNCACHED = 493 as const;

/** Coverage labels only — NOT model branches / capability gates. */
export type Pe4I10ObservedXgLabel =
  | "XG_CAPABLE_IN_OBSERVED_SAMPLE"
  | "XG_PARTIAL_IN_OBSERVED_SAMPLE"
  | "XG_UNAVAILABLE_IN_OBSERVED_SAMPLE";

export function classifyObservedXgLabel(
  bothShare: number,
): Pe4I10ObservedXgLabel {
  if (bothShare >= 0.9) return "XG_CAPABLE_IN_OBSERVED_SAMPLE";
  if (bothShare >= 0.5) return "XG_PARTIAL_IN_OBSERVED_SAMPLE";
  return "XG_UNAVAILABLE_IN_OBSERVED_SAMPLE";
}

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

function artifactRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I10_ARTIFACT_SUBDIR);
}

function writeArtifact(
  dir: string,
  name: string,
  value: unknown,
): { path: string; digest: string } {
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  const body = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(filePath, body, "utf8");
  return {
    path: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    digest: createHash("sha256").update(body, "utf8").digest("hex"),
  };
}

type UniverseFixture = {
  providerFixtureId: string;
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  status: string;
  kickoffUtc: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

function loadFixtureMetaMap(cwd: string): Map<string, Pe4I6FixtureMeta> {
  const map = new Map<string, Pe4I6FixtureMeta>();
  const universePath = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "stage1-i5",
    "normalized-fixture-universe.json",
  );
  const seasonByFixture = new Map<string, string>();

  if (existsSync(universePath)) {
    const universe = JSON.parse(readFileSync(universePath, "utf8")) as {
      fixtures?: UniverseFixture[];
    };
    for (const f of universe.fixtures ?? []) {
      map.set(f.providerFixtureId, {
        providerFixtureId: f.providerFixtureId,
        providerCompetitionId: f.providerCompetitionId,
        providerCompetitionName: f.providerCompetitionName,
        status: f.status,
        kickoffUtc: f.kickoffUtc,
        providerSeason: null,
        calendarKickoffYear: calendarKickoffYear(f.kickoffUtc),
        homeGoals: f.homeGoals,
        awayGoals: f.awayGoals,
      });
    }
  }

  const bulk = createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  for (const unit of bulk.readManifest().units) {
    if (unit.kind !== "team_season_schedule" || unit.status !== "completed") {
      continue;
    }
    const raw = bulk.readRawJson(unit.unitKey) as {
      payload?: {
        requestedSeason?: string;
        fixtures?: Array<{ providerFixtureId: string }>;
      };
    } | null;
    const season = raw?.payload?.requestedSeason ?? null;
    if (!season || !raw?.payload?.fixtures) continue;
    for (const f of raw.payload.fixtures) {
      if (!seasonByFixture.has(f.providerFixtureId)) {
        seasonByFixture.set(f.providerFixtureId, season);
      }
    }
  }
  for (const [id, meta] of map) {
    const season = seasonByFixture.get(id) ?? null;
    if (season) map.set(id, { ...meta, providerSeason: season });
  }
  return map;
}

function readStatisticsEnvelope(
  fixtureId: string,
  caches: readonly Pe4I2AcquisitionCache[],
): Pe4I2RawStatisticsEnvelope | null {
  const key = statisticsUnitKey(fixtureId);
  for (const cache of caches) {
    const unit = cache.getUnit(key);
    if (unit?.status !== "completed") continue;
    const raw = cache.readRawJson(key) as {
      payload?: Pe4I2RawStatisticsEnvelope;
    } | null;
    if (raw?.payload) return raw.payload;
  }
  return null;
}

function loadCachedQueueStatisticsEnvelopes(input: {
  fixtureIds: readonly string[];
  caches: readonly Pe4I2AcquisitionCache[];
}): Pe4I2RawStatisticsEnvelope[] {
  const out: Pe4I2RawStatisticsEnvelope[] = [];
  for (const id of input.fixtureIds) {
    if (!isStatisticsCached(id, input.caches)) continue;
    const env = readStatisticsEnvelope(id, input.caches);
    if (env) out.push(env);
  }
  return out;
}

function countBy(
  ids: readonly string[],
  metaMap: ReadonlyMap<string, Pe4I6FixtureMeta>,
  keyOf: (m: Pe4I6FixtureMeta | undefined) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const k = keyOf(metaMap.get(id));
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])),
  );
}

function fieldPresentShare(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  field: (typeof PE4I7_CANONICAL_STATS_FIELDS)[number],
): number | null {
  const cov = measureFieldCoverage(envelopes, PE4I7_CANONICAL_STATS_FIELDS).find(
    (r) => r.field === field,
  );
  return cov?.coveragePercentAmongExpectedTeamSides ?? null;
}

export type Pe4I10AetPenAuditRow = {
  providerFixtureId: string;
  status: string;
  kickoffUtc: string;
  competition: string | null;
  statisticsResponsePresent: boolean;
  regulationOnlyProven: false | "unknown";
  classification:
    | "AMBIGUOUS_FOR_REGULATION_FEATURES"
    | "FT_OK"
    | "UNEXPECTED_STATUS";
  note: string;
};

export type Pe4I10StatusAuditRow = {
  providerFixtureId: string;
  status: string;
  competition: string | null;
  isOrdinaryFt: boolean;
  note: string;
};

export type Pe4I10CompetitionFieldCoverageRow = {
  competition: string;
  fixtureCount: number;
  expectedGoalsCoveragePercent: number | null;
  totalShotsCoveragePercent: number | null;
  shotsOnGoalCoveragePercent: number | null;
  possessionCoveragePercent: number | null;
  cornersCoveragePercent: number | null;
  yellowCardsCoveragePercent: number | null;
  redCardsCoveragePercent: number | null;
  xgBothTeamFixtures: number;
  xgOneTeamFixtures: number;
  xgMissingFixtures: number;
  fieldCoverage: ReturnType<typeof measureFieldCoverage>;
};

export type Pe4I10SeasonCoverageRow = {
  providerSeason: string;
  fixtureCount: number;
  expectedGoalsCoveragePercent: number | null;
  totalShotsCoveragePercent: number | null;
  shotsOnGoalCoveragePercent: number | null;
  possessionCoveragePercent: number | null;
  cornersCoveragePercent: number | null;
  yellowCardsCoveragePercent: number | null;
  redCardsCoveragePercent: number | null;
  xgBothTeamFixtures: number;
  xgMissingFixtures: number;
};

/** Cumulative competition coverage matrix row (observed-sample labels only). */
export type Pe4I10CompetitionCoverageMatrixRow = {
  competition: string;
  fixtureCount: number;
  xgBothTeamFixtures: number;
  xgOneTeamFixtures: number;
  xgMissingFixtures: number;
  xgBothTeamSharePercent: number | null;
  expectedGoalsCoveragePercent: number | null;
  totalShotsCoveragePercent: number | null;
  shotsOnGoalCoveragePercent: number | null;
  possessionCoveragePercent: number | null;
  cornersCoveragePercent: number | null;
  yellowCardsCoveragePercent: number | null;
  redCardsCoveragePercent: number | null;
  observedXgLabel: Pe4I10ObservedXgLabel;
  observedXgLabelNote: string;
};

/** Provider season 2024 audit across all Stage-2 cached evidence. */
export type Pe4I10ProviderSeason2024Coverage = {
  providerSeason: "2024";
  fixtureCount: number;
  competitionsRepresented: string[];
  xgBothTeamFixtures: number;
  xgOneTeamFixtures: number;
  xgMissingFixtures: number;
  xgBothTeamSharePercent: number | null;
  xgCoveragePercent: number | null;
  expectedGoalsCoveragePercent: number | null;
  totalShotsCoveragePercent: number | null;
  shotsOnGoalCoveragePercent: number | null;
  possessionCoveragePercent: number | null;
  cornersCoveragePercent: number | null;
  yellowCardsCoveragePercent: number | null;
  redCardsCoveragePercent: number | null;
};

function buildCompetitionFieldCoverage(
  label: string,
  fixtureIds: readonly string[],
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  metaMap: ReadonlyMap<string, Pe4I6FixtureMeta>,
): Pe4I10CompetitionFieldCoverageRow {
  const xgLocal = measureXgCoverage({
    envelopes,
    metaByFixtureId: metaMap,
  });
  return {
    competition: label,
    fixtureCount: fixtureIds.length,
    expectedGoalsCoveragePercent: fieldPresentShare(envelopes, "expected_goals"),
    totalShotsCoveragePercent: fieldPresentShare(envelopes, "total_shots"),
    shotsOnGoalCoveragePercent: fieldPresentShare(envelopes, "shots_on_goal"),
    possessionCoveragePercent: fieldPresentShare(envelopes, "ball_possession"),
    cornersCoveragePercent: fieldPresentShare(envelopes, "corner_kicks"),
    yellowCardsCoveragePercent: fieldPresentShare(envelopes, "yellow_cards"),
    redCardsCoveragePercent: fieldPresentShare(envelopes, "red_cards"),
    xgBothTeamFixtures: xgLocal.fixturesWithBothTeams,
    xgOneTeamFixtures: xgLocal.fixturesOneTeamOnly,
    xgMissingFixtures: xgLocal.fixturesWithoutXg,
    fieldCoverage: measureFieldCoverage(envelopes, PE4I7_CANONICAL_STATS_FIELDS),
  };
}

function buildCompetitionCoverageMatrixRow(
  label: string,
  fixtureIds: readonly string[],
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  metaMap: ReadonlyMap<string, Pe4I6FixtureMeta>,
): Pe4I10CompetitionCoverageMatrixRow {
  const xgLocal = measureXgCoverage({
    envelopes,
    metaByFixtureId: metaMap,
  });
  const n = envelopes.length;
  const bothShare = n === 0 ? 0 : xgLocal.fixturesWithBothTeams / n;
  const bothSharePercent =
    n === 0 ? null : Math.round(bothShare * 100000) / 1000;
  return {
    competition: label,
    fixtureCount: fixtureIds.length,
    xgBothTeamFixtures: xgLocal.fixturesWithBothTeams,
    xgOneTeamFixtures: xgLocal.fixturesOneTeamOnly,
    xgMissingFixtures: xgLocal.fixturesWithoutXg,
    xgBothTeamSharePercent: bothSharePercent,
    expectedGoalsCoveragePercent: fieldPresentShare(envelopes, "expected_goals"),
    totalShotsCoveragePercent: fieldPresentShare(envelopes, "total_shots"),
    shotsOnGoalCoveragePercent: fieldPresentShare(envelopes, "shots_on_goal"),
    possessionCoveragePercent: fieldPresentShare(envelopes, "ball_possession"),
    cornersCoveragePercent: fieldPresentShare(envelopes, "corner_kicks"),
    yellowCardsCoveragePercent: fieldPresentShare(envelopes, "yellow_cards"),
    redCardsCoveragePercent: fieldPresentShare(envelopes, "red_cards"),
    observedXgLabel: classifyObservedXgLabel(bothShare),
    observedXgLabelNote:
      "Coverage label from observed sample only — NOT a model branch or capability gate",
  };
}

function buildProviderSeason2024Coverage(
  fixtureIds: readonly string[],
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  metaMap: ReadonlyMap<string, Pe4I6FixtureMeta>,
): Pe4I10ProviderSeason2024Coverage | null {
  const seasonIds = fixtureIds.filter(
    (id) => metaMap.get(id)?.providerSeason === "2024",
  );
  const seasonEnvelopes = envelopes.filter(
    (env) => metaMap.get(env.providerFixtureId)?.providerSeason === "2024",
  );
  if (seasonIds.length === 0 && seasonEnvelopes.length === 0) {
    return null;
  }
  const xgLocal = measureXgCoverage({
    envelopes: seasonEnvelopes,
    metaByFixtureId: metaMap,
  });
  const n = seasonEnvelopes.length;
  const bothShare = n === 0 ? 0 : xgLocal.fixturesWithBothTeams / n;
  const competitions = new Set<string>();
  for (const id of seasonIds) {
    const meta = metaMap.get(id);
    competitions.add(
      meta?.providerCompetitionName ??
        meta?.providerCompetitionId ??
        "unknown",
    );
  }
  return {
    providerSeason: "2024",
    fixtureCount: seasonIds.length,
    competitionsRepresented: [...competitions].sort((a, b) => a.localeCompare(b)),
    xgBothTeamFixtures: xgLocal.fixturesWithBothTeams,
    xgOneTeamFixtures: xgLocal.fixturesOneTeamOnly,
    xgMissingFixtures: xgLocal.fixturesWithoutXg,
    xgBothTeamSharePercent:
      n === 0 ? null : Math.round(bothShare * 100000) / 1000,
    xgCoveragePercent: xgLocal.coveragePercent,
    expectedGoalsCoveragePercent: fieldPresentShare(
      seasonEnvelopes,
      "expected_goals",
    ),
    totalShotsCoveragePercent: fieldPresentShare(seasonEnvelopes, "total_shots"),
    shotsOnGoalCoveragePercent: fieldPresentShare(
      seasonEnvelopes,
      "shots_on_goal",
    ),
    possessionCoveragePercent: fieldPresentShare(
      seasonEnvelopes,
      "ball_possession",
    ),
    cornersCoveragePercent: fieldPresentShare(seasonEnvelopes, "corner_kicks"),
    yellowCardsCoveragePercent: fieldPresentShare(
      seasonEnvelopes,
      "yellow_cards",
    ),
    redCardsCoveragePercent: fieldPresentShare(seasonEnvelopes, "red_cards"),
  };
}

export type Pe4I10Stage2EReport = {
  phase: "PE4I10_STAGE2E_STATISTICS_BATCH";
  stage2eVersion: typeof PE4I10_STAGE2E_VERSION;
  queueDigest: string;
  queueSize: number;
  configuredMaxCalls: number;
  selection: Pe4I6BatchSelection & {
    byCompetition: Record<string, number>;
    byProviderSeason: Record<string, number>;
    byCalendarYear: Record<string, number>;
    byStatus: Record<string, number>;
  };
  firstPass: {
    providerCallsAttempted: number;
    providerCallsSucceeded: number;
    providerCallsFailed: number;
    newStatisticsCacheWrites: number;
    remainingCallBudget: number;
    unitResults: Array<{
      fixtureId: string;
      ok: boolean;
      cacheHit: boolean;
      contentDigest?: string;
      reason?: string;
      message?: string;
    }>;
  };
  remainingUncachedQueue: number;
  resumeVerification: {
    providerCalls: number;
    cacheHits: number;
    failures: number;
  };
  batchFieldCoverage: ReturnType<typeof measureFieldCoverage>;
  cumulativeFieldCoverage: ReturnType<typeof measureFieldCoverage>;
  cumulativeEnvelopeCount: number;
  rawFieldInventory: ReturnType<typeof inventoryRawFields>;
  batchXg: ReturnType<typeof measureXgCoverage>;
  cumulativeXg: ReturnType<typeof measureXgCoverage>;
  xgThresholdsDocumentedBeforeInspection: typeof PE4I6_XG_COVERAGE_THRESHOLDS;
  competitionSpecificCoverage: Pe4I10CompetitionFieldCoverageRow[];
  cumulativeCompetitionCoverage: Pe4I10CompetitionFieldCoverageRow[];
  competitionCoverageMatrix: Pe4I10CompetitionCoverageMatrixRow[];
  competitionCoverageMatrixNote: string;
  providerSeasonCoverage: Pe4I10SeasonCoverageRow[];
  providerSeason2024TransitionReached: boolean;
  providerSeason2024Coverage: Pe4I10ProviderSeason2024Coverage | null;
  crossCompetitionTransition: {
    reachedProviderSeason2024: boolean;
    reachedFaCup: boolean;
    reachedLeagueCup: boolean;
    reachedUcl: boolean;
    reachedUel: boolean;
    reachedUecl: boolean;
    competitionsObserved: string[];
    providerSeasonsObserved: string[];
    calendarYearsObserved: string[];
    statusesObserved: string[];
  };
  statusAudit: Pe4I10StatusAuditRow[];
  aetPenAudit: Pe4I10AetPenAuditRow[];
  calendar2025FixturesInBatch: number;
  calendar2025FixtureIds: string[];
  holdout2025Status: "SEALED";
  xgStatusGlobal: typeof PE4I4_XG_STATUS;
  goalsNote: string;
  cardSemanticsNote: string;
  scheduleEndpointAttempts: number;
  artifactDigests: Record<string, string>;
  errors: string[];
};

export async function runPe4I10Stage2EStatisticsBatch(input: {
  transport: Pe4I2ProviderTransport;
  maxCalls: number;
  cwd?: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I10Stage2EReport> {
  const cwd = input.cwd ?? process.cwd();
  if (input.maxCalls > PE4I6_STAGE2A_HARD_MAX_CALLS) {
    throw new Error(
      `maxCalls ${input.maxCalls} exceeds Stage-2 hard max ${PE4I6_STAGE2A_HARD_MAX_CALLS}`,
    );
  }

  const queue = loadFrozenStage2Queue(cwd);
  const readCaches = listStatisticsCaches(cwd);
  mkdirSync(bulkCacheRoot(cwd), { recursive: true });
  const writeCache = createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  const selectionCaches: Pe4I2AcquisitionCache[] = [
    writeCache,
    ...readCaches.filter((c) => c.rootDir !== writeCache.rootDir),
  ];

  const baseSelection = selectStatisticsBatch({
    fixtureIds: queue.fixtureIds,
    queueDigest: queue.queueDigest,
    caches: selectionCaches,
    maxNew: input.maxCalls,
  });
  if (baseSelection.selectedBatchSize > input.maxCalls) {
    throw new Error("STOP: selected batch exceeds maxCalls");
  }
  if (baseSelection.initialCachedCount !== PE4I10_EXPECTED_INITIAL_CACHE_HITS) {
    throw new Error(
      `STOP: expected exactly ${PE4I10_EXPECTED_INITIAL_CACHE_HITS} statistics cache hits before Stage-2E; got ${baseSelection.initialCachedCount}`,
    );
  }
  if (baseSelection.initialUncachedCount !== PE4I10_EXPECTED_INITIAL_UNCACHED) {
    throw new Error(
      `STOP: expected exactly ${PE4I10_EXPECTED_INITIAL_UNCACHED} uncached before Stage-2E; got ${baseSelection.initialUncachedCount}`,
    );
  }

  const metaMap = loadFixtureMetaMap(cwd);
  const selection = {
    ...baseSelection,
    byCompetition: countBy(
      baseSelection.selectedFixtureIds,
      metaMap,
      (m) => m?.providerCompetitionName ?? m?.providerCompetitionId ?? "unknown",
    ),
    byProviderSeason: countBy(
      baseSelection.selectedFixtureIds,
      metaMap,
      (m) => m?.providerSeason ?? "unknown",
    ),
    byCalendarYear: countBy(
      baseSelection.selectedFixtureIds,
      metaMap,
      (m) =>
        m?.calendarKickoffYear == null
          ? "unknown"
          : String(m.calendarKickoffYear),
    ),
    byStatus: countBy(
      baseSelection.selectedFixtureIds,
      metaMap,
      (m) => m?.status ?? "unknown",
    ),
  };

  const statsTransport = createStatisticsOnlyTransport(input.transport);
  const acquiredAtUtc = input.acquiredAtUtc ?? new Date().toISOString();
  const errors: string[] = [];
  const budget = createPe4I2CallBudget(input.maxCalls);
  const unitResults: Pe4I10Stage2EReport["firstPass"]["unitResults"] = [];
  let newWrites = 0;

  for (const fixtureId of selection.selectedFixtureIds) {
    const res = await acquireStatisticsUnit({
      transport: statsTransport,
      budget,
      cache: writeCache,
      providerFixtureId: fixtureId,
      acquiredAtUtc,
    });
    if (res.ok) {
      if (!res.cacheHit) newWrites += 1;
      unitResults.push({
        fixtureId,
        ok: true,
        cacheHit: res.cacheHit,
        contentDigest: res.contentDigest,
      });
    } else {
      unitResults.push({
        fixtureId,
        ok: false,
        cacheHit: false,
        reason: res.reason,
        message: res.message,
      });
      errors.push(`${fixtureId}: ${res.reason}: ${res.message}`);
    }
  }

  const snap = budget.snapshot();
  const cachesAfter: Pe4I2AcquisitionCache[] = [
    writeCache,
    ...readCaches.filter((c) => c.rootDir !== writeCache.rootDir),
  ];

  const successEnvelopes: Pe4I2RawStatisticsEnvelope[] = [];
  const successfulIds: string[] = [];
  const failedIds: string[] = [];
  for (const u of unitResults) {
    if (!u.ok) {
      failedIds.push(u.fixtureId);
      continue;
    }
    successfulIds.push(u.fixtureId);
    const env = readStatisticsEnvelope(u.fixtureId, cachesAfter);
    if (env) successEnvelopes.push(env);
    else errors.push(`missing stats envelope for ${u.fixtureId}`);
  }

  const cumulativeEnvelopes = loadCachedQueueStatisticsEnvelopes({
    fixtureIds: queue.fixtureIds,
    caches: cachesAfter,
  });

  const batchFieldCoverage = measureFieldCoverage(
    successEnvelopes,
    PE4I7_CANONICAL_STATS_FIELDS,
  );
  const cumulativeFieldCoverage = measureFieldCoverage(
    cumulativeEnvelopes,
    PE4I7_CANONICAL_STATS_FIELDS,
  );
  const rawFieldInventory = inventoryRawFields(successEnvelopes);
  const batchXg = measureXgCoverage({
    envelopes: successEnvelopes,
    metaByFixtureId: metaMap,
  });
  const cumulativeXg = measureXgCoverage({
    envelopes: cumulativeEnvelopes,
    metaByFixtureId: metaMap,
  });

  const groupByCompetition = (
    fixtureIds: readonly string[],
    envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  ): Pe4I10CompetitionFieldCoverageRow[] => {
    const byComp = new Map<
      string,
      { ids: string[]; envelopes: Pe4I2RawStatisticsEnvelope[] }
    >();
    for (const id of fixtureIds) {
      const meta = metaMap.get(id);
      const comp =
        meta?.providerCompetitionName ??
        meta?.providerCompetitionId ??
        "unknown";
      if (!byComp.has(comp)) byComp.set(comp, { ids: [], envelopes: [] });
      byComp.get(comp)!.ids.push(id);
    }
    for (const env of envelopes) {
      const meta = metaMap.get(env.providerFixtureId);
      const comp =
        meta?.providerCompetitionName ??
        meta?.providerCompetitionId ??
        "unknown";
      byComp.get(comp)?.envelopes.push(env);
    }
    return [...byComp.entries()]
      .map(([competition, b]) =>
        buildCompetitionFieldCoverage(
          competition,
          b.ids,
          b.envelopes,
          metaMap,
        ),
      )
      .sort((a, b) => a.competition.localeCompare(b.competition));
  };

  const competitionSpecificCoverage = groupByCompetition(
    successfulIds,
    successEnvelopes,
  );
  const cumulativeCachedIds = queue.fixtureIds.filter((id) =>
    isStatisticsCached(id, cachesAfter),
  );
  const cumulativeCompetitionCoverage = groupByCompetition(
    cumulativeCachedIds,
    cumulativeEnvelopes,
  );

  const competitionCoverageMatrix: Pe4I10CompetitionCoverageMatrixRow[] = (() => {
    const byComp = new Map<
      string,
      { ids: string[]; envelopes: Pe4I2RawStatisticsEnvelope[] }
    >();
    for (const id of cumulativeCachedIds) {
      const meta = metaMap.get(id);
      const comp =
        meta?.providerCompetitionName ??
        meta?.providerCompetitionId ??
        "unknown";
      if (!byComp.has(comp)) byComp.set(comp, { ids: [], envelopes: [] });
      byComp.get(comp)!.ids.push(id);
    }
    for (const env of cumulativeEnvelopes) {
      const meta = metaMap.get(env.providerFixtureId);
      const comp =
        meta?.providerCompetitionName ??
        meta?.providerCompetitionId ??
        "unknown";
      byComp.get(comp)?.envelopes.push(env);
    }
    return [...byComp.entries()]
      .map(([competition, b]) =>
        buildCompetitionCoverageMatrixRow(
          competition,
          b.ids,
          b.envelopes,
          metaMap,
        ),
      )
      .sort((a, b) => a.competition.localeCompare(b.competition));
  })();

  const competitionCoverageMatrixNote =
    "observedXgLabel values are coverage labels from the observed sample only — NOT model branches, capability gates, or production routing decisions.";

  const bySeason = new Map<
    string,
    {
      ids: string[];
      envelopes: Pe4I2RawStatisticsEnvelope[];
    }
  >();
  for (const id of successfulIds) {
    const season = metaMap.get(id)?.providerSeason ?? "unknown";
    if (!bySeason.has(season)) {
      bySeason.set(season, { ids: [], envelopes: [] });
    }
    bySeason.get(season)!.ids.push(id);
  }
  for (const env of successEnvelopes) {
    const season =
      metaMap.get(env.providerFixtureId)?.providerSeason ?? "unknown";
    bySeason.get(season)?.envelopes.push(env);
  }
  const providerSeasonCoverage: Pe4I10SeasonCoverageRow[] = [...bySeason.entries()]
    .map(([season, b]) => {
      const xgLocal = measureXgCoverage({
        envelopes: b.envelopes,
        metaByFixtureId: metaMap,
      });
      return {
        providerSeason: season,
        fixtureCount: b.ids.length,
        expectedGoalsCoveragePercent: fieldPresentShare(
          b.envelopes,
          "expected_goals",
        ),
        totalShotsCoveragePercent: fieldPresentShare(b.envelopes, "total_shots"),
        shotsOnGoalCoveragePercent: fieldPresentShare(
          b.envelopes,
          "shots_on_goal",
        ),
        possessionCoveragePercent: fieldPresentShare(
          b.envelopes,
          "ball_possession",
        ),
        cornersCoveragePercent: fieldPresentShare(b.envelopes, "corner_kicks"),
        yellowCardsCoveragePercent: fieldPresentShare(
          b.envelopes,
          "yellow_cards",
        ),
        redCardsCoveragePercent: fieldPresentShare(b.envelopes, "red_cards"),
        xgBothTeamFixtures: xgLocal.fixturesWithBothTeams,
        xgMissingFixtures: xgLocal.fixturesWithoutXg,
      };
    })
    .sort((a, b) => a.providerSeason.localeCompare(b.providerSeason));

  const compsObserved = Object.keys(selection.byCompetition).sort();
  const seasonsObserved = Object.keys(selection.byProviderSeason).sort();
  const yearsObserved = Object.keys(selection.byCalendarYear).sort();
  const statusesObserved = Object.keys(selection.byStatus).sort();
  const reachedProviderSeason2024 = seasonsObserved.includes("2024");
  const crossCompetitionTransition = {
    reachedProviderSeason2024,
    reachedFaCup: compsObserved.some(
      (c) => c === "FA Cup" || c.toLowerCase().includes("fa cup"),
    ),
    reachedLeagueCup: compsObserved.some(
      (c) =>
        c === "League Cup" ||
        c.toLowerCase().includes("league cup") ||
        c.toLowerCase().includes("efl cup"),
    ),
    reachedUcl: compsObserved.some((c) =>
      c.toLowerCase().includes("champions league"),
    ),
    reachedUel: compsObserved.some(
      (c) =>
        c.toLowerCase().includes("europa league") &&
        !c.toLowerCase().includes("conference"),
    ),
    reachedUecl: compsObserved.some((c) =>
      c.toLowerCase().includes("conference league"),
    ),
    competitionsObserved: compsObserved,
    providerSeasonsObserved: seasonsObserved,
    calendarYearsObserved: yearsObserved,
    statusesObserved,
  };

  const providerSeason2024Coverage = buildProviderSeason2024Coverage(
    cumulativeCachedIds,
    cumulativeEnvelopes,
    metaMap,
  );

  const statusAudit: Pe4I10StatusAuditRow[] = [];
  const aetPenAudit: Pe4I10AetPenAuditRow[] = [];
  for (const id of selection.selectedFixtureIds) {
    const meta = metaMap.get(id);
    const statsPresent = successfulIds.includes(id);
    if (!meta) {
      statusAudit.push({
        providerFixtureId: id,
        status: "UNKNOWN",
        competition: null,
        isOrdinaryFt: false,
        note: "fixture meta missing from Stage-1 universe",
      });
      aetPenAudit.push({
        providerFixtureId: id,
        status: "UNKNOWN",
        kickoffUtc: "",
        competition: null,
        statisticsResponsePresent: statsPresent,
        regulationOnlyProven: "unknown",
        classification: "UNEXPECTED_STATUS",
        note: "fixture meta missing from Stage-1 universe",
      });
      continue;
    }

    const st = meta.status.trim().toUpperCase();
    const isOrdinaryFt = st === "FT";
    if (!isOrdinaryFt) {
      statusAudit.push({
        providerFixtureId: id,
        status: meta.status,
        competition: meta.providerCompetitionName,
        isOrdinaryFt: false,
        note: `non-ordinary status ${meta.status}`,
      });
    }

    if (!isCompletedPrematchEvidenceStatus(meta.status)) {
      aetPenAudit.push({
        providerFixtureId: id,
        status: meta.status,
        kickoffUtc: meta.kickoffUtc,
        competition: meta.providerCompetitionName,
        statisticsResponsePresent: statsPresent,
        regulationOnlyProven: "unknown",
        classification: "UNEXPECTED_STATUS",
        note:
          "status not in completed evidence set (FT/AET/PEN) — unexpected for Stage-2 queue",
      });
      continue;
    }
    if (st === "AET" || st === "PEN") {
      aetPenAudit.push({
        providerFixtureId: id,
        status: meta.status,
        kickoffUtc: meta.kickoffUtc,
        competition: meta.providerCompetitionName,
        statisticsResponsePresent: statsPresent,
        regulationOnlyProven: false,
        classification: "AMBIGUOUS_FOR_REGULATION_FEATURES",
        note:
          "AET/PEN: provider statistics cannot be proven regulation-only; flag AMBIGUOUS — do not use as regulation-90 features",
      });
    }
  }

  const calendar2025FixtureIds = selection.selectedFixtureIds.filter((id) => {
    const meta = metaMap.get(id);
    return meta?.calendarKickoffYear === 2025;
  });

  let remainingUncached = 0;
  for (const id of queue.fixtureIds) {
    if (!isStatisticsCached(id, cachesAfter)) remainingUncached += 1;
  }

  let resumeCacheHits = 0;
  let resumeFailures = 0;
  for (const u of unitResults) {
    if (u.ok) {
      if (isStatisticsCached(u.fixtureId, cachesAfter)) resumeCacheHits += 1;
      else {
        resumeFailures += 1;
        errors.push(`resume: successful unit missing from cache ${u.fixtureId}`);
      }
    } else {
      resumeFailures += 1;
    }
  }

  const artDir = artifactRoot(cwd);
  const artifactDigests: Record<string, string> = {};

  const put = (name: string, value: unknown) => {
    const a = writeArtifact(artDir, name, value);
    artifactDigests[name] = a.digest;
  };

  put("batch-manifest.json", {
    stage2eVersion: PE4I10_STAGE2E_VERSION,
    acquiredAtUtc,
    configuredMaxCalls: input.maxCalls,
    queueDigest: queue.queueDigest,
    selection,
    firstPassBudget: snap,
    unitResults,
  });
  put("attempted-fixture-ids.json", {
    fixtureIds: selection.selectedFixtureIds,
    digest: selection.batchSelectionDigest,
  });
  put("successful-fixture-ids.json", { fixtureIds: successfulIds });
  put("failed-fixture-ids.json", {
    fixtureIds: failedIds,
    details: unitResults.filter((u) => !u.ok),
  });
  put("batch-field-coverage.json", { fieldCoverage: batchFieldCoverage });
  put("cumulative-field-coverage.json", {
    envelopeCount: cumulativeEnvelopes.length,
    fieldCoverage: cumulativeFieldCoverage,
  });
  put("batch-xg-coverage.json", {
    thresholds: PE4I6_XG_COVERAGE_THRESHOLDS,
    xg: batchXg,
  });
  put("cumulative-xg-coverage.json", {
    thresholds: PE4I6_XG_COVERAGE_THRESHOLDS,
    envelopeCount: cumulativeEnvelopes.length,
    xg: cumulativeXg,
  });
  put("competition-coverage.json", { competitionSpecificCoverage });
  put("cumulative-competition-coverage.json", {
    cumulativeCompetitionCoverage,
  });
  put("competition-coverage-matrix.json", {
    note: competitionCoverageMatrixNote,
    competitionCoverageMatrix,
  });
  put("provider-season-coverage.json", {
    providerSeasonCoverage,
    providerSeason2024TransitionReached: reachedProviderSeason2024,
  });
  put("provider-season-2024-coverage.json", {
    note: "Cumulative audit across ALL acquired Stage-2 evidence (not batch-only)",
    providerSeason2024Coverage,
  });
  put("calendar-year-coverage.json", {
    byCalendarYear: selection.byCalendarYear,
    xgByCalendarYear: batchXg.byCalendarYear,
    cumulativeXgByCalendarYear: cumulativeXg.byCalendarYear,
  });
  put("cross-competition-transition.json", { crossCompetitionTransition });
  put("status-audit.json", {
    byStatus: selection.byStatus,
    nonOrdinaryFt: statusAudit,
  });
  put("raw-field-inventory.json", { rawFieldInventory });
  put("aet-pen-audit.json", { aetPenAudit });
  put("calendar-2025-audit.json", {
    count: calendar2025FixtureIds.length,
    fixtureIds: calendar2025FixtureIds,
  });
  put("call-accounting.json", {
    configuredMaxCalls: input.maxCalls,
    queueSize: queue.fixtureIds.length,
    initialStatisticsCacheHits: selection.initialCachedCount,
    initialUncachedFixtures: selection.initialUncachedCount,
    selectedBatchSize: selection.selectedBatchSize,
    providerCallsAttempted: snap.attempted,
    providerCallsSucceeded: snap.succeeded,
    providerCallsFailed: snap.failed,
    newStatisticsCacheWrites: newWrites,
    remainingCallBudget: snap.remaining,
    remainingUncachedQueueAfterBatch: remainingUncached,
    scheduleEndpointAttempts: statsTransport.scheduleAttempts,
  });
  put("resume-verification.json", {
    resumeVerificationProviderCalls: 0,
    resumeVerificationCacheHits: resumeCacheHits,
    resumeVerificationFailures: resumeFailures,
  });

  return {
    phase: "PE4I10_STAGE2E_STATISTICS_BATCH",
    stage2eVersion: PE4I10_STAGE2E_VERSION,
    queueDigest: queue.queueDigest,
    queueSize: queue.fixtureIds.length,
    configuredMaxCalls: input.maxCalls,
    selection,
    firstPass: {
      providerCallsAttempted: snap.attempted,
      providerCallsSucceeded: snap.succeeded,
      providerCallsFailed: snap.failed,
      newStatisticsCacheWrites: newWrites,
      remainingCallBudget: snap.remaining,
      unitResults,
    },
    remainingUncachedQueue: remainingUncached,
    resumeVerification: {
      providerCalls: 0,
      cacheHits: resumeCacheHits,
      failures: resumeFailures,
    },
    batchFieldCoverage,
    cumulativeFieldCoverage,
    cumulativeEnvelopeCount: cumulativeEnvelopes.length,
    rawFieldInventory,
    batchXg,
    cumulativeXg,
    xgThresholdsDocumentedBeforeInspection: PE4I6_XG_COVERAGE_THRESHOLDS,
    competitionSpecificCoverage,
    cumulativeCompetitionCoverage,
    competitionCoverageMatrix,
    competitionCoverageMatrixNote,
    providerSeasonCoverage,
    providerSeason2024TransitionReached: reachedProviderSeason2024,
    providerSeason2024Coverage,
    crossCompetitionTransition,
    statusAudit,
    aetPenAudit,
    calendar2025FixturesInBatch: calendar2025FixtureIds.length,
    calendar2025FixtureIds,
    holdout2025Status: "SEALED",
    xgStatusGlobal: PE4I4_XG_STATUS,
    goalsNote:
      "Goals remain fixture-evidence sourced (schedule homeGoals/awayGoals); absence of goals in statistics endpoint is not label loss",
    cardSemanticsNote:
      "Null card fields are missing, NOT zero. Do not infer missing Red Cards = 0.",
    scheduleEndpointAttempts: statsTransport.scheduleAttempts,
    artifactDigests,
    errors,
  };
}

export function pe4I10ArtifactDir(cwd = process.cwd()): string {
  return artifactRoot(cwd);
}
