/**
 * Dataset artifacts. Never writes on import. No secrets.
 */

import { mkdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CALIBRATION_ARTIFACT_DIR,
  type CalibrationRow,
  type CollectionRunMetadata,
  type PilotRunMetadata,
} from "@/lib/debug/calibration/types";

export function loadCalibrationDataset(jsonlPath: string): CalibrationRow[] {
  const text = readFileSync(jsonlPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CalibrationRow);
}

function artifactTimestamp(metadata: CollectionRunMetadata | PilotRunMetadata): string {
  const value =
    "collectionTimestamp" in metadata && metadata.collectionTimestamp
      ? metadata.collectionTimestamp
      : "generatedAt" in metadata
        ? metadata.generatedAt
        : "";
  if (!value) {
    throw new Error("Calibration artifact timestamp is missing");
  }
  return value.replace(/[:.]/g, "-");
}

export function writeCalibrationArtifacts(input: {
  rows: readonly CalibrationRow[];
  metadata: CollectionRunMetadata | PilotRunMetadata;
  directory?: string;
  filePrefix?: "micro" | "pilot";
}): { datasetPath: string; metadataPath: string } {
  const serialized = JSON.stringify(input.metadata);
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new Error("Refusing to write calibration metadata that looks like it contains an API key");
  }
  const directory = input.directory ?? CALIBRATION_ARTIFACT_DIR;
  mkdirSync(directory, { recursive: true });
  const stamp = artifactTimestamp(input.metadata);
  const prefix = input.filePrefix ?? "micro";
  const datasetPath = join(directory, `${prefix}-${stamp}.jsonl`);
  const metadataPath = join(directory, `${prefix}-${stamp}.meta.json`);
  const datasetBody = `${input.rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  const metadataBody = `${JSON.stringify(input.metadata, null, 2)}\n`;
  const datasetTmp = `${datasetPath}.tmp`;
  const metadataTmp = `${metadataPath}.tmp`;
  writeFileSync(datasetTmp, datasetBody, "utf8");
  writeFileSync(metadataTmp, metadataBody, "utf8");
  renameSync(datasetTmp, datasetPath);
  renameSync(metadataTmp, metadataPath);
  return { datasetPath, metadataPath };
}

export type PilotArtifactPaths = {
  populationPath: string;
  samplePath: string;
  metadataPath: string;
};

function writeJsonlAtomic(path: string, rows: readonly CalibrationRow[]): void {
  const tmp = `${path}.tmp`;
  writeFileSync(
    tmp,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
  renameSync(tmp, path);
}

export function writePilotArtifacts(input: {
  population: readonly CalibrationRow[];
  sample: readonly CalibrationRow[];
  metadata: PilotRunMetadata;
  directory?: string;
}): PilotArtifactPaths & { metadata: PilotRunMetadata } {
  const serialized = JSON.stringify(input.metadata);
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new Error("Refusing to write calibration metadata that looks like it contains an API key");
  }
  const directory = input.directory ?? CALIBRATION_ARTIFACT_DIR;
  mkdirSync(directory, { recursive: true });
  const stamp = artifactTimestamp(input.metadata);
  const populationName = `pilot-${stamp}.population.jsonl`;
  const sampleName = `pilot-${stamp}.sample.jsonl`;
  const metadataName = `pilot-${stamp}.meta.json`;
  const populationPath = join(directory, populationName);
  const samplePath = join(directory, sampleName);
  const metadataPath = join(directory, metadataName);
  const metadata: PilotRunMetadata = {
    ...input.metadata,
    populationArtifact: populationName,
    sampleArtifact: sampleName,
    populationRowCount: input.population.length,
    sampleRowCount: input.sample.length,
    fullEligiblePopulationCount: input.population.length,
    targetRowCount: input.sample.length,
  };
  writeJsonlAtomic(populationPath, input.population);
  writeJsonlAtomic(samplePath, input.sample);
  const metadataTmp = `${metadataPath}.tmp`;
  writeFileSync(metadataTmp, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  renameSync(metadataTmp, metadataPath);
  return { populationPath, samplePath, metadataPath, metadata };
}

export function loadPilotArtifacts(metadataPath: string): {
  metadata: PilotRunMetadata;
  population: CalibrationRow[];
  sample: CalibrationRow[];
} {
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as PilotRunMetadata;
  const directory = dirname(metadataPath);
  if (!metadata.populationArtifact || !metadata.sampleArtifact) {
    throw new Error("Pilot metadata is missing populationArtifact/sampleArtifact");
  }
  return {
    metadata,
    population: loadCalibrationDataset(join(directory, metadata.populationArtifact)),
    sample: loadCalibrationDataset(join(directory, metadata.sampleArtifact)),
  };
}
