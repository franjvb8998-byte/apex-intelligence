/**
 * Atomic scored-artifact persistence. Never writes pending files. Temp dirs in tests.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import type { ProspectiveScoredArtifact } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import { ScoringRejectedError, emptyScoringReport } from "@/lib/debug/calibration/prospective/scoring/scoring-types";
import { verifyScoredHashes } from "@/lib/debug/calibration/prospective/scoring/scoring-hash";

export function scoredDirectory(root: string): string {
  return join(root, "scored");
}

export function scoredArtifactPath(root: string, sourceBatchId: string, fixtureId: string): string {
  return join(scoredDirectory(root), `scored-${sourceBatchId}-${fixtureId}.json`);
}

export function assertNotPendingPath(path: string): void {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("/pending/") || normalized.endsWith("/pending")) {
    throw new ProspectiveIntegrityError("scoring must not write pending artifacts");
  }
}

function cleanupTemp(tmpPath: string): void {
  if (existsSync(tmpPath)) unlinkSync(tmpPath);
}

export function readPendingBytes(path: string): Buffer {
  return readFileSync(path);
}

export function assertPendingBytesUnchanged(path: string, before: Buffer): void {
  const after = readFileSync(path);
  if (!before.equals(after)) {
    throw new ProspectiveIntegrityError("pending source artifact was mutated");
  }
}

export function persistScoredArtifact(input: {
  artifact: ProspectiveScoredArtifact;
  persistRoot: string;
  simulateFailureAfterTempWrite?: boolean;
}): { path: string } {
  verifyScoredHashes(input.artifact);
  const serialized = `${JSON.stringify(input.artifact, null, 2)}\n`;
  if (/api[_-]?key|apisports[-_]?key/i.test(serialized)) {
    throw new ScoringRejectedError(
      "refusing to persist credentials",
      emptyScoringReport({ fixtureId: input.artifact.fixtureId }),
    );
  }
  const target = scoredArtifactPath(input.persistRoot, input.artifact.sourceBatchId, input.artifact.fixtureId);
  assertNotPendingPath(target);
  mkdirSync(scoredDirectory(input.persistRoot), { recursive: true });
  if (existsSync(target)) {
    throw new ScoringRejectedError(
      "already scored",
      emptyScoringReport({
        fixtureId: input.artifact.fixtureId,
        sourceBatchId: input.artifact.sourceBatchId,
        persistenceDisposition: "ALREADY_SCORED",
      }),
      "ALREADY_SCORED",
    );
  }
  const tmpPath = `${target}.tmp`;
  try {
    writeFileSync(tmpPath, serialized, "utf8");
    if (input.simulateFailureAfterTempWrite) {
      throw new ScoringRejectedError(
        "simulated persist failure after temporary write",
        emptyScoringReport({ fixtureId: input.artifact.fixtureId, persistenceDisposition: "FAILED" }),
      );
    }
    if (existsSync(target)) {
      throw new ScoringRejectedError(
        "overwrite refused",
        emptyScoringReport({ fixtureId: input.artifact.fixtureId, persistenceDisposition: "ALREADY_SCORED" }),
        "ALREADY_SCORED",
      );
    }
    renameSync(tmpPath, target);
  } catch (error) {
    cleanupTemp(tmpPath);
    throw error;
  }
  return { path: target };
}

export function loadScoredArtifact(
  persistRoot: string,
  sourceBatchId: string,
  fixtureId: string,
): ProspectiveScoredArtifact {
  return JSON.parse(readFileSync(scoredArtifactPath(persistRoot, sourceBatchId, fixtureId), "utf8")) as ProspectiveScoredArtifact;
}
