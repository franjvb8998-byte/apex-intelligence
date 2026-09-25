/**
 * PE-4I.6 — Frozen Stage-2 queue loader + deterministic batch selection.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createPe4I2AcquisitionCache,
  statisticsUnitKey,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { PE4I5_ARTIFACT_SUBDIR } from "@/lib/debug/calibration/pe4-acquisition/stage1-discovery";

/** Frozen PE-4I.5 Stage-2 queue digest — must match artifact exactly. */
export const PE4I5_FROZEN_STAGE2_QUEUE_DIGEST =
  "876199537371df35d1f70c9035121b3a4edd342bb1f42afdc7de7af7ede4e45f" as const;

export const PE4I5_FROZEN_STAGE2_QUEUE_SIZE = 1094 as const;

export type Pe4I5FrozenStage2Queue = {
  fixtureIds: string[];
  queueDigest: string;
  exactStage2UniqueFixtures: number;
  existingStatisticsCacheHits: number;
  exactStage2NewCallsRequired: number;
  naiveStatisticsCalls: number;
  dedupeCallsAvoided: number;
  primaryByCompetition: Record<string, number>;
};

export function stage1ArtifactDir(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I5_ARTIFACT_SUBDIR);
}

export function frozenStage2QueuePath(cwd = process.cwd()): string {
  return path.join(stage1ArtifactDir(cwd), "stage2-statistics-queue.json");
}

export function loadFrozenStage2Queue(cwd = process.cwd()): Pe4I5FrozenStage2Queue {
  const p = frozenStage2QueuePath(cwd);
  if (!existsSync(p)) {
    throw new Error(`PE-4I.5 Stage-2 queue artifact missing: ${p}`);
  }
  const parsed = JSON.parse(readFileSync(p, "utf8")) as Pe4I5FrozenStage2Queue;
  if (!Array.isArray(parsed.fixtureIds) || parsed.fixtureIds.length === 0) {
    throw new Error("Stage-2 queue fixtureIds missing/empty");
  }
  const recomputed = createHash("sha256")
    .update(parsed.fixtureIds.join("\n"), "utf8")
    .digest("hex");
  if (parsed.queueDigest !== recomputed) {
    throw new Error(
      `Stage-2 queue digest mismatch: artifact=${parsed.queueDigest} recomputed=${recomputed}`,
    );
  }
  if (parsed.queueDigest !== PE4I5_FROZEN_STAGE2_QUEUE_DIGEST) {
    throw new Error(
      `Stage-2 queue digest differs from PE-4I.5 frozen: got=${parsed.queueDigest} expected=${PE4I5_FROZEN_STAGE2_QUEUE_DIGEST}`,
    );
  }
  if (parsed.fixtureIds.length !== PE4I5_FROZEN_STAGE2_QUEUE_SIZE) {
    throw new Error(
      `Stage-2 queue size ${parsed.fixtureIds.length} != ${PE4I5_FROZEN_STAGE2_QUEUE_SIZE}`,
    );
  }
  // Canonical order is sorted fixture IDs (PE-4I.5).
  const sorted = [...parsed.fixtureIds].sort();
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== parsed.fixtureIds[i]) {
      throw new Error("Stage-2 queue is not in canonical sorted order");
    }
  }
  return parsed;
}

export function listStatisticsCaches(cwd = process.cwd()): Pe4I2AcquisitionCache[] {
  const out: Pe4I2AcquisitionCache[] = [];
  for (const sub of ["smoke-i3", "bulk"]) {
    const root = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, sub);
    if (existsSync(root)) out.push(createPe4I2AcquisitionCache(root));
  }
  return out;
}

export function isStatisticsCached(
  fixtureId: string,
  caches: readonly Pe4I2AcquisitionCache[],
): boolean {
  const key = statisticsUnitKey(fixtureId);
  for (const cache of caches) {
    const u = cache.getUnit(key);
    if (u?.status === "completed" && u.contentDigest) return true;
  }
  return false;
}

export type Pe4I6BatchSelection = {
  queueSize: number;
  queueDigest: string;
  initialCachedCount: number;
  initialUncachedCount: number;
  selectedFixtureIds: string[];
  selectedBatchSize: number;
  firstSelectedFixtureId: string | null;
  lastSelectedFixtureId: string | null;
  batchSelectionDigest: string;
  skippedCachedIds: string[];
};

/**
 * Walk frozen queue in canonical order; skip valid cache hits; take up to maxNew.
 */
export function selectStatisticsBatch(input: {
  fixtureIds: readonly string[];
  queueDigest: string;
  caches: readonly Pe4I2AcquisitionCache[];
  maxNew: number;
}): Pe4I6BatchSelection {
  if (!Number.isInteger(input.maxNew) || input.maxNew <= 0) {
    throw new Error("maxNew must be a positive integer");
  }
  const selected: string[] = [];
  const skippedCached: string[] = [];
  let cached = 0;
  for (const id of input.fixtureIds) {
    if (isStatisticsCached(id, input.caches)) {
      cached += 1;
      skippedCached.push(id);
      continue;
    }
    if (selected.length < input.maxNew) {
      selected.push(id);
    }
  }
  const uncached = input.fixtureIds.length - cached;
  return {
    queueSize: input.fixtureIds.length,
    queueDigest: input.queueDigest,
    initialCachedCount: cached,
    initialUncachedCount: uncached,
    selectedFixtureIds: selected,
    selectedBatchSize: selected.length,
    firstSelectedFixtureId: selected[0] ?? null,
    lastSelectedFixtureId: selected[selected.length - 1] ?? null,
    batchSelectionDigest: createHash("sha256")
      .update(selected.join("\n"), "utf8")
      .digest("hex"),
    skippedCachedIds: skippedCached,
  };
}
