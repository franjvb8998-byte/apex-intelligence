/**
 * PE-4I.5 — Stage-1 bounded multi-competition schedule discovery.
 * Acquires missing club-season schedules only. Never calls statistics.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { acquireScheduleUnit } from "@/lib/debug/calibration/pe4-acquisition/acquire-unit";
import {
  buildPe4I4BulkAcquisitionPlan,
  listUsableAcquisitionCaches,
  verifyPe4I3SmokeCache,
  type Pe4I4ClubSeasonUnit,
} from "@/lib/debug/calibration/pe4-acquisition/bulk-plan";
import { createPe4I2CallBudget } from "@/lib/debug/calibration/pe4-acquisition/budget";
import {
  createPe4I2AcquisitionCache,
  scheduleUnitKey,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import {
  newCompetitionPinsToApply,
  proposeEvidenceBackedCompetitionPins,
  type Pe4I5CompetitionPinProposal,
} from "@/lib/debug/calibration/pe4-acquisition/competition-pins";
import {
  pe4I4PrimaryStatsInclusion,
  resolveCompetitionClassForPolicy,
} from "@/lib/debug/calibration/pe4-acquisition/competition-policy";
import {
  classifyPe4I2Competition,
  PE4I2_COMPETITION_ID_REGISTRY,
  type Pe4I2CompetitionClass,
} from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import { dedupeScheduleFixtures } from "@/lib/debug/calibration/pe4-acquisition/dedupe";
import type {
  Pe4I2RawScheduleEnvelope,
  Pe4I2RawScheduleFixtureRow,
} from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import { calendarKickoffYear } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I4_XG_STATUS } from "@/lib/debug/calibration/pe4-acquisition/performance-fields";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  assertSeasonAllowed,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { createScheduleOnlyTransport } from "@/lib/debug/calibration/pe4-acquisition/schedule-only-transport";
import { PE4I5_STAGE1_HARD_MAX_CALLS } from "@/lib/debug/calibration/pe4-acquisition/stage1-auth";
import { evaluateStatisticsEligibility } from "@/lib/debug/calibration/pe4-acquisition/statistics-eligibility";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";
import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";

export const PE4I5_STAGE1_VERSION =
  "pe4.stage1_schedule_discovery.v1" as const;

export const PE4I5_ARTIFACT_SUBDIR = "stage1-i5" as const;

function smokeCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "smoke-i3");
}

function bulkCacheRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, "bulk");
}

function artifactRoot(cwd: string): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I5_ARTIFACT_SUBDIR);
}

function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
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

/**
 * Copy completed smoke MU 2024 schedule into bulk cache without provider call.
 * Idempotent; fail-closed on digest conflict.
 */
export function seedMu2024ScheduleIntoBulk(input: {
  cwd?: string;
  bulkCache?: Pe4I2AcquisitionCache;
}): {
  seeded: boolean;
  unitKey: string;
  contentDigest: string | null;
  message: string;
} {
  const cwd = input.cwd ?? process.cwd();
  const unitKey = scheduleUnitKey("33", "2024");
  const smoke = verifyPe4I3SmokeCache(cwd);
  if (!smoke.loadOk || !smoke.contentDigest) {
    return {
      seeded: false,
      unitKey,
      contentDigest: null,
      message: smoke.message,
    };
  }
  const smokeCache = createPe4I2AcquisitionCache(smokeCacheRoot(cwd));
  const raw = smokeCache.readRawJson(unitKey) as {
    contentDigest?: string;
    payload?: Pe4I2RawScheduleEnvelope;
  } | null;
  if (!raw?.payload) {
    return {
      seeded: false,
      unitKey,
      contentDigest: smoke.contentDigest,
      message: "smoke raw payload missing",
    };
  }
  mkdirSync(bulkCacheRoot(cwd), { recursive: true });
  const bulk =
    input.bulkCache ?? createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  const existing = bulk.getUnit(unitKey);
  if (existing?.status === "completed") {
    if (
      existing.contentDigest &&
      existing.contentDigest !== smoke.contentDigest
    ) {
      throw new Error(
        `cache conflict seeding ${unitKey}: bulk digest differs from smoke`,
      );
    }
    return {
      seeded: false,
      unitKey,
      contentDigest: existing.contentDigest,
      message: "already present in bulk cache",
    };
  }
  bulk.putCompleted({
    unitKey,
    kind: "team_season_schedule",
    contentDigest: smoke.contentDigest,
    payload: raw.payload,
  });
  return {
    seeded: true,
    unitKey,
    contentDigest: smoke.contentDigest,
    message: "seeded MU 2024 schedule from PE-4I.3 smoke into bulk",
  };
}

