/**
 * PE-4I.16 — Offline ledger materialization from Stage-1 universe + stats caches.
 * Fail-closed on identity conflicts. Zero provider HTTP.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createPe4I2AcquisitionCache,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import type {
  Pe4I2RawScheduleFixtureRow,
  Pe4I2RawStatisticsEnvelope,
} from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  listStatisticsCaches,
  loadFrozenStage2Queue,
  PE4I5_FROZEN_STAGE2_QUEUE_DIGEST,
  PE4I5_FROZEN_STAGE2_QUEUE_SIZE,
} from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import { loadCachedQueueStatisticsEnvelopes } from "@/lib/debug/calibration/pe4-acquisition/stage2b-batch";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";
import {
  buildHistoricalMatchLedgerRow,
  presentNumeric,
  missingNumeric,
  type Pe4I15HistoricalMatchLedgerRow,
  type Pe4I15GoalsSource,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import { regulationAmbiguityFromStatus } from "@/lib/debug/calibration/pe4-as-of-t-features/aet-pen-contract";
import { teamBlockFromStatisticsSide } from "@/lib/debug/calibration/pe4-as-of-t-features/stats-field-extract";
import {
  PE4I16_ARTIFACT_SUBDIR,
  PE4I16_PROTOCOL_VERSION,
  pe4I16Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";

export type Pe4I16UniverseFixture = {
  providerFixtureId: string;
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  competitionClass?: string | null;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  identityDigest?: string;
};

export type Pe4I16MaterializationExclusion = {
  fixtureId: string;
  reason: string;
  detail?: string;
};

export type Pe4I16MaterializationReport = {
  protocolVersion: typeof PE4I16_PROTOCOL_VERSION;
  parentQueueDigest: typeof PE4I5_FROZEN_STAGE2_QUEUE_DIGEST;
  queueSize: typeof PE4I5_FROZEN_STAGE2_QUEUE_SIZE;
  universeFixtureCount: number;
  statisticsEnvelopeCount: number;
  ledgerRowCount: number;
  exclusions: Pe4I16MaterializationExclusion[];
  exclusionCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  holdoutClassificationCounts: Record<string, number>;
  regulationAmbiguityCount: number;
  aetPenCount: number;
  calendar2025InLedger: number;
  withStatisticsEnvelope: number;
  withoutStatisticsEnvelope: number;
  goalsPresentBothSides: number;
  providerCallsMade: 0;
  ledgerDigest: string;
  artifactDirRelative: string;
};

export type Pe4I16MaterializationResult = {
  rows: Pe4I15HistoricalMatchLedgerRow[];
  report: Pe4I16MaterializationReport;
};

type SeasonJoin = {
  seasonByFixture: Map<string, string>;
  conflicts: Pe4I16MaterializationExclusion[];
};

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

function universePath(cwd: string): string {
  return path.join(
    cwd,
    PE4I2_CACHE_ROOT_RELATIVE,
    "stage1-i5",
    "normalized-fixture-universe.json",
  );
}

export function pe4I16ArtifactDir(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I16_ARTIFACT_SUBDIR);
}

export function pe4I16LocalCachePresent(cwd = process.cwd()): boolean {
  try {
    if (!existsSync(universePath(cwd))) return false;
    const q = loadFrozenStage2Queue(cwd);
    const caches = listStatisticsCaches(cwd);
    let hits = 0;
    for (const id of q.fixtureIds) {
      const key = statisticsUnitKey(id);
      for (const c of caches) {
        const u = c.getUnit(key);
        if (u?.status === "completed" && u.contentDigest) {
          hits += 1;
          break;
        }
      }
    }
    return hits === PE4I5_FROZEN_STAGE2_QUEUE_SIZE;
  } catch {
    return false;
  }
}

export function loadStage1UniverseFixtures(
  cwd = process.cwd(),
): Pe4I16UniverseFixture[] {
  const p = universePath(cwd);
  if (!existsSync(p)) {
    throw new Error(`Stage-1 universe missing: ${p}`);
  }
  const parsed = JSON.parse(readFileSync(p, "utf8")) as {
    fixtures?: Pe4I16UniverseFixture[];
  };
  return [...(parsed.fixtures ?? [])];
}

function loadProviderSeasonByFixture(cwd: string): SeasonJoin {
  const seasonByFixture = new Map<string, string>();
  const conflicts: Pe4I16MaterializationExclusion[] = [];
  const root = bulkCacheRoot(cwd);
  if (!existsSync(root)) {
    return { seasonByFixture, conflicts };
  }
  const bulk = createPe4I2AcquisitionCache(root);
  for (const unit of bulk.readManifest().units) {
    if (unit.kind !== "team_season_schedule" || unit.status !== "completed") {
      continue;
    }
    const raw = bulk.readRawJson(unit.unitKey) as {
      payload?: {
        requestedSeason?: string;
        fixtures?: Array<Pick<Pe4I2RawScheduleFixtureRow, "providerFixtureId">>;
      };
    } | null;
    const season = raw?.payload?.requestedSeason ?? null;
    if (!season || !raw?.payload?.fixtures) continue;
    for (const f of raw.payload.fixtures) {
      const prev = seasonByFixture.get(f.providerFixtureId);
      if (prev != null && prev !== season) {
        conflicts.push({
          fixtureId: f.providerFixtureId,
          reason: "conflicting_provider_season",
          detail: `${prev} vs ${season}`,
        });
        continue;
      }
      seasonByFixture.set(f.providerFixtureId, season);
    }
  }
  return { seasonByFixture, conflicts };
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

function goalsSourceFor(input: {
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}): Pe4I15GoalsSource {
  const ambiguous = regulationAmbiguityFromStatus(input.status);
  if (input.homeGoals == null || input.awayGoals == null) {
    return "unavailable";
  }
  if (ambiguous) return "provider_regulation_unknown";
  if ((input.status ?? "").toUpperCase() === "FT") return "provider_ft_score";
  return "provider_regulation_unknown";
}

function competitionLabel(f: Pe4I16UniverseFixture): string {
  return (
    f.providerCompetitionId?.trim() ||
    f.providerCompetitionName?.trim() ||
    "unknown"
  );
}

function identityKey(f: Pe4I16UniverseFixture): string {
  return [
    f.kickoffUtc,
    f.homeTeamId,
    f.awayTeamId,
    f.status,
    String(f.homeGoals),
    String(f.awayGoals),
    competitionLabel(f),
  ].join("|");
}

/**
 * Build a single ledger row from universe + optional statistics envelope.
 */
