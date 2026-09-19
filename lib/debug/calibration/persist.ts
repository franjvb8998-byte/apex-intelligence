/**
 * Dataset artifacts. Never writes on import. No secrets.
 */

import { mkdirSync, renameSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CALIBRATION_ARTIFACT_DIR,
  type CalibrationRow,
  type CollectionRunMetadata,
} from "@/lib/debug/calibration/types";

export function loadCalibrationDataset(jsonlPath: string): CalibrationRow[] {
  const text = readFileSync(jsonlPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CalibrationRow);
}

export function writeCalibrationArtifacts(input: {
  rows: readonly CalibrationRow[];
  metadata: CollectionRunMetadata;
  directory?: string;
}): { datasetPath: string; metadataPath: string } {
  const serialized = JSON.stringify(input.metadata);
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new Error("Refusing to write calibration metadata that looks like it contains an API key");
  }
  const directory = input.directory ?? CALIBRATION_ARTIFACT_DIR;
  mkdirSync(directory, { recursive: true });
  const stamp = input.metadata.collectionTimestamp.replace(/[:.]/g, "-");
  const datasetPath = join(directory, `micro-${stamp}.jsonl`);
  const metadataPath = join(directory, `micro-${stamp}.meta.json`);
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