function loadScheduleEnvelope(
  caches: readonly Pe4I2AcquisitionCache[],
  unitKey: string,
): Pe4I2RawScheduleEnvelope | null {
  for (const cache of caches) {
    const unit = cache.getUnit(unitKey);
    if (unit?.status !== "completed") continue;
    const raw = cache.readRawJson(unitKey) as {
      payload?: Pe4I2RawScheduleEnvelope;
    } | null;
    if (raw?.payload) return raw.payload;
  }
  return null;
}

export type Pe4I5CompetitionInventoryRow = {
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  fixtureAppearances: number;
  uniqueFixtures: number;
  seasonsObserved: string[];
  currentRegistryClassification: Pe4I2CompetitionClass | "unpinned";
  primaryPerformanceEligibility: string;
  nameHint: Pe4I2CompetitionClass | null;
};

export function buildCompetitionInventory(
  fixtures: readonly (Pe4I2RawScheduleFixtureRow & {
    discoveredFromProviderSeason?: string;
  })[],
): Pe4I5CompetitionInventoryRow[] {
  const map = new Map<
    string,
    {
      id: string | null;
      name: string | null;
      appearances: number;
      fixtureIds: Set<string>;
      seasons: Set<string>;
    }
  >();
  for (const f of fixtures) {
    const id = f.providerCompetitionId;
    const name = f.providerCompetitionName;
    const key = `${id ?? ""}|${name ?? ""}`;
    let cur = map.get(key);
    if (!cur) {
      cur = {
        id,
        name,
        appearances: 0,
        fixtureIds: new Set(),
        seasons: new Set(),
      };
      map.set(key, cur);
    }
    cur.appearances += 1;
    cur.fixtureIds.add(f.providerFixtureId);
    if (f.discoveredFromProviderSeason) {
      cur.seasons.add(f.discoveredFromProviderSeason);
    }
  }
  return [...map.values()]
    .map((row) => {
      const classified = classifyPe4I2Competition({
        providerCompetitionId: row.id,
        providerCompetitionName: row.name,
      });
      const registryClass =
        row.id && PE4I2_COMPETITION_ID_REGISTRY[row.id]
          ? PE4I2_COMPETITION_ID_REGISTRY[row.id]!
          : ("unpinned" as const);
      const resolved =
        registryClass === "unpinned"
          ? classified.competitionClass
          : registryClass;
      return {
        providerCompetitionId: row.id,
        providerCompetitionName: row.name,
        fixtureAppearances: row.appearances,
        uniqueFixtures: row.fixtureIds.size,
        seasonsObserved: [...row.seasons].sort(),
        currentRegistryClassification: registryClass,
        primaryPerformanceEligibility: pe4I4PrimaryStatsInclusion({
          providerCompetitionId: row.id,
          competitionClass: resolved,
        }),
        nameHint: classified.nameHint,
      };
    })
    .sort((a, b) =>
      String(a.providerCompetitionId).localeCompare(
        String(b.providerCompetitionId),
      ),
    );
}

export type Pe4I5AuditBucket =
  | "premier_league"
  | "fa_cup"
  | "league_cup"
  | "champions_league"
  | "europa_league"
  | "conference_league"
  | "community_shield"
  | "unknown_competition"
  | "friendlies_preseason"
  | "incomplete_future_other"
  | "primary_eligible";

function auditBucketForFixture(input: {
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
  eligible: boolean;
  status: string;
}): Pe4I5AuditBucket {
  if (input.eligible) return "primary_eligible";
  const id = input.providerCompetitionId?.trim() ?? "";
  if (id === "39") return "premier_league";
  if (id === "45") return "fa_cup";
  if (id === "48") return "league_cup";
  if (id === "2" || input.competitionClass === "uefa_champions_league") {
    return "champions_league";
  }
  if (id === "3" || input.competitionClass === "uefa_europa_league") {
    return "europa_league";
  }
  if (id === "848" || input.competitionClass === "uefa_conference_league") {
    return "conference_league";
  }
  if (id === "528") return "community_shield";
  if (id === "667" || id === "1022") return "friendlies_preseason";
  if (
    input.competitionClass === "unknown_competition" ||
    input.competitionClass === "other_known_competition"
  ) {
    if (!isCompletedPrematchEvidenceStatus(input.status)) {
      return "incomplete_future_other";
    }
    return id ? "unknown_competition" : "unknown_competition";
  }
  if (!isCompletedPrematchEvidenceStatus(input.status)) {
    return "incomplete_future_other";
  }
  return "incomplete_future_other";
}

