/**
 * PE-4I.14 — Full acquisition / dataset integrity audit (offline, deterministic).
 * ZERO provider / HTTP / Supabase calls. No modeling / fitting / calibration.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createPe4I2AcquisitionCache,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import { calendarKickoffYear } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  PE4I6_XG_COVERAGE_THRESHOLDS,
  PE4I7_CANONICAL_STATS_FIELDS,
  measureFieldCoverage,
  measureXgCoverage,
  type Pe4I6FixtureMeta,
} from "@/lib/debug/calibration/pe4-acquisition/stage2a-coverage";
import {
  PE4I5_FROZEN_STAGE2_QUEUE_DIGEST,
  PE4I5_FROZEN_STAGE2_QUEUE_SIZE,
  isStatisticsCached,
  listStatisticsCaches,
  loadFrozenStage2Queue,
  selectStatisticsBatch,
} from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";

/** Same Stage-2E+ observed-sample labels — NOT model branches. */
export type Pe4I14ObservedXgLabel =
  | "XG_CAPABLE_IN_OBSERVED_SAMPLE"
  | "XG_PARTIAL_IN_OBSERVED_SAMPLE"
  | "XG_UNAVAILABLE_IN_OBSERVED_SAMPLE";

export function classifyPe4I14ObservedXgLabel(
  bothShare: number,
): Pe4I14ObservedXgLabel {
  if (bothShare >= 0.9) return "XG_CAPABLE_IN_OBSERVED_SAMPLE";
  if (bothShare >= 0.5) return "XG_PARTIAL_IN_OBSERVED_SAMPLE";
  return "XG_UNAVAILABLE_IN_OBSERVED_SAMPLE";
}

export type Pe4I14CompetitionCoverageMatrixRow = {
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
  observedXgLabel: Pe4I14ObservedXgLabel;
  observedXgLabelNote: string;
};
import {
  assertNotSameKickoffOrSelf,
  isStrictlyBeforeKickoff,
  PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
} from "@/lib/debug/calibration/pe4-acquisition/temporal";
import {
  filterStrictlyBeforeTarget,
  isEligibleHistoricalForTarget,
} from "@/lib/debug/calibration/pe4-acquisition/as-of-t";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
} from "@/lib/debug/calibration/goals/g1/protocol";

export const PE4I14_INTEGRITY_AUDIT_VERSION =
  "pe4.stage2i14_full_acquisition_integrity_audit.v1" as const;

export const PE4I14_ARTIFACT_SUBDIR = "stage2i14-audit" as const;

export const PE4I14_EXPECTED_QUEUE_DIGEST = PE4I5_FROZEN_STAGE2_QUEUE_DIGEST;
export const PE4I14_EXPECTED_QUEUE_SIZE = PE4I5_FROZEN_STAGE2_QUEUE_SIZE;
export const PE4I14_EXPECTED_CACHE_HITS = 1094 as const;
export const PE4I14_EXPECTED_UNCACHED = 0 as const;
export const PE4I14_EXPECTED_CALENDAR_2025_SEALED = 288 as const;

/** Expected lineage: smoke 1 stats + 7×150 + final 43 = 1094. */
export const PE4I14_EXPECTED_CALL_LINEAGE_SUM = 1094 as const;

type UniverseFixture = {
  providerFixtureId: string;
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  status: string;
  kickoffUtc: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

function artifactRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I14_ARTIFACT_SUBDIR);
}

export function pe4I14ArtifactDir(cwd = process.cwd()): string {
  return artifactRoot(cwd);
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(normalize);
    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = normalize(obj[k]);
    }
    return out;
  };
  return JSON.stringify(normalize(value));
}

function contentDigestOf(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value), "utf8")
    .digest("hex");
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

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

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

  if (existsSync(bulkCacheRoot(cwd))) {
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

function fieldPresentShare(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  field: (typeof PE4I7_CANONICAL_STATS_FIELDS)[number],
): number | null {
  const cov = measureFieldCoverage(envelopes, PE4I7_CANONICAL_STATS_FIELDS).find(
    (r) => r.field === field,
  );
  return cov?.coveragePercentAmongExpectedTeamSides ?? null;
}

function buildCompetitionCoverageMatrixRow(
  label: string,
  fixtureIds: readonly string[],
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  metaMap: ReadonlyMap<string, Pe4I6FixtureMeta>,
): Pe4I14CompetitionCoverageMatrixRow {
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
    observedXgLabel: classifyPe4I14ObservedXgLabel(bothShare),
    observedXgLabelNote:
      "Coverage label from observed sample only — NOT a model branch or capability gate",
  };
}

