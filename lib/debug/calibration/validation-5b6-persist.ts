/**
 * Dual (population + meta) artifacts for 5B.6 holdout seasons.
 * Atomic writes. No secrets. No stratified sample.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CALIBRATION_ARTIFACT_DIR,
  type CalibrationRow,
  type ValidationSeasonMetadata,
} from "@/lib/debug/calibration/types";
import { loadCalibrationDataset } from "@/lib/debug/calibration/persist";

function writeJsonlAtomic(path: string, rows: readonly CalibrationRow[]): void {
  const tmp = `${path}.tmp`;
  writeFileSync(
    tmp,
    `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
  renameSync(tmp, path);
}

function seasonStamp(metadata: ValidationSeasonMetadata): string {
  return metadata.generatedAt.replace(/[:.]/g, "-");
}

export function validationArtifactBasenames(metadata: ValidationSeasonMetadata): {
  populationName: string;
  metadataName: string;
} {
  const stamp = seasonStamp(metadata);
  return {
    populationName: `validation-5b6-pl-${metadata.season}-${stamp}.population.jsonl`,
    metadataName: `validation-5b6-pl-${metadata.season}-${stamp}.meta.json`,
  };
}

export function writeValidationSeasonArtifacts(input: {
  population: readonly CalibrationRow[];
  metadata: ValidationSeasonMetadata;
  directory?: string;
}): {
  populationPath: string;
  metadataPath: string;
  metadata: ValidationSeasonMetadata;
} {
  const serialized = JSON.stringify(input.metadata);
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new Error("Refusing to write validation metadata that looks like it contains an API key");
  }
  const directory = input.directory ?? CALIBRATION_ARTIFACT_DIR;
  mkdirSync(directory, { recursive: true });
  const names = validationArtifactBasenames(input.metadata);
  const populationPath = join(directory, names.populationName);
  const metadataPath = join(directory, names.metadataName);
  const metadata: ValidationSeasonMetadata = {
    ...input.metadata,
    populationArtifact: names.populationName,
    populationRowCount: input.population.length,
  };
  writeJsonlAtomic(populationPath, input.population);
  const metadataTmp = `${metadataPath}.tmp`;
  writeFileSync(metadataTmp, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  renameSync(metadataTmp, metadataPath);
  return { populationPath, metadataPath, metadata };
}

export function loadValidationSeasonArtifacts(metadataPath: string): {
  metadata: ValidationSeasonMetadata;
  population: CalibrationRow[];
} {
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as ValidationSeasonMetadata;
  const directory = dirname(metadataPath);
  if (!metadata.populationArtifact) {
    throw new Error("Validation metadata is missing populationArtifact");
  }
  return {
    metadata,
    population: loadCalibrationDataset(join(directory, metadata.populationArtifact)),
  };
}