export type Pe4I5Stage2QueueBuild = {
  fixtureIds: string[];
  queueDigest: string;
  excluded: Array<{
    fixtureId: string;
    reason: string;
    providerCompetitionId: string | null;
    providerCompetitionName: string | null;
    status: string;
    kickoffUtc: string;
    auditBucket: Pe4I5AuditBucket;
  }>;
  primaryByCompetition: Record<string, number>;
  excludedAuditCounts: Record<string, number>;
  composition: Array<{
    providerCompetitionId: string | null;
    providerCompetitionName: string | null;
    uniqueFixtures: number;
    completedFixtures: number;
    teamsRepresented: number;
    seasonsRepresented: string[];
    inPrimaryQueue: number;
  }>;
  naiveTeamFixtureStatisticsRequests: number;
};

function resolveClassWithPins(input: {
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
  pinOverrides?: ReadonlyMap<string, Pe4I2CompetitionClass>;
}): Pe4I2CompetitionClass {
  const id = input.providerCompetitionId?.trim() ?? null;
  if (id && input.pinOverrides?.has(id)) {
    return input.pinOverrides.get(id)!;
  }
  return resolveCompetitionClassForPolicy({
    providerCompetitionId: input.providerCompetitionId,
    competitionClass: input.competitionClass,
  });
}