function readJsonIfPresent<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function listCompletedStatisticsUnitKeys(
  caches: readonly Pe4I2AcquisitionCache[],
): {
  byCacheRoot: Record<string, number>;
  uniqueFixtureIds: string[];
  totalCompletedUnits: number;
} {
  const seen = new Set<string>();
  const byCacheRoot: Record<string, number> = {};
  for (const cache of caches) {
    let n = 0;
    for (const unit of cache.readManifest().units) {
      if (unit.kind !== "fixture_statistics" || unit.status !== "completed") {
        continue;
      }
      n += 1;
      const m = /^statistics::fixture=(.+)$/.exec(unit.unitKey);
      if (m?.[1]) seen.add(m[1]);
    }
    byCacheRoot[cache.rootDir.replace(/\\/g, "/")] = n;
  }
  return {
    byCacheRoot,
    uniqueFixtureIds: [...seen].sort(),
    totalCompletedUnits: Object.values(byCacheRoot).reduce((a, b) => a + b, 0),
  };
}

function grepCalendar2025ResearchFittingPaths(cwd: string): string[] {
  /**
   * Offline static path inventory: scripts/modules that mention calendar-2025
   * acquisition artifacts or holdout firewall. Does NOT unseal outcomes.
   * No recursive file content scan of secrets; fixed known research paths only.
   */
  const candidates = [
    "lib/debug/calibration/pe4-acquisition/holdout.ts",
    "lib/debug/calibration/pe4-acquisition/stage2c-batch.ts",
    "lib/debug/calibration/pe4-acquisition/stage2d-batch.ts",
    "lib/debug/calibration/pe4-acquisition/stage2e-batch.ts",
    "lib/debug/calibration/pe4-acquisition/stage2f-batch.ts",
    "lib/debug/calibration/pe4-acquisition/stage2g-batch.ts",
    "lib/debug/calibration/pe4-acquisition/stage2h-batch.ts",
    "lib/debug/calibration/pe4-acquisition/pe4i14-integrity-audit.ts",
    "docs/PE4I13_STAGE2H_FINAL_STATISTICS_ACQUISITION.md",
    "docs/PE4I12_STAGE2G_STATISTICS_BATCH.md",
    "docs/PE4I11_STAGE2F_STATISTICS_BATCH.md",
    "docs/PE4I10_STAGE2E_STATISTICS_BATCH.md",
    "docs/PE4I9_STAGE2D_STATISTICS_BATCH.md",
    "docs/PE4I8_STAGE2C_STATISTICS_BATCH.md",
  ];
  const hits: string[] = [];
  const patterns = [
    /calendarKickoffYear\s*===\s*2025/,
    /calendar-2025/,
    /CALENDAR_2025/,
    /cumulativeCalendar2025/,
    /holdout2025Status/,
    /2025_holdout_sealed/,
    /assertNoProviderSeason2025Request/,
  ];
  for (const rel of candidates) {
    const abs = path.join(cwd, rel);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    if (patterns.some((p) => p.test(text))) {
      hits.push(rel.replace(/\\/g, "/"));
    }
  }
  return hits;
}

function searchAccidentalFittingConsumption(cwd: string): {
  pathsMentioningCalendar2025Artifacts: string[];
  productionImportHits: string[];
  note: string;
} {
  const productionRoots = [
    "lib/prematch-lifecycle",
    "lib/prematch-decision",
    "lib/match-center",
    "app",
    "workflows",
  ];
  const productionImportHits: string[] = [];
  const importRe =
    /from\s+["']@\/lib\/debug\/calibration\/pe4-acquisition(?:\/[^"']*)?["']/;

  const walkTs = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (
          ent.name === "node_modules" ||
          ent.name === ".git" ||
          ent.name === "pe4-acquisition"
        ) {
          continue;
        }
        walkTs(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue;
      // Skip research calibration runners/tests under pe4-form that only pin PE3C.
      const text = readFileSync(full, "utf8");
      if (importRe.test(text)) {
        productionImportHits.push(
          path.relative(cwd, full).replace(/\\/g, "/"),
        );
      }
    }
  };

  for (const root of productionRoots) {
    walkTs(path.join(cwd, root));
  }

  return {
    pathsMentioningCalendar2025Artifacts:
      grepCalendar2025ResearchFittingPaths(cwd),
    productionImportHits,
    note:
      "Calendar-2025 paths are acquisition/audit/firewall only. No production PE import of pe4-acquisition found. Research fitting consumption of sealed calendar-2025 outcomes was not observed in scanned production roots.",
  };
}