export function materializeLedgerRowFromSources(input: {
  fixture: Pe4I16UniverseFixture;
  providerSeason: string;
  statistics: Pe4I2RawStatisticsEnvelope | null;
}): Pe4I15Result<Pe4I15HistoricalMatchLedgerRow> {
  const f = input.fixture;
  const homeId = f.homeTeamId?.trim() ?? "";
  const awayId = f.awayTeamId?.trim() ?? "";
  const regulationAmbiguity = regulationAmbiguityFromStatus(f.status);

  const homeStats = teamBlockFromStatisticsSide({
    teamId: homeId,
    envelope: input.statistics,
  });
  const awayStats = teamBlockFromStatisticsSide({
    teamId: awayId,
    envelope: input.statistics,
  });

  const homeGoals =
    f.homeGoals == null ? missingNumeric() : presentNumeric(f.homeGoals);
  const awayGoals =
    f.awayGoals == null ? missingNumeric() : presentNumeric(f.awayGoals);

  return buildHistoricalMatchLedgerRow({
    fixtureId: f.providerFixtureId,
    competition: competitionLabel(f),
    providerSeason: input.providerSeason,
    kickoffUtc: f.kickoffUtc,
    status: f.status,
    homeTeamId: homeId,
    awayTeamId: awayId,
    goalsSource: goalsSourceFor({
      status: f.status,
      homeGoals: f.homeGoals,
      awayGoals: f.awayGoals,
    }),
    home: { ...homeStats, goals: homeGoals },
    away: { ...awayStats, goals: awayGoals },
    provenance: {
      cacheKey: input.statistics
        ? statisticsUnitKey(f.providerFixtureId)
        : undefined,
      envelopeDigest: input.statistics?.contentDigest,
      acquisitionStage: input.statistics ? "stage2_statistics" : "stage1_universe",
    },
    regulationAmbiguity,
  });
}