export function buildStage2QueueAndAudit(input: {
  envelopes: readonly Pe4I2RawScheduleEnvelope[];
  acquisitionNowUtc: string;
  /** In-memory pins applied before registry source update lands. */
  pinOverrides?: ReadonlyMap<string, Pe4I2CompetitionClass>;
}): Pe4I5Stage2QueueBuild {
  type Row = Pe4I2RawScheduleFixtureRow & {
    discoveredFromProviderSeason: string;
  };
  const allRows: Row[] = input.envelopes.flatMap((e) =>
    e.fixtures.map((f) => ({
      ...f,
      discoveredFromProviderSeason: e.requestedSeason,
    })),
  );

  let naive = 0;
  for (const e of input.envelopes) {
    for (const f of e.fixtures) {
      const resolved = resolveClassWithPins({
        providerCompetitionId: f.providerCompetitionId,
        competitionClass: f.competitionClass,
        pinOverrides: input.pinOverrides,
      });
      const elig = evaluateStatisticsEligibility({
        providerFixtureId: f.providerFixtureId,
        status: f.status,
        kickoffUtc: f.kickoffUtc,
        providerCompetitionId: f.providerCompetitionId,
        competitionClass: resolved,
        discoveredFromProviderSeason: e.requestedSeason,
        acquisitionNowUtc: input.acquisitionNowUtc,
      });
      if (elig.eligibleForPrimaryQueue) naive += 1;
    }
  }

  const deduped = dedupeScheduleFixtures(allRows);
  if (!deduped.ok) {
    throw new Error(deduped.message);
  }

  const fixtureIds: string[] = [];
  const excluded: Pe4I5Stage2QueueBuild["excluded"] = [];
  const primaryByCompetition: Record<string, number> = {};
  const excludedAuditCounts: Record<string, number> = {
    premier_league: 0,
    fa_cup: 0,
    league_cup: 0,
    champions_league: 0,
    europa_league: 0,
    conference_league: 0,
    community_shield: 0,
    unknown_competition: 0,
    friendlies_preseason: 0,
    incomplete_future_other: 0,
  };

  const seasonById = new Map<string, string>();
  for (const r of allRows) {
    if (!seasonById.has(r.providerFixtureId)) {
      seasonById.set(r.providerFixtureId, r.discoveredFromProviderSeason);
    }
  }

  for (const f of deduped.fixtures) {
    const resolved = resolveClassWithPins({
      providerCompetitionId: f.providerCompetitionId,
      competitionClass: f.competitionClass,
      pinOverrides: input.pinOverrides,
    });
    const elig = evaluateStatisticsEligibility({
      providerFixtureId: f.providerFixtureId,
      status: f.status,
      kickoffUtc: f.kickoffUtc,
      providerCompetitionId: f.providerCompetitionId,
      competitionClass: resolved,
      discoveredFromProviderSeason:
        seasonById.get(f.providerFixtureId) ?? "2024",
      acquisitionNowUtc: input.acquisitionNowUtc,
    });
    if (elig.eligibleForPrimaryQueue) {
      fixtureIds.push(f.providerFixtureId);
      const label =
        f.providerCompetitionName ??
        f.providerCompetitionId ??
        "unknown";
      primaryByCompetition[label] = (primaryByCompetition[label] ?? 0) + 1;
    } else {
      let auditKey: string;
      if (
        elig.reason === "not_completed" ||
        elig.reason === "future_kickoff_at_acquisition"
      ) {
        auditKey = "incomplete_future_other";
      } else if (elig.reason === "friendlies_or_preseason_excluded") {
        auditKey = "friendlies_preseason";
      } else if (elig.reason === "community_shield_separate_audit") {
        auditKey = "community_shield";
      } else if (elig.reason === "unknown_competition_audit_only") {
        auditKey = "unknown_competition";
      } else {
        auditKey = auditBucketForFixture({
          providerCompetitionId: f.providerCompetitionId,
          competitionClass: resolved,
          eligible: false,
          status: f.status,
        });
      }

      excludedAuditCounts[auditKey] =
        (excludedAuditCounts[auditKey] ?? 0) + 1;
      excluded.push({
        fixtureId: f.providerFixtureId,
        reason: elig.reason,
        providerCompetitionId: f.providerCompetitionId,
        providerCompetitionName: f.providerCompetitionName,
        status: f.status,
        kickoffUtc: f.kickoffUtc,
        auditBucket: auditKey as Pe4I5AuditBucket,
      });
    }
  }
  fixtureIds.sort();

  // Composition for competitions that appear in primary queue or overall.
  const compMap = new Map<
    string,
    {
      id: string | null;
      name: string | null;
      fixtureIds: Set<string>;
      completed: Set<string>;
      teams: Set<string>;
      seasons: Set<string>;
      primary: Set<string>;
    }
  >();
  const primarySet = new Set(fixtureIds);
  for (const f of deduped.fixtures) {
    const key = `${f.providerCompetitionId ?? ""}|${f.providerCompetitionName ?? ""}`;
    let cur = compMap.get(key);
    if (!cur) {
      cur = {
        id: f.providerCompetitionId,
        name: f.providerCompetitionName,
        fixtureIds: new Set(),
        completed: new Set(),
        teams: new Set(),
        seasons: new Set(),
        primary: new Set(),
      };
      compMap.set(key, cur);
    }
    cur.fixtureIds.add(f.providerFixtureId);
    cur.teams.add(f.homeTeamId);
    cur.teams.add(f.awayTeamId);
    const season = seasonById.get(f.providerFixtureId);
    if (season) cur.seasons.add(season);
    if (isCompletedPrematchEvidenceStatus(f.status)) {
      cur.completed.add(f.providerFixtureId);
    }
    if (primarySet.has(f.providerFixtureId)) {
      cur.primary.add(f.providerFixtureId);
    }
  }

  const composition = [...compMap.values()]
    .map((c) => ({
      providerCompetitionId: c.id,
      providerCompetitionName: c.name,
      uniqueFixtures: c.fixtureIds.size,
      completedFixtures: c.completed.size,
      teamsRepresented: c.teams.size,
      seasonsRepresented: [...c.seasons].sort(),
      inPrimaryQueue: c.primary.size,
    }))
    .sort((a, b) =>
      String(a.providerCompetitionId).localeCompare(
        String(b.providerCompetitionId),
      ),
    );

  return {
    fixtureIds,
    queueDigest: createHash("sha256")
      .update(fixtureIds.join("\n"), "utf8")
      .digest("hex"),
    excluded,
    primaryByCompetition,
    excludedAuditCounts,
    composition,
    naiveTeamFixtureStatisticsRequests: naive,
  };
}