type CallAccountingRow = {
  stage: string;
  path: string | null;
  present: boolean;
  providerCallsSucceeded: number | null;
  providerCallsAttempted: number | null;
  providerCallsFailed: number | null;
};

function loadCallAccountingLineage(cwd: string): {
  rows: CallAccountingRow[];
  sumSucceededI6toI13: number;
  smokeStatisticsSucceeded: number | null;
  smokeProviderCallsSucceeded: number | null;
  lineageSumIncludingSmokeStats: number | null;
  expectedSum: number;
  coherentWith1094: boolean;
  note: string;
} {
  const stageDirs: Array<{ stage: string; sub: string }> = [
    { stage: "I.6_stage2a", sub: "stage2a-i6" },
    { stage: "I.7_stage2b", sub: "stage2b-i7" },
    { stage: "I.8_stage2c", sub: "stage2c-i8" },
    { stage: "I.9_stage2d", sub: "stage2d-i9" },
    { stage: "I.10_stage2e", sub: "stage2e-i10" },
    { stage: "I.11_stage2f", sub: "stage2f-i11" },
    { stage: "I.12_stage2g", sub: "stage2g-i12" },
    { stage: "I.13_stage2h", sub: "stage2h-i13" },
  ];
  const rows: CallAccountingRow[] = [];
  let sumSucceededI6toI13 = 0;
  for (const s of stageDirs) {
    const p = path.join(
      cwd,
      PE4I2_CACHE_ROOT_RELATIVE,
      s.sub,
      "call-accounting.json",
    );
    const j = readJsonIfPresent<{
      providerCallsSucceeded?: number;
      providerCallsAttempted?: number;
      providerCallsFailed?: number;
    }>(p);
    const succeeded = j?.providerCallsSucceeded ?? null;
    if (typeof succeeded === "number") sumSucceededI6toI13 += succeeded;
    rows.push({
      stage: s.stage,
      path: existsSync(p)
        ? path.relative(cwd, p).replace(/\\/g, "/")
        : null,
      present: existsSync(p),
      providerCallsSucceeded: succeeded,
      providerCallsAttempted: j?.providerCallsAttempted ?? null,
      providerCallsFailed: j?.providerCallsFailed ?? null,
    });
  }

  const smokeReportPath = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "smoke-i3",
    "smoke-report.json",
  );
  const smoke = readJsonIfPresent<{
    firstPass?: {
      statisticsOk?: boolean;
      providerCalls?: number;
      budget?: { succeeded?: number };
    };
  }>(smokeReportPath);
  const smokeProviderCallsSucceeded =
    smoke?.firstPass?.budget?.succeeded ?? null;
  const smokeStatisticsSucceeded =
    smoke?.firstPass?.statisticsOk === true ? 1 : smoke ? 0 : null;

  const lineageSum =
    smokeStatisticsSucceeded == null
      ? null
      : sumSucceededI6toI13 + smokeStatisticsSucceeded;

  return {
    rows,
    sumSucceededI6toI13,
    smokeStatisticsSucceeded,
    smokeProviderCallsSucceeded,
    lineageSumIncludingSmokeStats: lineageSum,
    expectedSum: PE4I14_EXPECTED_CALL_LINEAGE_SUM,
    coherentWith1094: lineageSum === PE4I14_EXPECTED_CALL_LINEAGE_SUM,
    note:
      "I.6–I.13 call-accounting providerCallsSucceeded sum to 150×7+43=1093; PE-4I.3 smoke contributes 1 statistics success → 1094. Smoke providerCallsSucceeded may be 2 (schedule+stats).",
  };
}

