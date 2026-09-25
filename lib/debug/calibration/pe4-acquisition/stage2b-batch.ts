/**
 * PE-4I.7 — Stage-2B second bounded statistics batch.
 * Same frozen queue / auth / hard max 150. Adds cumulative coverage.
 * No modeling.
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

export const PE4I7_STAGE2B_VERSION =
  "pe4.stage2b_statistics_batch.v1" as const;

export const PE4I7_ARTIFACT_SUBDIR = "stage2b-i7" as const;

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

function artifactRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I7_ARTIFACT_SUBDIR);
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

/** All successfully cached Stage-2 queue statistics envelopes (cumulative). */
export function loadCachedQueueStatisticsEnvelopes(input: {
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

function cardsCoverage(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
): number | null {
  const y = fieldPresentShare(envelopes, "yellow_cards");
  const r = fieldPresentShare(envelopes, "red_cards");
  if (y == null || r == null) return null;
  return Math.round(((y + r) / 2) * 1000) / 1000;
}

export type Pe4I7AetPenAuditRow = {
  providerFixtureId: string;
  status: string;
  kickoffUtc: string;
  competition: string | null;
  statisticsResponsePresent: boolean;
  regulationOnlyProven: false | "unknown";
  classification: "AMBIGUOUS_FOR_REGULATION_FEATURES" | "FT_OK" | "UNEXPECTED_STATUS";
  note: string;
};

export type Pe4I7CompetitionCoverageRow = {
  competition: string;
  fixturesSelected: number;
  callsAttempted: number;
  callsSucceeded: number;
  callsFailed: number;
  xgBothTeamFixtures: number;
  xgMissingFixtures: number;
  shotsCoveragePercent: number | null;
  shotsOnTargetCoveragePercent: number | null;
  possessionCoveragePercent: number | null;
  cornersCoveragePercent: number | null;
  cardsCoveragePercent: number | null;
};

export type Pe4I7Stage2BReport = {
  phase: "PE4I7_STAGE2B_STATISTICS_BATCH";
  stage2bVersion: typeof PE4I7_STAGE2B_VERSION;
  queueDigest: string;
  queueSize: number;
  configuredMaxCalls: number;
  selection: Pe4I6BatchSelection & {
    byCompetition: Record<string, number>;
    byProviderSeason: Record<string, number>;
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
  competitionCoverage: Pe4I7CompetitionCoverageRow[];
  aetPenAudit: Pe4I7AetPenAuditRow[];
  calendar2025FixturesInBatch: number;
  calendar2025FixtureIds: string[];
  holdout2025Status: "SEALED";
  xgStatusGlobal: typeof PE4I4_XG_STATUS;
  goalsNote: string;
  scheduleEndpointAttempts: number;
  artifactDigests: Record<string, string>;
  errors: string[];
};

export async function runPe4I7Stage2BStatisticsBatch(input: {
  transport: Pe4I2ProviderTransport;
  maxCalls: number;
  cwd?: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I7Stage2BReport> {
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
  if (baseSelection.initialCachedCount < 151) {
    throw new Error(
      `STOP: expected >=151 prior statistics cache hits before Stage-2B; got ${baseSelection.initialCachedCount}`,
    );
  }
  if (baseSelection.initialUncachedCount !== 943) {
    // Allow drift only if extra cache appeared; refuse if more uncached than expected.
    if (baseSelection.initialUncachedCount > 943) {
      throw new Error(
        `STOP: uncached ${baseSelection.initialUncachedCount} > expected 943 — cache integrity suspect`,
      );
    }
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
  };

  const statsTransport = createStatisticsOnlyTransport(input.transport);
  const acquiredAtUtc = input.acquiredAtUtc ?? new Date().toISOString();
  const errors: string[] = [];
  const budget = createPe4I2CallBudget(input.maxCalls);
  const unitResults: Pe4I7Stage2BReport["firstPass"]["unitResults"] = [];
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

  const byComp = new Map<
    string,
    {
      selected: string[];
      succeeded: string[];
      failed: string[];
      envelopes: Pe4I2RawStatisticsEnvelope[];
    }
  >();
  for (const id of selection.selectedFixtureIds) {
    const meta = metaMap.get(id);
    const comp =
      meta?.providerCompetitionName ??
      meta?.providerCompetitionId ??
      "unknown";
    if (!byComp.has(comp)) {
      byComp.set(comp, {
        selected: [],
        succeeded: [],
        failed: [],
        envelopes: [],
      });
    }
    byComp.get(comp)!.selected.push(id);
  }
  for (const u of unitResults) {
    const meta = metaMap.get(u.fixtureId);
    const comp =
      meta?.providerCompetitionName ??
      meta?.providerCompetitionId ??
      "unknown";
    const bucket = byComp.get(comp);
    if (!bucket) continue;
    if (u.ok) bucket.succeeded.push(u.fixtureId);
    else bucket.failed.push(u.fixtureId);
  }
  for (const env of successEnvelopes) {
    const meta = metaMap.get(env.providerFixtureId);
    const comp =
      meta?.providerCompetitionName ??
      meta?.providerCompetitionId ??
      "unknown";
    byComp.get(comp)?.envelopes.push(env);
  }

  const competitionCoverage: Pe4I7CompetitionCoverageRow[] = [
    ...byComp.entries(),
  ]
    .map(([competition, b]) => {
      const xgLocal = measureXgCoverage({
        envelopes: b.envelopes,
        metaByFixtureId: metaMap,
      });
      return {
        competition,
        fixturesSelected: b.selected.length,
        callsAttempted: b.succeeded.length + b.failed.length,
        callsSucceeded: b.succeeded.length,
        callsFailed: b.failed.length,
        xgBothTeamFixtures: xgLocal.fixturesWithBothTeams,
        xgMissingFixtures: xgLocal.fixturesWithoutXg,
        shotsCoveragePercent: fieldPresentShare(b.envelopes, "total_shots"),
        shotsOnTargetCoveragePercent: fieldPresentShare(
          b.envelopes,
          "shots_on_goal",
        ),
        possessionCoveragePercent: fieldPresentShare(
          b.envelopes,
          "ball_possession",
        ),
        cornersCoveragePercent: fieldPresentShare(b.envelopes, "corner_kicks"),
        cardsCoveragePercent: cardsCoverage(b.envelopes),
      };
    })
    .sort((a, b) => a.competition.localeCompare(b.competition));

  const aetPenAudit: Pe4I7AetPenAuditRow[] = [];
  for (const id of selection.selectedFixtureIds) {
    const meta = metaMap.get(id);
    const statsPresent = successfulIds.includes(id);
    if (!meta) {
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
    if (!isCompletedPrematchEvidenceStatus(meta.status)) {
      aetPenAudit.push({
        providerFixtureId: id,
        status: meta.status,
        kickoffUtc: meta.kickoffUtc,
        competition: meta.providerCompetitionName,
        statisticsResponsePresent: statsPresent,
        regulationOnlyProven: "unknown",
        classification: "UNEXPECTED_STATUS",
        note: "status not in completed evidence set — unexpected for Stage-2 queue",
      });
      continue;
    }
    const st = meta.status.trim().toUpperCase();
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
    stage2bVersion: PE4I7_STAGE2B_VERSION,
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
  put("competition-coverage.json", { competitionCoverage });
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
    phase: "PE4I7_STAGE2B_STATISTICS_BATCH",
    stage2bVersion: PE4I7_STAGE2B_VERSION,
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
    competitionCoverage,
    aetPenAudit,
    calendar2025FixturesInBatch: calendar2025FixtureIds.length,
    calendar2025FixtureIds,
    holdout2025Status: "SEALED",
    xgStatusGlobal: PE4I4_XG_STATUS,
    goalsNote:
      "Goals remain fixture-evidence sourced (schedule homeGoals/awayGoals); absence of goals in statistics endpoint is not label loss",
    scheduleEndpointAttempts: statsTransport.scheduleAttempts,
    artifactDigests,
    errors,
  };
}

export function pe4I7ArtifactDir(cwd = process.cwd()): string {
  return artifactRoot(cwd);
}