export type Pe4I5Stage1Report = {
  phase: "PE4I5_STAGE1_SCHEDULE_DISCOVERY";
  stage1Version: typeof PE4I5_STAGE1_VERSION;
  configuredMaxCalls: number;
  plannedClubSeasonUnits: number;
  initialCacheHits: number;
  initialMissingUnits: number;
  seed: ReturnType<typeof seedMu2024ScheduleIntoBulk>;
  firstPass: {
    providerCallsAttempted: number;
    providerCallsSucceeded: number;
    providerCallsFailed: number;
    cacheHits: number;
    remainingBudget: number;
    unitResults: Array<{
      unitKey: string;
      ok: boolean;
      cacheHit: boolean;
      contentDigest?: string;
      reason?: string;
      message?: string;
    }>;
  };
  secondPass: {
    providerCallsAttempted: number;
    cacheHits: number;
    wouldCallProvider: boolean;
  };
  universe: {
    rawScheduleRows: number;
    uniqueFixtures: number;
    duplicatesCollapsed: number;
    conflictingDuplicates: number;
    conflictingFixtureIds: string[];
    malformedFixtures: number;
    kickoffMin: string | null;
    kickoffMax: string | null;
    statusesObserved: Record<string, number>;
  };
  competitionsObserved: Pe4I5CompetitionInventoryRow[];
  newCompetitionRegistryPins: Pe4I5CompetitionPinProposal[];
  pinProposalsAll: Pe4I5CompetitionPinProposal[];
  crossCompetitionHistoryStatus: string;
  calendar2025InsideProvider2024: Array<{
    providerFixtureId: string;
    kickoffUtc: string;
    providerCompetitionId: string | null;
    providerCompetitionName: string | null;
    status: string;
    discoveredFromProviderSeason: string;
  }>;
  primaryStatsQueueByCompetition: Record<string, number>;
  excludedAuditCounts: Record<string, number>;
  exactStage2UniqueFixtures: number;
  existingStatisticsCacheHits: number;
  exactStage2NewCallsRequired: number;
  naiveStatisticsCalls: number;
  dedupeCallsAvoided: number;
  stage2QueueDigest: string;
  xgStatus: typeof PE4I4_XG_STATUS;
  holdout2025Status: "SEALED";
  artifactDigests: Record<string, string>;
  statisticsEndpointAttempts: number;
  errors: string[];
};