function digestLedgerRows(rows: readonly Pe4I15HistoricalMatchLedgerRow[]): string {
  const sorted = [...rows].sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
  return createHash("sha256")
    .update(JSON.stringify(sorted), "utf8")
    .digest("hex");
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * Materialize Pe4I15 ledger rows offline. Fail-closed on conflicting identity.
 */
export function materializeOfflineLedger(input?: {
  cwd?: string;
  /** When set, only these fixture IDs (e.g. frozen queue). Default: full universe. */
  fixtureIds?: readonly string[];
  writeArtifacts?: boolean;
}): Pe4I16MaterializationResult {
  const cwd = input?.cwd ?? process.cwd();
  pe4I16Protocol(); // pin protocol object existence

  const universe = loadStage1UniverseFixtures(cwd);
  const byId = new Map<string, Pe4I16UniverseFixture>();
  const exclusions: Pe4I16MaterializationExclusion[] = [];

  for (const f of universe) {
    const id = f.providerFixtureId?.trim() ?? "";
    if (!id) {
      exclusions.push({ fixtureId: "(missing)", reason: "missing_fixture_id" });
      continue;
    }
    const prev = byId.get(id);
    if (prev) {
      if (identityKey(prev) !== identityKey(f)) {
        throw new Error(
          `PE-4I.16 fail-closed conflicting_identity fixtureId=${id}`,
        );
      }
      exclusions.push({
        fixtureId: id,
        reason: "duplicate_fixture_id_collapsed",
      });
      continue;
    }
    byId.set(id, f);
  }

  const seasonJoin = loadProviderSeasonByFixture(cwd);
  for (const c of seasonJoin.conflicts) {
    // Conflicting season across schedule units is fail-closed for that fixture.
    exclusions.push(c);
  }
  const conflictSeasonIds = new Set(
    seasonJoin.conflicts.map((c) => c.fixtureId),
  );

  const queue = loadFrozenStage2Queue(cwd);
  const caches = listStatisticsCaches(cwd);
  const targetIds =
    input?.fixtureIds ??
    [...byId.keys()].sort((a, b) => a.localeCompare(b));

  // Prefetch envelopes for queue intersection (coverage helpers).
  const queueSet = new Set(queue.fixtureIds);
  const envelopes = loadCachedQueueStatisticsEnvelopes({
    fixtureIds: queue.fixtureIds,
    caches,
  });
  const envById = new Map(
    envelopes.map((e) => [e.providerFixtureId, e] as const),
  );

  const rows: Pe4I15HistoricalMatchLedgerRow[] = [];
  const statusCounts: Record<string, number> = {};
  const holdoutClassificationCounts: Record<string, number> = {};
  let regulationAmbiguityCount = 0;
  let aetPenCount = 0;
  let calendar2025InLedger = 0;
  let withStatisticsEnvelope = 0;
  let withoutStatisticsEnvelope = 0;
  let goalsPresentBothSides = 0;

  for (const id of targetIds) {
    if (conflictSeasonIds.has(id)) {
      exclusions.push({
        fixtureId: id,
        reason: "excluded_conflicting_provider_season",
      });
      continue;
    }
    const fixture = byId.get(id);
    if (!fixture) {
      exclusions.push({ fixtureId: id, reason: "missing_from_universe" });
      continue;
    }

    const season =
      seasonJoin.seasonByFixture.get(id) ??
      (fixture as { providerSeason?: string }).providerSeason ??
      "unknown";

    let statistics =
      envById.get(id) ??
      (queueSet.has(id) ? null : readStatisticsEnvelope(id, caches));
    // Non-queue fixtures: still attempt cache read.
    if (!statistics && !queueSet.has(id)) {
      statistics = readStatisticsEnvelope(id, caches);
    }
    if (!statistics && queueSet.has(id)) {
      statistics = readStatisticsEnvelope(id, caches);
    }

    const built = materializeLedgerRowFromSources({
      fixture,
      providerSeason: season,
      statistics,
    });
    if (!built.ok) {
      exclusions.push({
        fixtureId: id,
        reason: built.reason,
        detail: built.detail,
      });
      continue;
    }

    const row = built.value;
    rows.push(row);
    bump(statusCounts, row.status || "UNKNOWN");
    bump(holdoutClassificationCounts, row.holdoutClassification);
    if (row.regulationAmbiguity) regulationAmbiguityCount += 1;
    const st = (row.status ?? "").toUpperCase();
    if (st === "AET" || st === "PEN") aetPenCount += 1;
    if (row.holdoutClassification === "calendar_2025_sealed_outcome") {
      calendar2025InLedger += 1;
    }
    if (statistics) withStatisticsEnvelope += 1;
    else withoutStatisticsEnvelope += 1;
    if (
      row.home.goals.presence === "present" &&
      row.away.goals.presence === "present"
    ) {
      goalsPresentBothSides += 1;
    }
  }

  rows.sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  const exclusionCounts: Record<string, number> = {};
  for (const e of exclusions) bump(exclusionCounts, e.reason);

  const ledgerDigest = digestLedgerRows(rows);
  const artifactDir = pe4I16ArtifactDir(cwd);
  const artifactDirRelative = path
    .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I16_ARTIFACT_SUBDIR)
    .replace(/\\/g, "/");

  const report: Pe4I16MaterializationReport = {
    protocolVersion: PE4I16_PROTOCOL_VERSION,
    parentQueueDigest: PE4I5_FROZEN_STAGE2_QUEUE_DIGEST,
    queueSize: PE4I5_FROZEN_STAGE2_QUEUE_SIZE,
    universeFixtureCount: universe.length,
    statisticsEnvelopeCount: envelopes.length,
    ledgerRowCount: rows.length,
    exclusions,
    exclusionCounts,
    statusCounts: Object.fromEntries(
      Object.entries(statusCounts).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    holdoutClassificationCounts: Object.fromEntries(
      Object.entries(holdoutClassificationCounts).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    ),
    regulationAmbiguityCount,
    aetPenCount,
    calendar2025InLedger,
    withStatisticsEnvelope,
    withoutStatisticsEnvelope,
    goalsPresentBothSides,
    providerCallsMade: 0,
    ledgerDigest,
    artifactDirRelative,
  };

  if (input?.writeArtifacts !== false) {
    writeLedgerArtifacts({
      dir: artifactDir,
      rows,
      report,
    });
  }

  return { rows, report };
}

export function writeLedgerArtifacts(input: {
  dir: string;
  rows: readonly Pe4I15HistoricalMatchLedgerRow[];
  report: Pe4I16MaterializationReport;
}): void {
  mkdirSync(input.dir, { recursive: true });
  const ledgerPath = path.join(input.dir, "ledger.jsonl");
  const body =
    input.rows.map((r) => JSON.stringify(r)).join("\n") +
    (input.rows.length > 0 ? "\n" : "");
  writeFileSync(ledgerPath, body, "utf8");

  const ledgerFileDigest = createHash("sha256")
    .update(body, "utf8")
    .digest("hex");

  const manifest = {
    protocolVersion: PE4I16_PROTOCOL_VERSION,
    parentQueueDigest: input.report.parentQueueDigest,
    ledgerRowCount: input.rows.length,
    ledgerDigest: input.report.ledgerDigest,
    ledgerFileDigest,
    writtenAtUtc: new Date().toISOString(),
    files: ["ledger.jsonl", "materialization-report.json", "manifest.json"],
  };
  writeFileSync(
    path.join(input.dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    path.join(input.dir, "materialization-report.json"),
    JSON.stringify(input.report, null, 2) + "\n",
    "utf8",
  );
}

/** Pure helper for tests: materialize rows from in-memory sources only. */
export function materializeLedgerRowsInMemory(input: {
  fixtures: readonly Pe4I16UniverseFixture[];
  seasons?: ReadonlyMap<string, string>;
  statisticsByFixtureId?: ReadonlyMap<string, Pe4I2RawStatisticsEnvelope>;
}): Pe4I15Result<{
  rows: Pe4I15HistoricalMatchLedgerRow[];
  exclusions: Pe4I16MaterializationExclusion[];
}> {
  const byId = new Map<string, Pe4I16UniverseFixture>();
  const exclusions: Pe4I16MaterializationExclusion[] = [];

  for (const f of input.fixtures) {
    const id = f.providerFixtureId?.trim() ?? "";
    if (!id) {
      exclusions.push({ fixtureId: "(missing)", reason: "missing_fixture_id" });
      continue;
    }
    const prev = byId.get(id);
    if (prev) {
      if (identityKey(prev) !== identityKey(f)) {
        return pe4I15Err("conflicting_identity", id);
      }
      exclusions.push({
        fixtureId: id,
        reason: "duplicate_fixture_id_collapsed",
      });
      continue;
    }
    byId.set(id, f);
  }

  const rows: Pe4I15HistoricalMatchLedgerRow[] = [];
  for (const [id, fixture] of [...byId.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const built = materializeLedgerRowFromSources({
      fixture,
      providerSeason: input.seasons?.get(id) ?? "unknown",
      statistics: input.statisticsByFixtureId?.get(id) ?? null,
    });
    if (!built.ok) {
      exclusions.push({
        fixtureId: id,
        reason: built.reason,
        detail: built.detail,
      });
      continue;
    }
    rows.push(built.value);
  }

  rows.sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  return pe4I15Ok({ rows, exclusions });
}
