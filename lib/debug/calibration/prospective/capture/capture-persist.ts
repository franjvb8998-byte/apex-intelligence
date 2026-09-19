/**
 * Pending-only prospective persistence. No scored writes. No overwrite.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";
import { assertNotHistoricalOutcomeDataset } from "@/lib/debug/calibration/prospective/candidate-integrity";
import type {
  CapturePersistResult,
  PriorCaptureIndex,
  ProspectiveCaptureBatch,
} from "@/lib/debug/calibration/prospective/capture/capture-types";
import { PROSPECTIVE_DATA_DIR } from "@/lib/debug/calibration/prospective/capture/capture-types";

export function resolveProspectiveRoot(root?: string): string {
  return root ?? join(process.cwd(), PROSPECTIVE_DATA_DIR);
}

export function pendingDirectory(root?: string): string {
  return join(resolveProspectiveRoot(root), "pending");
}

export function scoredDirectory(root?: string): string {
  return join(resolveProspectiveRoot(root), "scored");
}

export function batchFilePath(batchId: string, root?: string): string {
  return join(pendingDirectory(root), `${batchId}.json`);
}

export function loadPriorCaptureIndex(root?: string): PriorCaptureIndex {
  const directory = pendingDirectory(root);
  if (!existsSync(directory)) {
    return { entries: [] };
  }
  const entries: PriorCaptureIndex["entries"] = [];
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json") || name.endsWith(".tmp.json") || name.endsWith(".tmp")) {
      continue;
    }
    const path = join(directory, name);
    assertNotHistoricalOutcomeDataset(path);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ProspectiveCaptureBatch;
    for (const fixtureId of parsed.fixtureIds) {
      entries.push({
        fixtureId,
        candidateFingerprint: parsed.candidateFingerprint,
        batchId: parsed.batchId,
      });
    }
  }
  return { entries };
}

export function findPriorFixtureCapture(
  index: PriorCaptureIndex,
  fixtureId: string,
  fingerprint: string,
): { fixtureId: string; candidateFingerprint: string; batchId: string } | null {
  return (
    index.entries.find(
      (entry) => entry.fixtureId === fixtureId && entry.candidateFingerprint === fingerprint,
    ) ?? null
  );
}

function cleanupTemp(tmpPath: string): void {
  if (existsSync(tmpPath)) {
    unlinkSync(tmpPath);
  }
}

export function persistPendingBatch(input: {
  batch: ProspectiveCaptureBatch;
  persistRoot?: string;
  simulateFailureAfterTempWrite?: boolean;
}): CapturePersistResult {
  const serialized = `${JSON.stringify(input.batch, null, 2)}\n`;
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new ProspectiveIntegrityError("Refusing to persist a batch that looks like it contains an API key");
  }
  if (serialized.includes("/data/calibration/") || serialized.includes("\\data\\calibration\\")) {
    throw new ProspectiveIntegrityError("prospective persistence cannot reference data/calibration");
  }

  const pending = pendingDirectory(input.persistRoot);
  mkdirSync(pending, { recursive: true });
  const target = batchFilePath(input.batch.batchId, input.persistRoot);
  const tmpPath = `${target}.tmp`;

  if (existsSync(target)) {
    throw new ProspectiveIntegrityError(`refusing overwrite of existing batch ${input.batch.batchId}`);
  }

  try {
    writeFileSync(tmpPath, serialized, "utf8");
    if (input.simulateFailureAfterTempWrite) {
      throw new ProspectiveIntegrityError("simulated persist failure after temporary write");
    }
    if (existsSync(target)) {
      throw new ProspectiveIntegrityError(`refusing overwrite of existing batch ${input.batch.batchId}`);
    }
    renameSync(tmpPath, target);
  } catch (error) {
    cleanupTemp(tmpPath);
    throw error;
  }

  return {
    path: target,
    batchId: input.batch.batchId,
    recordsHash: input.batch.recordsHash,
    evidenceManifestHash: input.batch.evidenceManifestHash,
    batchHash: input.batch.batchHash,
  };
}

export function loadPendingBatch(batchId: string, persistRoot?: string): ProspectiveCaptureBatch {
  const path = batchFilePath(batchId, persistRoot);
  assertNotHistoricalOutcomeDataset(path);
  return JSON.parse(readFileSync(path, "utf8")) as ProspectiveCaptureBatch;
}