export async function runPe4I5Stage1ScheduleDiscovery(input: {
  transport: Pe4I2ProviderTransport;
  maxCalls: number;
  cwd?: string;
  acquiredAtUtc?: string;
  /** When true, skip first-pass provider acquisition (offline resume proof only). */
  skipAcquire?: boolean;
}): Promise<Pe4I5Stage1Report> {
  const cwd = input.cwd ?? process.cwd();
  if (input.maxCalls > PE4I5_STAGE1_HARD_MAX_CALLS) {
    throw new Error(
      `maxCalls ${input.maxCalls} exceeds Stage-1 hard max ${PE4I5_STAGE1_HARD_MAX_CALLS}`,
    );
  }
  assertSeasonAllowed("2023");
  assertSeasonAllowed("2024");

  const acquiredAtUtc = input.acquiredAtUtc ?? new Date().toISOString();
  const scheduleTransport = createScheduleOnlyTransport(input.transport);
  mkdirSync(bulkCacheRoot(cwd), { recursive: true });
  const bulkCache = createPe4I2AcquisitionCache(bulkCacheRoot(cwd));
  const seed = seedMu2024ScheduleIntoBulk({ cwd, bulkCache });

  const plan = buildPe4I4BulkAcquisitionPlan({
    cwd,
    caches: [bulkCache, ...listUsableAcquisitionCaches(cwd)],
  });

  // Prefer bulk as sole writable cache for acquisition; seed makes MU present.
  const units: Pe4I4ClubSeasonUnit[] = plan.clubSeasonUnits.map((u) => {
    const inBulk = bulkCache.getUnit(u.unitKey);
    return {
      ...u,
      cached: inBulk?.status === "completed",
      cacheRootRelative:
        inBulk?.status === "completed"
          ? path.relative(cwd, bulkCache.rootDir).replace(/\\/g, "/")
          : u.cacheRootRelative,
    };
  });
  const initialCacheHits = units.filter((u) => u.cached).length;
  const initialMissingUnits = units.length - initialCacheHits;
  if (initialMissingUnits > input.maxCalls) {
    throw new Error(
      `STOP: ${initialMissingUnits} missing units exceed maxCalls=${input.maxCalls}`,
    );
  }

  const errors: string[] = [];
  const budget1 = createPe4I2CallBudget(input.maxCalls);
  const unitResults: Pe4I5Stage1Report["firstPass"]["unitResults"] = [];

  if (!input.skipAcquire) {
    for (const unit of units) {
      const res = await acquireScheduleUnit({
        transport: scheduleTransport,
        budget: budget1,
        cache: bulkCache,
        providerTeamId: unit.providerTeamId,
        season: unit.season,
        acquiredAtUtc,
      });
      if (res.ok) {
        unitResults.push({
          unitKey: res.unitKey,
          ok: true,
          cacheHit: res.cacheHit,
          contentDigest: res.contentDigest,
        });
      } else {
        unitResults.push({
          unitKey: res.unitKey,
          ok: false,
          cacheHit: false,
          reason: res.reason,
          message: res.message,
        });
        errors.push(`${res.unitKey}: ${res.reason}: ${res.message}`);
      }
    }
  } else {
    for (const unit of units) {
      const existing = bulkCache.getUnit(unit.unitKey);
      if (existing?.status === "completed" && existing.contentDigest) {
        budget1.recordCacheHit();
        unitResults.push({
          unitKey: unit.unitKey,
          ok: true,
          cacheHit: true,
          contentDigest: existing.contentDigest,
        });
      } else {
        unitResults.push({
          unitKey: unit.unitKey,
          ok: false,
          cacheHit: false,
          reason: "absent",
          message: "skipAcquire and unit not cached",
        });
      }
    }
  }

  const snap1 = budget1.snapshot();

  // Load full 40-unit universe from bulk (+ smoke fallback).
  const caches = [bulkCache, ...listUsableAcquisitionCaches(cwd)];
  const envelopes: Pe4I2RawScheduleEnvelope[] = [];
  let malformedFixtures = 0;
  for (const unit of units) {
    const env = loadScheduleEnvelope(caches, unit.unitKey);
    if (!env) {
      errors.push(`missing envelope for ${unit.unitKey}`);
      continue;
    }
    envelopes.push(env);
  }

  const allRows = envelopes.flatMap((e) =>
    e.fixtures.map((f) => ({
      ...f,
      discoveredFromProviderSeason: e.requestedSeason,
    })),
  );
  const rawScheduleRows = allRows.length;
  const deduped = dedupeScheduleFixtures(allRows);
  let uniqueFixtures = 0;
  let duplicatesCollapsed = 0;
  let conflictingDuplicates = 0;
  const conflictingFixtureIds: string[] = [];
  let uniqueList: Pe4I2RawScheduleFixtureRow[] = [];
  if (!deduped.ok) {
    conflictingDuplicates = 1;
    if (deduped.providerFixtureId) {
      conflictingFixtureIds.push(deduped.providerFixtureId);
    }
    errors.push(deduped.message);
    // Fail-closed for conflicting fixture: exclude it and continue inventory
    // on remaining by collapsing only identicals via manual pass.
    const byId = new Map<string, Pe4I2RawScheduleFixtureRow>();
    for (const row of allRows) {
      const id = row.providerFixtureId?.trim();
      if (!id) {
        malformedFixtures += 1;
        continue;
      }
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, row);
        continue;
      }
      if (existing.identityDigest === row.identityDigest) {
        duplicatesCollapsed += 1;
        continue;
      }
      conflictingDuplicates += 1;
      if (!conflictingFixtureIds.includes(id)) conflictingFixtureIds.push(id);
      byId.delete(id); // fail closed — drop conflicting id
    }
    uniqueList = [...byId.values()].sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.providerFixtureId.localeCompare(b.providerFixtureId);
    });
    uniqueFixtures = uniqueList.length;
  } else {
    uniqueList = deduped.fixtures;
    uniqueFixtures = deduped.fixtures.length;
    duplicatesCollapsed = deduped.collapsedIdenticalDuplicates;
  }

  const statusesObserved: Record<string, number> = {};
  for (const f of uniqueList) {
    statusesObserved[f.status] = (statusesObserved[f.status] ?? 0) + 1;
  }
  const kickoffs = uniqueList.map((f) => f.kickoffUtc).sort();
  const kickoffMin = kickoffs[0] ?? null;
  const kickoffMax = kickoffs[kickoffs.length - 1] ?? null;

  const competitionsObserved = buildCompetitionInventory(allRows);
  const pinProposalsAll = proposeEvidenceBackedCompetitionPins(uniqueList);
  const newCompetitionRegistryPins = newCompetitionPinsToApply(uniqueList);
  const pinOverrides = new Map<string, Pe4I2CompetitionClass>(
    newCompetitionRegistryPins.map((p) => [
      p.providerCompetitionId,
      p.competitionClass,
    ]),
  );

  const calendar2025InsideProvider2024 = uniqueList
    .filter((f) => {
      const season =
        allRows.find((r) => r.providerFixtureId === f.providerFixtureId)
          ?.discoveredFromProviderSeason ?? null;
      return (
        season === "2024" && calendarKickoffYear(f.kickoffUtc) === 2025
      );
    })
    .map((f) => ({
      providerFixtureId: f.providerFixtureId,
      kickoffUtc: f.kickoffUtc,
      providerCompetitionId: f.providerCompetitionId,
      providerCompetitionName: f.providerCompetitionName,
      status: f.status,
      discoveredFromProviderSeason: "2024" as const,
    }));

  const queueBuild = buildStage2QueueAndAudit({
    envelopes,
    acquisitionNowUtc: acquiredAtUtc,
    pinOverrides,
  });

  // Existing statistics cache hits (PE-4I.3 sample if in queue).
  let existingStatisticsCacheHits = 0;
  for (const fixtureId of queueBuild.fixtureIds) {
    const key = statisticsUnitKey(fixtureId);
    for (const cache of caches) {
      const u = cache.getUnit(key);
      if (u?.status === "completed") {
        existingStatisticsCacheHits += 1;
        break;
      }
    }
  }

  const exactStage2UniqueFixtures = queueBuild.fixtureIds.length;
  const exactStage2NewCallsRequired = Math.max(
    0,
    exactStage2UniqueFixtures - existingStatisticsCacheHits,
  );
  const naiveStatisticsCalls = queueBuild.naiveTeamFixtureStatisticsRequests;
  const dedupeCallsAvoided = Math.max(
    0,
    naiveStatisticsCalls - exactStage2UniqueFixtures,
  );

  const crossCompetitionHistoryStatus = competitionsObserved.some(
    (c) =>
      c.providerCompetitionId != null && c.providerCompetitionId !== "39",
  )
    ? "CONFIRMED_MULTI_COMPETITION_IN_TEAM_SEASON_SCHEDULES"
    : "ONLY_PREMIER_LEAGUE_OBSERVED";

  // Second pass — must be cache-only.
  const budget2 = createPe4I2CallBudget(input.maxCalls);
  let secondWouldCall = false;
  for (const unit of units) {
    const existing = bulkCache.getUnit(unit.unitKey);
    if (existing?.status === "completed" && existing.contentDigest) {
      budget2.recordCacheHit();
      continue;
    }
    // Would need provider — STOP diagnosis path (do not call).
    secondWouldCall = true;
    errors.push(
      `second-pass would call provider for ${unit.unitKey}; aborting provider use`,
    );
  }
  const snap2 = budget2.snapshot();
  if (secondWouldCall) {
    // Do not spend calls; report failure for resume proof.
  }

  // Artifacts
  const artDir = artifactRoot(cwd);
  const artifactDigests: Record<string, string> = {};
  const manifest = {
    stage1Version: PE4I5_STAGE1_VERSION,
    acquiredAtUtc,
    configuredMaxCalls: input.maxCalls,
    units: unitResults,
    seed,
    firstPassBudget: snap1,
    secondPassBudget: snap2,
  };
  const a1 = writeArtifact(artDir, "schedule-acquisition-manifest.json", manifest);
  artifactDigests["schedule-acquisition-manifest.json"] = a1.digest;

  const a2 = writeArtifact(artDir, "normalized-fixture-universe.json", {
    rawScheduleRows,
    uniqueFixtures,
    duplicatesCollapsed,
    conflictingDuplicates,
    conflictingFixtureIds,
    malformedFixtures,
    kickoffMin,
    kickoffMax,
    statusesObserved,
    fixtures: uniqueList,
  });
  artifactDigests["normalized-fixture-universe.json"] = a2.digest;

  const a3 = writeArtifact(artDir, "competition-inventory.json", {
    competitions: competitionsObserved,
    pinProposalsAll,
    newCompetitionRegistryPins,
  });
  artifactDigests["competition-inventory.json"] = a3.digest;

  const a4 = writeArtifact(artDir, "stage2-statistics-queue.json", {
    fixtureIds: queueBuild.fixtureIds,
    queueDigest: queueBuild.queueDigest,
    primaryByCompetition: queueBuild.primaryByCompetition,
    exactStage2UniqueFixtures,
    existingStatisticsCacheHits,
    exactStage2NewCallsRequired,
    naiveStatisticsCalls,
    dedupeCallsAvoided,
  });
  artifactDigests["stage2-statistics-queue.json"] = a4.digest;

  const a5 = writeArtifact(artDir, "excluded-audit-inventory.json", {
    excludedAuditCounts: queueBuild.excludedAuditCounts,
    excluded: queueBuild.excluded,
    composition: queueBuild.composition,
  });
  artifactDigests["excluded-audit-inventory.json"] = a5.digest;

  const a6 = writeArtifact(artDir, "call-accounting.json", {
    configuredMaxCalls: input.maxCalls,
    plannedMissingUnits: initialMissingUnits,
    providerCallsAttempted: snap1.attempted,
    providerCallsSucceeded: snap1.succeeded,
    providerCallsFailed: snap1.failed,
    cacheHits: snap1.cacheHits,
    remainingBudget: snap1.remaining,
    secondPassProviderCalls: snap2.attempted,
    secondPassCacheHits: snap2.cacheHits,
    statisticsEndpointAttempts: scheduleTransport.statisticsAttempts,
  });
  artifactDigests["call-accounting.json"] = a6.digest;

  const a7 = writeArtifact(artDir, "cache-resume-verification.json", {
    firstPassProviderCalls: snap1.attempted,
    secondPassProviderCalls: snap2.attempted,
    secondPassCacheHits: snap2.cacheHits,
    secondPassWouldCallProvider: secondWouldCall,
    completedScheduleUnits: units.filter(
      (u) => bulkCache.getUnit(u.unitKey)?.status === "completed",
    ).length,
  });
  artifactDigests["cache-resume-verification.json"] = a7.digest;

  const a8 = writeArtifact(artDir, "calendar-2025-spill.json", {
    count: calendar2025InsideProvider2024.length,
    fixtures: calendar2025InsideProvider2024,
  });
  artifactDigests["calendar-2025-spill.json"] = a8.digest;

  void sha256Json;

  return {
    phase: "PE4I5_STAGE1_SCHEDULE_DISCOVERY",
    stage1Version: PE4I5_STAGE1_VERSION,
    configuredMaxCalls: input.maxCalls,
    plannedClubSeasonUnits: units.length,
    initialCacheHits,
    initialMissingUnits,
    seed,
    firstPass: {
      providerCallsAttempted: snap1.attempted,
      providerCallsSucceeded: snap1.succeeded,
      providerCallsFailed: snap1.failed,
      cacheHits: snap1.cacheHits,
      remainingBudget: snap1.remaining,
      unitResults,
    },
    secondPass: {
      providerCallsAttempted: snap2.attempted,
      cacheHits: snap2.cacheHits,
      wouldCallProvider: secondWouldCall,
    },
    universe: {
      rawScheduleRows,
      uniqueFixtures,
      duplicatesCollapsed,
      conflictingDuplicates,
      conflictingFixtureIds,
      malformedFixtures,
      kickoffMin,
      kickoffMax,
      statusesObserved,
    },
    competitionsObserved,
    newCompetitionRegistryPins,
    pinProposalsAll,
    crossCompetitionHistoryStatus,
    calendar2025InsideProvider2024,
    primaryStatsQueueByCompetition: queueBuild.primaryByCompetition,
    excludedAuditCounts: queueBuild.excludedAuditCounts,
    exactStage2UniqueFixtures,
    existingStatisticsCacheHits,
    exactStage2NewCallsRequired,
    naiveStatisticsCalls,
    dedupeCallsAvoided,
    stage2QueueDigest: queueBuild.queueDigest,
    xgStatus: PE4I4_XG_STATUS,
    holdout2025Status: "SEALED",
    artifactDigests,
    statisticsEndpointAttempts: scheduleTransport.statisticsAttempts,
    errors,
  };
}

export function pe4I5ArtifactDir(cwd = process.cwd()): string {
  return artifactRoot(cwd);
}

export function pe4I5BulkCacheExists(cwd = process.cwd()): boolean {
  return existsSync(bulkCacheRoot(cwd));
}
