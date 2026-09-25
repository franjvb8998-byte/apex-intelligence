/**
 * PE-4I.6 — Stage-2A bounded fixture statistics acquisition (first batch).
 * Hard max 150 NEW provider statistics calls. No modeling.
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
  inventoryRawFields,
  measureFieldCoverage,
  measureXgCoverage,
  type Pe4I6FixtureMeta,
} from "@/lib/debug/calibration/pe4-acquisition/stage2a-coverage";
import { PE4I6_STAGE2A_HARD_MAX_CALLS } from "@/lib/debug/calibration/pe4-acquisition/stage2-auth";
import {
  listStatisticsCaches,
  loadFrozenStage2Queue,
  selectStatisticsBatch,
  type Pe4I6BatchSelection,
} from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import { createStatisticsOnlyTransport } from "@/lib/debug/calibration/pe4-acquisition/statistics-only-transport";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";
import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";

export const PE4I6_STAGE2A_VERSION =
  "pe4.stage2a_statistics_batch.v1" as const;

export const PE4I6_ARTIFACT_SUBDIR = "stage2a-i6" as const;

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

function artifactRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I6_ARTIFACT_SUBDIR);
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
  const spillPath = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "stage1-i5",
    "calendar-2025-spill.json",
  );

  // Discover provider season from schedule envelopes in bulk/smoke caches.
  const seasonByFixture = new Map<string, string>();
  for (const sub of ["bulk", "smoke-i3"]) {
    const rawDir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, sub, "raw");
    if (!existsSync(rawDir)) continue;
    // Prefer reading stage1 universe + spill; season from schedule unit envelopes
    // is loaded below via manifest units when needed.
  }

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

  // Load provider season from schedule envelopes in bulk cache.
  const bulk = createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  const manifest = bulk.readManifest();
  for (const unit of manifest.units) {
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
    if (season) {
      map.set(id, { ...meta, providerSeason: season });
    }
  }

  void spillPath;
  return map;
}

export type Pe4I6CompetitionCoverageRow = {
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

export type Pe4I6AetPenAuditRow = {
  providerFixtureId: string;
  status: string;
  kickoffUtc: string;
  competition: string | null;
  note: string;
};

export type Pe4I6Stage2AReport = {
  phase: "PE4I6_STAGE2A_STATISTICS_BATCH";
  stage2aVersion: typeof PE4I6_STAGE2A_VERSION;
  queueDigest: string;
  queueSize: number;
  configuredMaxCalls: number;
  selection: Pe4I6BatchSelection;
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
  fieldCoverage: ReturnType<typeof measureFieldCoverage>;
  rawFieldInventory: ReturnType<typeof inventoryRawFields>;
  xg: ReturnType<typeof measureXgCoverage>;
  xgThresholdsDocumentedBeforeInspection: typeof PE4I6_XG_COVERAGE_THRESHOLDS;
  competitionCoverage: Pe4I6CompetitionCoverageRow[];
  aetPenAudit: Pe4I6AetPenAuditRow[];
  calendar2025FixturesInBatch: number;
  calendar2025FixtureIds: string[];
  holdout2025Status: "SEALED";
  xgStatusGlobal: typeof PE4I4_XG_STATUS;
  scheduleEndpointAttempts: number;
  artifactDigests: Record<string, string>;
  errors: string[];
};

function fieldPresentShare(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  field:
    | "total_shots"
    | "shots_on_goal"
    | "ball_possession"
    | "corner_kicks"
    | "yellow_cards"
    | "red_cards",
): number | null {
  const cov = measureFieldCoverage(envelopes).find((r) => r.field === field);
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

export async function runPe4I6Stage2AStatisticsBatch(input: {
  transport: Pe4I2ProviderTransport;
  maxCalls: number;
  cwd?: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I6Stage2AReport> {
  const cwd = input.cwd ?? process.cwd();
  if (input.maxCalls > PE4I6_STAGE2A_HARD_MAX_CALLS) {
    throw new Error(
      `maxCalls ${input.maxCalls} exceeds Stage-2A hard max ${PE4I6_STAGE2A_HARD_MAX_CALLS}`,
    );
  }

  const queue = loadFrozenStage2Queue(cwd);
  const readCaches = listStatisticsCaches(cwd);
  mkdirSync(bulkCacheRoot(cwd), { recursive: true });
  const writeCache = createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  // Selection sees smoke + bulk; writes go to bulk only.
  const selectionCaches: Pe4I2AcquisitionCache[] = [
    writeCache,
    ...readCaches.filter((c) => c.rootDir !== writeCache.rootDir),
  ];

  const selection = selectStatisticsBatch({
    fixtureIds: queue.fixtureIds,
    queueDigest: queue.queueDigest,
    caches: selectionCaches,
    maxNew: input.maxCalls,
  });

  if (selection.selectedBatchSize > input.maxCalls) {
    throw new Error("STOP: selected batch exceeds maxCalls");
  }

  const statsTransport = createStatisticsOnlyTransport(input.transport);
  const acquiredAtUtc = input.acquiredAtUtc ?? new Date().toISOString();
  const metaMap = loadFixtureMetaMap(cwd);
  const errors: string[] = [];
  const budget = createPe4I2CallBudget(input.maxCalls);
  const unitResults: Pe4I6Stage2AReport["firstPass"]["unitResults"] = [];
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

  // Load successful envelopes for coverage.
  const successEnvelopes: Pe4I2RawStatisticsEnvelope[] = [];
  const successfulIds: string[] = [];
  const failedIds: string[] = [];
  for (const u of unitResults) {
    if (!u.ok) {
      failedIds.push(u.fixtureId);
      continue;
    }
    successfulIds.push(u.fixtureId);
    const raw = writeCache.readRawJson(statisticsUnitKey(u.fixtureId)) as {
      payload?: Pe4I2RawStatisticsEnvelope;
    } | null;
    // Also try smoke if write miss (should not happen for new writes).
    let envelope = raw?.payload ?? null;
    if (!envelope) {
      for (const c of readCaches) {
        const r = c.readRawJson(statisticsUnitKey(u.fixtureId)) as {
          payload?: Pe4I2RawStatisticsEnvelope;
        } | null;
        if (r?.payload) {
          envelope = r.payload;
          break;
        }
      }
    }
    if (envelope) successEnvelopes.push(envelope);
    else errors.push(`missing stats envelope for ${u.fixtureId}`);
  }

  const fieldCoverage = measureFieldCoverage(successEnvelopes);
  const rawFieldInventory = inventoryRawFields(successEnvelopes);
  const xg = measureXgCoverage({
    envelopes: successEnvelopes,
    metaByFixtureId: metaMap,
  });

  // Competition coverage
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

  const competitionCoverage: Pe4I6CompetitionCoverageRow[] = [...byComp.entries()]
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

  // AET/PEN audit
  const aetPenAudit: Pe4I6AetPenAuditRow[] = [];
  for (const id of selection.selectedFixtureIds) {
    const meta = metaMap.get(id);
    if (!meta) {
      aetPenAudit.push({
        providerFixtureId: id,
        status: "UNKNOWN",
        kickoffUtc: "",
        competition: null,
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
        note:
          "AET/PEN: provider statistics do not distinguish regulation vs extra-time values; flag for audit — do not invent regulation-only stats",
      });
    }
  }

  const calendar2025FixtureIds = selection.selectedFixtureIds.filter((id) => {
    const meta = metaMap.get(id);
    return meta?.calendarKickoffYear === 2025;
  });

  // Remaining uncached after batch
  const cachesAfter = [
    writeCache,
    ...readCaches.filter((c) => c.rootDir !== writeCache.rootDir),
  ];
  let remainingUncached = 0;
  for (const id of queue.fixtureIds) {
    const key = statisticsUnitKey(id);
    let hit = false;
    for (const c of cachesAfter) {
      const u = c.getUnit(key);
      if (u?.status === "completed" && u.contentDigest) {
        hit = true;
        break;
      }
    }
    if (!hit) remainingUncached += 1;
  }

  // Offline resume verification — zero provider calls
  let resumeCacheHits = 0;
  let resumeFailures = 0;
  for (const u of unitResults) {
    if (u.ok) {
      const key = statisticsUnitKey(u.fixtureId);
      const unit = writeCache.getUnit(key);
      if (unit?.status === "completed" && unit.contentDigest) {
        resumeCacheHits += 1;
      } else {
        // check smoke
        let found = false;
        for (const c of readCaches) {
          const uu = c.getUnit(key);
          if (uu?.status === "completed" && uu.contentDigest) {
            found = true;
            break;
          }
        }
        if (found) resumeCacheHits += 1;
        else {
          resumeFailures += 1;
          errors.push(`resume: successful unit missing from cache ${u.fixtureId}`);
        }
      }
    } else {
      // Failures remain explicit — count as verification failures (not successes)
      resumeFailures += 1;
    }
  }

  const artDir = artifactRoot(cwd);
  const artifactDigests: Record<string, string> = {};

  const a1 = writeArtifact(artDir, "batch-manifest.json", {
    stage2aVersion: PE4I6_STAGE2A_VERSION,
    acquiredAtUtc,
    configuredMaxCalls: input.maxCalls,
    queueDigest: queue.queueDigest,
    selection,
    firstPassBudget: snap,
    unitResults,
  });
  artifactDigests["batch-manifest.json"] = a1.digest;

  const a2 = writeArtifact(artDir, "attempted-fixture-ids.json", {
    fixtureIds: selection.selectedFixtureIds,
    digest: selection.batchSelectionDigest,
  });
  artifactDigests["attempted-fixture-ids.json"] = a2.digest;

  const a3 = writeArtifact(artDir, "successful-fixture-ids.json", {
    fixtureIds: successfulIds,
  });
  artifactDigests["successful-fixture-ids.json"] = a3.digest;

  const a4 = writeArtifact(artDir, "failed-fixture-ids.json", {
    fixtureIds: failedIds,
    details: unitResults.filter((u) => !u.ok),
  });
  artifactDigests["failed-fixture-ids.json"] = a4.digest;

  const a5 = writeArtifact(artDir, "field-coverage.json", { fieldCoverage });
  artifactDigests["field-coverage.json"] = a5.digest;

  const a6 = writeArtifact(artDir, "xg-coverage.json", {
    thresholds: PE4I6_XG_COVERAGE_THRESHOLDS,
    xg,
  });
  artifactDigests["xg-coverage.json"] = a6.digest;

  const a7 = writeArtifact(artDir, "competition-coverage.json", {
    competitionCoverage,
  });
  artifactDigests["competition-coverage.json"] = a7.digest;

  const a8 = writeArtifact(artDir, "raw-field-inventory.json", {
    rawFieldInventory,
  });
  artifactDigests["raw-field-inventory.json"] = a8.digest;

  const a9 = writeArtifact(artDir, "aet-pen-audit.json", { aetPenAudit });
  artifactDigests["aet-pen-audit.json"] = a9.digest;

  const a10 = writeArtifact(artDir, "call-accounting.json", {
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
  artifactDigests["call-accounting.json"] = a10.digest;

  const a11 = writeArtifact(artDir, "resume-verification.json", {
    resumeVerificationProviderCalls: 0,
    resumeVerificationCacheHits: resumeCacheHits,
    resumeVerificationFailures: resumeFailures,
  });
  artifactDigests["resume-verification.json"] = a11.digest;

  return {
    phase: "PE4I6_STAGE2A_STATISTICS_BATCH",
    stage2aVersion: PE4I6_STAGE2A_VERSION,
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
    fieldCoverage,
    rawFieldInventory,
    xg,
    xgThresholdsDocumentedBeforeInspection: PE4I6_XG_COVERAGE_THRESHOLDS,
    competitionCoverage,
    aetPenAudit,
    calendar2025FixturesInBatch: calendar2025FixtureIds.length,
    calendar2025FixtureIds,
    holdout2025Status: "SEALED",
    xgStatusGlobal: PE4I4_XG_STATUS,
    scheduleEndpointAttempts: statsTransport.scheduleAttempts,
    artifactDigests,
    errors,
  };
}

export function pe4I6ArtifactDir(cwd = process.cwd()): string {
  return artifactRoot(cwd);
}
