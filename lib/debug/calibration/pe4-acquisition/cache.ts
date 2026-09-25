/**
 * PE-4I.2 — Content-addressed research cache under data/calibration/ (gitignored).
 * Never silently overwrites conflicting digests.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I2_HOLDOUT_SEASON,
  assertSeasonAllowed,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

export type Pe4I2CacheUnitKind =
  | "team_season_schedule"
  | "fixture_statistics";

export type Pe4I2CacheUnitStatus =
  | "completed"
  | "failed"
  | "retryable"
  | "absent";

export type Pe4I2CacheUnitRecord = {
  unitKey: string;
  kind: Pe4I2CacheUnitKind;
  status: Pe4I2CacheUnitStatus;
  contentDigest: string | null;
  errorMessage: string | null;
  updatedAtUtc: string;
};

export type Pe4I2CacheManifest = {
  schemaVersion: "pe4.acquisition.cache_manifest.v1";
  rootRelative: typeof PE4I2_CACHE_ROOT_RELATIVE;
  units: Pe4I2CacheUnitRecord[];
  progress: {
    completed: number;
    failed: number;
    retryable: number;
    absent: number;
  };
  manifestDigest: string;
};

export class Pe4I2CacheConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pe4I2CacheConflictError";
  }
}

export class Pe4I2CacheCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Pe4I2CacheCorruptionError";
  }
}

export function scheduleUnitKey(teamId: string, season: string): string {
  assertSeasonAllowed(season);
  return `schedule::team=${teamId}::season=${season}`;
}

export function statisticsUnitKey(fixtureId: string): string {
  return `statistics::fixture=${fixtureId}`;
}

function digestManifestUnits(units: readonly Pe4I2CacheUnitRecord[]): string {
  const sorted = [...units].sort((a, b) => a.unitKey.localeCompare(b.unitKey));
  return createHash("sha256")
    .update(JSON.stringify(sorted), "utf8")
    .digest("hex");
}

function progressOf(units: readonly Pe4I2CacheUnitRecord[]) {
  const progress = { completed: 0, failed: 0, retryable: 0, absent: 0 };
  for (const u of units) {
    progress[u.status] += 1;
  }
  return progress;
}

export function buildManifest(
  units: readonly Pe4I2CacheUnitRecord[],
): Pe4I2CacheManifest {
  const list = [...units].sort((a, b) => a.unitKey.localeCompare(b.unitKey));
  return {
    schemaVersion: "pe4.acquisition.cache_manifest.v1",
    rootRelative: PE4I2_CACHE_ROOT_RELATIVE,
    units: list,
    progress: progressOf(list),
    manifestDigest: digestManifestUnits(list),
  };
}

export type Pe4I2AcquisitionCache = {
  rootDir: string;
  readManifest(): Pe4I2CacheManifest;
  writeManifest(manifest: Pe4I2CacheManifest): void;
  getUnit(unitKey: string): Pe4I2CacheUnitRecord | null;
  readRawJson(unitKey: string): unknown | null;
  /**
   * Atomic write of raw JSON + unit record.
   * If an existing completed unit has a different digest → conflict error.
   */
  putCompleted(input: {
    unitKey: string;
    kind: Pe4I2CacheUnitKind;
    contentDigest: string;
    payload: unknown;
    nowUtc?: string;
  }): void;
  putFailed(input: {
    unitKey: string;
    kind: Pe4I2CacheUnitKind;
    retryable: boolean;
    message: string;
    nowUtc?: string;
  }): void;
};

function atomicWriteJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(tmp, filePath);
}

export function createPe4I2AcquisitionCache(rootDir: string): Pe4I2AcquisitionCache {
  const manifestPath = path.join(rootDir, "manifest.json");
  const rawDir = path.join(rootDir, "raw");

  function readManifest(): Pe4I2CacheManifest {
    if (!existsSync(manifestPath)) return buildManifest([]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      throw new Pe4I2CacheCorruptionError("manifest JSON parse failed");
    }
    const m = parsed as Pe4I2CacheManifest;
    if (m.schemaVersion !== "pe4.acquisition.cache_manifest.v1") {
      throw new Pe4I2CacheCorruptionError("manifest schemaVersion mismatch");
    }
    const expected = digestManifestUnits(m.units ?? []);
    if (m.manifestDigest !== expected) {
      throw new Pe4I2CacheCorruptionError("manifest digest mismatch");
    }
    return m;
  }

  function writeManifest(manifest: Pe4I2CacheManifest): void {
    const rebuilt = buildManifest(manifest.units);
    atomicWriteJson(manifestPath, rebuilt);
  }

  function upsertUnit(record: Pe4I2CacheUnitRecord): void {
    const current = readManifest();
    const map = new Map(current.units.map((u) => [u.unitKey, u]));
    map.set(record.unitKey, record);
    writeManifest(buildManifest([...map.values()]));
  }

  return {
    rootDir,
    readManifest,
    writeManifest,
    getUnit(unitKey) {
      return readManifest().units.find((u) => u.unitKey === unitKey) ?? null;
    },
    readRawJson(unitKey) {
      const file = path.join(rawDir, `${encodeURIComponent(unitKey)}.json`);
      if (!existsSync(file)) return null;
      try {
        return JSON.parse(readFileSync(file, "utf8"));
      } catch {
        throw new Pe4I2CacheCorruptionError(`raw read failed for ${unitKey}`);
      }
    },
    putCompleted(input) {
      if (input.unitKey.includes(PE4I2_HOLDOUT_SEASON)) {
        throw new Error("holdout season must not enter cache keys");
      }
      const existing = this.getUnit(input.unitKey);
      if (
        existing?.status === "completed" &&
        existing.contentDigest &&
        existing.contentDigest !== input.contentDigest
      ) {
        throw new Pe4I2CacheConflictError(
          `cache conflict for ${input.unitKey}: existing digest differs`,
        );
      }
      const file = path.join(
        rawDir,
        `${encodeURIComponent(input.unitKey)}.json`,
      );
      atomicWriteJson(file, {
        unitKey: input.unitKey,
        contentDigest: input.contentDigest,
        payload: input.payload,
      });
      upsertUnit({
        unitKey: input.unitKey,
        kind: input.kind,
        status: "completed",
        contentDigest: input.contentDigest,
        errorMessage: null,
        updatedAtUtc: input.nowUtc ?? new Date().toISOString(),
      });
    },
    putFailed(input) {
      upsertUnit({
        unitKey: input.unitKey,
        kind: input.kind,
        status: input.retryable ? "retryable" : "failed",
        contentDigest: null,
        errorMessage: input.message,
        updatedAtUtc: input.nowUtc ?? new Date().toISOString(),
      });
    },
  };
}
