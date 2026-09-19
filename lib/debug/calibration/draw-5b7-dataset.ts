/**
 * Local-artifact loader for 5B.7. Fail closed if a required file is missing.
 * Never fetches. Never requires live env or API keys.
 */

import { existsSync, readFileSync } from "node:fs";
import { loadCalibrationDataset } from "@/lib/debug/calibration/persist";
import { loadValidationSeasonArtifacts } from "@/lib/debug/calibration/validation-5b6-persist";
import {
  DRAW_FORENSICS_ARTIFACTS,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  DRAW_FORENSICS_SEASONS,
  type DrawForensicsSeason,
} from "@/lib/debug/calibration/draw-5b7-shape";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export class MissingDrawForensicsArtifactError extends Error {
  constructor(public readonly missingPath: string) {
    super(`Missing required local artifact: ${missingPath}`);
    this.name = "MissingDrawForensicsArtifactError";
  }
}

export type LoadedDrawForensicsSeason = {
  season: DrawForensicsSeason;
  role: "HOLDOUT" | "DEVELOPMENT";
  n: number;
  populationPath: string;
  metadataPath: string;
  rows: CalibrationRow[];
};

export function requireLocalArtifact(path: string): string {
  if (!existsSync(path)) {
    throw new MissingDrawForensicsArtifactError(path);
  }
  return path;
}

export function seasonRole(season: DrawForensicsSeason): "HOLDOUT" | "DEVELOPMENT" {
  if (season === DRAW_FORENSICS_DEVELOPMENT_SEASON) return "DEVELOPMENT";
  if ((DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(season)) {
    return "HOLDOUT";
  }
  throw new Error(`Unknown draw-forensics season ${season}`);
}

export function loadDrawForensicsSeason(
  season: DrawForensicsSeason,
): LoadedDrawForensicsSeason {
  const spec = DRAW_FORENSICS_ARTIFACTS[season];
  const role = seasonRole(season);
  if (role !== spec.role) {
    throw new Error(`Season ${season} role ${role} does not match artifact contract ${spec.role}`);
  }
  if (season === "2024") {
    const development = DRAW_FORENSICS_ARTIFACTS["2024"];
    const populationPath = requireLocalArtifact(development.populationPath);
    const metadataPath = requireLocalArtifact(development.metaPath);
    const rows = loadCalibrationDataset(populationPath);
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      season?: string;
      validationRole?: string;
    };
    if (rows.some((row) => row.season !== "2024") || metadata.season !== "2024") {
      throw new Error("PL 2024 DEVELOPMENT artifact season mismatch");
    }
    return {
      season,
      role: "DEVELOPMENT",
      n: rows.length,
      populationPath,
      metadataPath,
      rows,
    };
  }
  const metadataPath = requireLocalArtifact(spec.metaPath);
  const loaded = loadValidationSeasonArtifacts(metadataPath);
  if (loaded.metadata.season !== season) {
    throw new Error(`Holdout metadata season ${loaded.metadata.season} !== ${season}`);
  }
  if (loaded.metadata.validationRole !== "HOLDOUT") {
    throw new Error(`${season} must remain HOLDOUT`);
  }
  if (loaded.population.some((row) => row.season !== season)) {
    throw new Error(`${season} population contains a foreign season`);
  }
  return {
    season,
    role: "HOLDOUT",
    n: loaded.population.length,
    populationPath: `${metadataPath.replace(/\\/g, "/").replace(/\.meta\.json$/, ".population.jsonl")}`,
    metadataPath,
    rows: loaded.population,
  };
}

export function loadDrawForensicsDatasets(): LoadedDrawForensicsSeason[] {
  return DRAW_FORENSICS_SEASONS.map((season) => loadDrawForensicsSeason(season));
}
