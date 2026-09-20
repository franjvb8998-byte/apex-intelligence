/**
 * Atomic discovery-artifact persistence. Gitignored. No credentials. No raw payloads.
 */

import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISCOVERY_DATA_DIR,
  DiscoveryIntegrityError,
  type DiscoveryArtifact,
} from "@/lib/debug/calibration/prospective/live/discovery-types";
import { assertSafeProjectedObject } from "@/lib/debug/calibration/prospective/live/discovery-projection";

const CREDENTIAL_PATTERN = /api[_-]?key|x-apisports-key|authorization\s*:|bearer\s+[a-z0-9._-]+/i;

export function discoveryDirectory(root?: string): string {
  if (root) return root;
  return join(process.cwd(), DISCOVERY_DATA_DIR);
}

export function assertDiscoveryPersistPath(path: string): void {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.includes("/pending/") || normalized.endsWith("/pending")) {
    throw new DiscoveryIntegrityError("discovery must not write pending prediction records");
  }
  if (normalized.includes("/scored/") || normalized.endsWith("/scored")) {
    throw new DiscoveryIntegrityError("discovery must not write scored prediction records");
  }
}

function cleanupTemp(tmpPath: string): void {
  if (existsSync(tmpPath)) {
    unlinkSync(tmpPath);
  }
}

export function persistDiscoveryArtifact(input: {
  artifact: DiscoveryArtifact;
  persistRoot?: string;
}): { path: string } {
  assertSafeProjectedObject(input.artifact);
  const serialized = `${JSON.stringify(input.artifact, null, 2)}\n`;
  if (CREDENTIAL_PATTERN.test(serialized)) {
    throw new DiscoveryIntegrityError("Refusing to persist a discovery artifact that looks like it contains credentials");
  }

  const directory = discoveryDirectory(input.persistRoot);
  assertDiscoveryPersistPath(directory);
  mkdirSync(directory, { recursive: true });
  const stamp = input.artifact.discoveredAtUtc.replace(/[:.]/g, "-");
  const target = join(directory, `discovery-${stamp}.json`);
  assertDiscoveryPersistPath(target);
  const tmpPath = `${target}.tmp`;
  if (existsSync(target)) {
    throw new DiscoveryIntegrityError(`refusing overwrite of existing discovery artifact ${target}`);
  }
  try {
    writeFileSync(tmpPath, serialized, "utf8");
    if (existsSync(target)) {
      throw new DiscoveryIntegrityError(`refusing overwrite of existing discovery artifact ${target}`);
    }
    renameSync(tmpPath, target);
  } catch (error) {
    cleanupTemp(tmpPath);
    throw error;
  }
  return { path: target };
}