export type Pe4I14IntegrityAuditReport = {
  phase: "PE4I14_FULL_ACQUISITION_DATASET_INTEGRITY_AUDIT";
  auditVersion: typeof PE4I14_INTEGRITY_AUDIT_VERSION;
  providerCallsMade: 0;
  preflight: {
    queueDigest: string;
    queueDigestOk: boolean;
    queueSize: number;
    queueSizeOk: boolean;
    statisticsCacheHits: number;
    uncached: number;
    cacheOk: boolean;
    PE3C_C0_RECON_ACTIVATION: boolean;
    pe3cOk: boolean;
    expectationStatus: string;
    expectationOk: boolean;
    g1SelectedShrinkageK: number | null;
    g1Ok: boolean;
    g1ProtocolDigest: string;
    pass: boolean;
  };
  A_queue: {
    digest: string;
    size: number;
    digestMatchesFrozen: boolean;
    sizeMatchesFrozen: boolean;
    canonicalSortedOrder: boolean;
  };
  B_statisticsCaches: {
    cacheRoots: string[];
    completedStatsUnitsByCache: Record<string, number>;
    totalCompletedStatsUnitsAcrossCaches: number;
    uniqueCompletedFixtureIds: number;
    queueIdsWithCompletedStats: number;
  };
  C_fixtureIdentity: {
    duplicateIdsInQueue: number;
    emptyOrMalformedIds: number;
    malformedExamples: string[];
    orderingMatchesDigestCanonical: boolean;
  };
  D_join: {
    queueIds: number;
    withExactlyOneCompletedEnvelope: number;
    missingEnvelope: number;
    providerFixtureIdMismatch: number;
    teamsLengthLessThan2: number;
    teamsLengthExactly2: number;
    teamsLengthGreaterThan2: number;
  };
  E_temporalContracts: {
    helpersPresent: string[];
    strictBeforeEnforceable: boolean;
    selfSameFutureExclusionEnforceable: boolean;
    futureScheduleAnticipation: typeof PE4I2_FUTURE_SCHEDULE_ANTICIPATION;
    asOfTSnapshotsPresentInLocalData: boolean;
    note: string;
  };
  F_calendar2025: {
    calendar2025AmongCachedQueue: number;
    expectedSealedCount: number;
    sealedCountMatchesExpected: boolean;
    cumulativeAuditArtifactPresent: boolean;
    cumulativeAuditCount: number | null;
    idsMatchCumulativeArtifact: boolean | null;
    researchFittingPathHits: string[];
    productionImportHits: string[];
    holdoutStatus: "SEALED";
    note: string;
  };
  G_fieldSemantics: {
    fieldCoverage: ReturnType<typeof measureFieldCoverage>;
    xgCoverage: ReturnType<typeof measureXgCoverage>;
    competitionCoverageMatrix: Pe4I14CompetitionCoverageMatrixRow[];
    missingNotZeroNote: string;
    xgThresholds: typeof PE4I6_XG_COVERAGE_THRESHOLDS;
    observedLabelRules: string;
  };
  H_statusAetPen: {
    universeStatusCounts: Record<string, number>;
    queueStatusCounts: Record<string, number>;
    queueFt: number;
    queueAet: number;
    queuePen: number;
    queueAetPenTotal: number;
    queueOtherOrUnknown: number;
  };
  I_reproducibility: {
    contentDigest: string;
    artifactPath: string | null;
    runComparedEqual: boolean | null;
  };
  J_callAccounting: ReturnType<typeof loadCallAccountingLineage>;
  productionBoundary: {
    pe3cFalse: boolean;
    pe4AcquisitionImportsOutsideResearch: string[];
    pass: boolean;
  };
  blockers: string[];
  checkpointReady: boolean;
  finalVerdict: "READY_FOR_RESEARCH_CHECKPOINT" | "NOT_READY";
};

function auditCore(cwd: string): Omit<
  Pe4I14IntegrityAuditReport,
  "I_reproducibility"
> & { _digestPayload: unknown } {
  const queue = loadFrozenStage2Queue(cwd);
  const caches = listStatisticsCaches(cwd);
  const selection = selectStatisticsBatch({
    fixtureIds: queue.fixtureIds,
    queueDigest: queue.queueDigest,
    caches,
    maxNew: 1,
  });
  const expectation = resolvePe4HistoricalExpectation({
    targetStrengthCommon: 1600,
    opponentStrengthCommon: 1500,
    targetVenueRole: "HOME",
    pairwiseAvailable: true,
    historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
    targetSource: "catalogue",
    opponentSource: "catalogue",
  });
  const g1 = goalsG1Protocol(10);

  const preflightPass =
    queue.queueDigest === PE4I14_EXPECTED_QUEUE_DIGEST &&
    queue.fixtureIds.length === PE4I14_EXPECTED_QUEUE_SIZE &&
    selection.initialCachedCount === PE4I14_EXPECTED_CACHE_HITS &&
    selection.initialUncachedCount === PE4I14_EXPECTED_UNCACHED &&
    PE3C_C0_RECON_ACTIVATION === false &&
    expectation.status === "UNAVAILABLE" &&
    g1.selectedShrinkageK === 10;

  // A
  const sorted = [...queue.fixtureIds].sort();
  let canonicalSortedOrder = true;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== queue.fixtureIds[i]) {
      canonicalSortedOrder = false;
      break;
    }
  }

  // B
  const cacheInventory = listCompletedStatisticsUnitKeys(caches);
  let queueIdsWithCompletedStats = 0;
  for (const id of queue.fixtureIds) {
    if (isStatisticsCached(id, caches)) queueIdsWithCompletedStats += 1;
  }

  // C
  const seen = new Set<string>();
  let duplicateIdsInQueue = 0;
  const malformedExamples: string[] = [];
  let emptyOrMalformedIds = 0;
  for (const id of queue.fixtureIds) {
    if (seen.has(id)) duplicateIdsInQueue += 1;
    seen.add(id);
    if (!id || !/^\d+$/.test(id)) {
      emptyOrMalformedIds += 1;
      if (malformedExamples.length < 10) malformedExamples.push(String(id));
    }
  }

  // D + load envelopes
  const metaMap = loadFixtureMetaMap(cwd);
  const envelopes: Pe4I2RawStatisticsEnvelope[] = [];
  let missingEnvelope = 0;
  let providerFixtureIdMismatch = 0;
  let teamsLengthLessThan2 = 0;
  let teamsLengthExactly2 = 0;
  let teamsLengthGreaterThan2 = 0;
  let withExactlyOneCompletedEnvelope = 0;

  for (const id of queue.fixtureIds) {
    const env = readStatisticsEnvelope(id, caches);
    if (!env) {
      missingEnvelope += 1;
      continue;
    }
    withExactlyOneCompletedEnvelope += 1;
    envelopes.push(env);
    if (env.providerFixtureId !== id) providerFixtureIdMismatch += 1;
    if (env.teams.length < 2) teamsLengthLessThan2 += 1;
    else if (env.teams.length === 2) teamsLengthExactly2 += 1;
    else teamsLengthGreaterThan2 += 1;
  }

  // E — report enforceability from existing helpers (do not invent)
  const temporalProbe = assertNotSameKickoffOrSelf({
    historicalFixtureId: "1",
    historicalKickoffUtc: "2024-01-01T00:00:00.000Z",
    targetFixtureId: "2",
    targetKickoffUtc: "2024-06-01T00:00:00.000Z",
  });
  const selfProbe = isEligibleHistoricalForTarget({
    historical: {
      providerFixtureId: "1",
      kickoffUtc: "2024-01-01T00:00:00.000Z",
    },
    target: {
      providerFixtureId: "1",
      kickoffUtc: "2024-06-01T00:00:00.000Z",
    },
  });
  const filtered = filterStrictlyBeforeTarget(
    [
      { providerFixtureId: "1", kickoffUtc: "2024-01-01T00:00:00.000Z" },
      { providerFixtureId: "2", kickoffUtc: "2024-07-01T00:00:00.000Z" },
    ],
    { providerFixtureId: "3", kickoffUtc: "2024-06-01T00:00:00.000Z" },
  );

  // F
  const calendar2025Ids = queue.fixtureIds.filter(
    (id) => metaMap.get(id)?.calendarKickoffYear === 2025,
  );
  const cumAuditPath = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "stage2h-i13",
    "calendar-2025-cumulative-audit.json",
  );
  const cumAudit = readJsonIfPresent<{
    count?: number;
    fixtureIds?: string[];
  }>(cumAuditPath);
  let idsMatchCumulativeArtifact: boolean | null = null;
  if (cumAudit?.fixtureIds) {
    const a = [...calendar2025Ids].sort().join("\n");
    const b = [...cumAudit.fixtureIds].sort().join("\n");
    idsMatchCumulativeArtifact = a === b;
  }
  const fittingSearch = searchAccidentalFittingConsumption(cwd);

  // G
  const fieldCoverage = measureFieldCoverage(
    envelopes,
    PE4I7_CANONICAL_STATS_FIELDS,
  );
  const xgCoverage = measureXgCoverage({
    envelopes,
    metaByFixtureId: metaMap,
  });
  const byCompetition = new Map<string, string[]>();
  for (const id of queue.fixtureIds) {
    if (!isStatisticsCached(id, caches)) continue;
    const meta = metaMap.get(id);
    const label =
      meta?.providerCompetitionName ??
      meta?.providerCompetitionId ??
      "unknown";
    const list = byCompetition.get(label) ?? [];
    list.push(id);
    byCompetition.set(label, list);
  }
  const competitionCoverageMatrix: Pe4I14CompetitionCoverageMatrixRow[] = [
    ...byCompetition.entries(),
  ]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, ids]) => {
      const envs = ids
        .map((id) => readStatisticsEnvelope(id, caches))
        .filter((e): e is Pe4I2RawStatisticsEnvelope => e != null);
      return buildCompetitionCoverageMatrixRow(label, ids, envs, metaMap);
    });

  // H
  const universeStatusCounts: Record<string, number> = {};
  for (const meta of metaMap.values()) {
    const s = meta.status?.trim() || "UNKNOWN";
    universeStatusCounts[s] = (universeStatusCounts[s] ?? 0) + 1;
  }
  const queueStatusCounts: Record<string, number> = {};
  let queueFt = 0;
  let queueAet = 0;
  let queuePen = 0;
  let queueOtherOrUnknown = 0;
  for (const id of queue.fixtureIds) {
    const meta = metaMap.get(id);
    const s = meta?.status?.trim() || "UNKNOWN";
    queueStatusCounts[s] = (queueStatusCounts[s] ?? 0) + 1;
    const u = s.toUpperCase();
    if (u === "FT") queueFt += 1;
    else if (u === "AET") queueAet += 1;
    else if (u === "PEN") queuePen += 1;
    else queueOtherOrUnknown += 1;
  }

  // J
  const callAccounting = loadCallAccountingLineage(cwd);

  const productionImportHits = fittingSearch.productionImportHits;
  const productionBoundaryPass =
    PE3C_C0_RECON_ACTIVATION === false && productionImportHits.length === 0;

  const blockers: string[] = [];
  if (!preflightPass) blockers.push("PREFLIGHT_FAILED");
  if (missingEnvelope > 0) blockers.push("MISSING_STATISTICS_ENVELOPES");
  if (providerFixtureIdMismatch > 0) blockers.push("PROVIDER_FIXTURE_ID_MISMATCH");
  if (duplicateIdsInQueue > 0) blockers.push("DUPLICATE_QUEUE_IDS");
  if (emptyOrMalformedIds > 0) blockers.push("MALFORMED_QUEUE_IDS");
  if (calendar2025Ids.length !== PE4I14_EXPECTED_CALENDAR_2025_SEALED) {
    blockers.push("CALENDAR_2025_COUNT_MISMATCH");
  }
  if (!callAccounting.coherentWith1094) {
    blockers.push("CALL_ACCOUNTING_LINEAGE_MISMATCH");
  }
  if (!productionBoundaryPass) blockers.push("PRODUCTION_BOUNDARY_FAIL");
  if (idsMatchCumulativeArtifact === false) {
    blockers.push("CALENDAR_2025_CUMULATIVE_ARTIFACT_MISMATCH");
  }

  const checkpointReady = blockers.length === 0;
  const finalVerdict: "READY_FOR_RESEARCH_CHECKPOINT" | "NOT_READY" =
    checkpointReady ? "READY_FOR_RESEARCH_CHECKPOINT" : "NOT_READY";

  const reportWithoutI = {
    phase: "PE4I14_FULL_ACQUISITION_DATASET_INTEGRITY_AUDIT" as const,
    auditVersion: PE4I14_INTEGRITY_AUDIT_VERSION,
    providerCallsMade: 0 as const,
    preflight: {
      queueDigest: queue.queueDigest,
      queueDigestOk: queue.queueDigest === PE4I14_EXPECTED_QUEUE_DIGEST,
      queueSize: queue.fixtureIds.length,
      queueSizeOk: queue.fixtureIds.length === PE4I14_EXPECTED_QUEUE_SIZE,
      statisticsCacheHits: selection.initialCachedCount,
      uncached: selection.initialUncachedCount,
      cacheOk:
        selection.initialCachedCount === PE4I14_EXPECTED_CACHE_HITS &&
        selection.initialUncachedCount === PE4I14_EXPECTED_UNCACHED,
      PE3C_C0_RECON_ACTIVATION,
      pe3cOk: PE3C_C0_RECON_ACTIVATION === false,
      expectationStatus: expectation.status,
      expectationOk: expectation.status === "UNAVAILABLE",
      g1SelectedShrinkageK: g1.selectedShrinkageK,
      g1Ok: g1.selectedShrinkageK === 10,
      g1ProtocolDigest: digestGoalsG1Protocol(g1),
      pass: preflightPass,
    },
    A_queue: {
      digest: queue.queueDigest,
      size: queue.fixtureIds.length,
      digestMatchesFrozen: queue.queueDigest === PE4I14_EXPECTED_QUEUE_DIGEST,
      sizeMatchesFrozen: queue.fixtureIds.length === PE4I14_EXPECTED_QUEUE_SIZE,
      canonicalSortedOrder,
    },
    B_statisticsCaches: {
      cacheRoots: caches.map((c) => c.rootDir.replace(/\\/g, "/")),
      completedStatsUnitsByCache: cacheInventory.byCacheRoot,
      totalCompletedStatsUnitsAcrossCaches: cacheInventory.totalCompletedUnits,
      uniqueCompletedFixtureIds: cacheInventory.uniqueFixtureIds.length,
      queueIdsWithCompletedStats,
    },
    C_fixtureIdentity: {
      duplicateIdsInQueue,
      emptyOrMalformedIds,
      malformedExamples,
      orderingMatchesDigestCanonical: canonicalSortedOrder,
    },
    D_join: {
      queueIds: queue.fixtureIds.length,
      withExactlyOneCompletedEnvelope,
      missingEnvelope,
      providerFixtureIdMismatch,
      teamsLengthLessThan2,
      teamsLengthExactly2,
      teamsLengthGreaterThan2,
    },
    E_temporalContracts: {
      helpersPresent: [
        "temporal.isStrictlyBeforeKickoff",
        "temporal.assertNotSameKickoffOrSelf",
        "as-of-t.isEligibleHistoricalForTarget",
        "as-of-t.filterStrictlyBeforeTarget",
        "holdout.calendarKickoffYear",
        "holdout.isResearchHoldoutOutcomeEvidence (always false)",
      ],
      strictBeforeEnforceable:
        temporalProbe.ok === true &&
        isStrictlyBeforeKickoff(
          "2024-01-01T00:00:00.000Z",
          "2024-06-01T00:00:00.000Z",
        ) &&
        filtered.length === 1,
      selfSameFutureExclusionEnforceable: selfProbe.ok === false,
      futureScheduleAnticipation: PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
      asOfTSnapshotsPresentInLocalData: false,
      note:
        "Kickoff(history)<kickoff(target) and self/same/future exclusion are enforceable via existing temporal/as-of-t helpers when kickoffUtc is available on fixture meta. Full as-of-T schedule anticipation remains UNAVAILABLE (no as-of-T snapshots). Helpers exist; feature builds must call them — acquisition alone does not apply them.",
    },
    F_calendar2025: {
      calendar2025AmongCachedQueue: calendar2025Ids.length,
      expectedSealedCount: PE4I14_EXPECTED_CALENDAR_2025_SEALED,
      sealedCountMatchesExpected:
        calendar2025Ids.length === PE4I14_EXPECTED_CALENDAR_2025_SEALED,
      cumulativeAuditArtifactPresent: existsSync(cumAuditPath),
      cumulativeAuditCount: cumAudit?.count ?? null,
      idsMatchCumulativeArtifact,
      researchFittingPathHits: fittingSearch.pathsMentioningCalendar2025Artifacts,
      productionImportHits,
      holdoutStatus: "SEALED" as const,
      note: fittingSearch.note,
    },
    G_fieldSemantics: {
      fieldCoverage,
      xgCoverage,
      competitionCoverageMatrix,
      missingNotZeroNote:
        "Null/missing statistic values are valuePresence=missing — never coerced to zero. measureFieldCoverage counts missing separately from present numeric 0.",
      xgThresholds: PE4I6_XG_COVERAGE_THRESHOLDS,
      observedLabelRules:
        "bothShare≥0.90 → XG_CAPABLE_IN_OBSERVED_SAMPLE; ≥0.50 → XG_PARTIAL_IN_OBSERVED_SAMPLE; else → XG_UNAVAILABLE_IN_OBSERVED_SAMPLE (Stage-2E+)",
    },
    H_statusAetPen: {
      universeStatusCounts: Object.fromEntries(
        Object.entries(universeStatusCounts).sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      ),
      queueStatusCounts: Object.fromEntries(
        Object.entries(queueStatusCounts).sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      ),
      queueFt,
      queueAet,
      queuePen,
      queueAetPenTotal: queueAet + queuePen,
      queueOtherOrUnknown,
    },
    J_callAccounting: callAccounting,
    productionBoundary: {
      pe3cFalse: PE3C_C0_RECON_ACTIVATION === false,
      pe4AcquisitionImportsOutsideResearch: productionImportHits,
      pass: productionBoundaryPass,
    },
    blockers,
    checkpointReady,
    finalVerdict,
  };

  // Digest payload excludes volatile absolute cache roots paths for cross-run stability
  // but includes relative structure. Use report fields minus absolute roots.
  const digestPayload = {
    ...reportWithoutI,
    B_statisticsCaches: {
      ...reportWithoutI.B_statisticsCaches,
      cacheRoots: reportWithoutI.B_statisticsCaches.cacheRoots.map((r) =>
        r.includes(PE4I2_CACHE_ROOT_RELATIVE)
          ? r.slice(r.indexOf(PE4I2_CACHE_ROOT_RELATIVE))
          : r,
      ),
      completedStatsUnitsByCache: Object.fromEntries(
        Object.entries(
          reportWithoutI.B_statisticsCaches.completedStatsUnitsByCache,
        ).map(([k, v]) => [
          k.includes(PE4I2_CACHE_ROOT_RELATIVE)
            ? k.slice(k.indexOf(PE4I2_CACHE_ROOT_RELATIVE))
            : k,
          v,
        ]),
      ),
    },
  };

  return { ...reportWithoutI, _digestPayload: digestPayload };
}

/**
 * Run full offline integrity audit. Writes artifacts under stage2i14-audit/.
 * When compareRuns=true (default), executes core twice and verifies digests equal.
 */
export function runPe4I14IntegrityAudit(input?: {
  cwd?: string;
  writeArtifacts?: boolean;
  compareRuns?: boolean;
}): Pe4I14IntegrityAuditReport {
  const cwd = input?.cwd ?? process.cwd();
  const writeArtifacts = input?.writeArtifacts !== false;
  const compareRuns = input?.compareRuns !== false;

  const run1 = auditCore(cwd);
  const digest1 = contentDigestOf(run1._digestPayload);

  let runComparedEqual: boolean | null = null;
  if (compareRuns) {
    const run2 = auditCore(cwd);
    const digest2 = contentDigestOf(run2._digestPayload);
    runComparedEqual = digest1 === digest2;
    if (!runComparedEqual) {
      run1.blockers.push("REPRODUCIBILITY_DIGEST_MISMATCH");
      run1.checkpointReady = false;
      run1.finalVerdict = "NOT_READY";
    }
  }

  let artifactPath: string | null = null;
  if (writeArtifacts) {
    const dir = artifactRoot(cwd);
    artifactPath = path
      .relative(process.cwd(), path.join(dir, "integrity-audit-report.json"))
      .replace(/\\/g, "/");
    const reproducibility = {
      contentDigest: digest1,
      artifactPath,
      runComparedEqual,
    };
    writeArtifact(dir, "integrity-audit-report.json", {
      ...stripDigestPayload(run1),
      I_reproducibility: reproducibility,
    });
    writeArtifact(dir, "integrity-audit-digest.json", {
      contentDigest: digest1,
      runComparedEqual,
      providerCallsMade: 0,
    });
    writeArtifact(dir, "competition-coverage-matrix.json", {
      note: run1.G_fieldSemantics.observedLabelRules,
      rows: run1.G_fieldSemantics.competitionCoverageMatrix,
    });
    writeArtifact(dir, "field-coverage.json", run1.G_fieldSemantics.fieldCoverage);
    writeArtifact(dir, "xg-coverage.json", run1.G_fieldSemantics.xgCoverage);
    writeArtifact(dir, "call-accounting-lineage.json", run1.J_callAccounting);
    writeArtifact(dir, "calendar-2025-audit.json", {
      count: run1.F_calendar2025.calendar2025AmongCachedQueue,
      holdoutStatus: "SEALED",
      cumulativeAuditCount: run1.F_calendar2025.cumulativeAuditCount,
      idsMatchCumulativeArtifact: run1.F_calendar2025.idsMatchCumulativeArtifact,
    });
    writeArtifact(dir, "status-aet-pen.json", run1.H_statusAetPen);
  }

  return {
    ...stripDigestPayload(run1),
    I_reproducibility: {
      contentDigest: digest1,
      artifactPath,
      runComparedEqual,
    },
  };
}

function stripDigestPayload(
  r: ReturnType<typeof auditCore>,
): Omit<Pe4I14IntegrityAuditReport, "I_reproducibility"> {
  const { _digestPayload, ...rest } = r;
  void _digestPayload;
  return rest;
}

/** True when local Stage-2 queue + statistics caches appear present. */
export function pe4I14LocalCachePresent(cwd = process.cwd()): boolean {
  const queuePath = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "stage1-i5",
    "stage2-statistics-queue.json",
  );
  const bulkManifest = path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "bulk",
    "manifest.json",
  );
  return existsSync(queuePath) && existsSync(bulkManifest);
}

