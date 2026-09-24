/**
 * GOALS-1B — Offline CLI: build goals evidence dataset.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1b-evidence-dataset.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildGoalsEvidenceDataset } from "@/lib/debug/calibration/goals/build-dataset";
import {
  GOALS_EVIDENCE_SCHEMA_VERSION,
  GOALS_HOLDOUT_SEASON,
} from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

const DEFAULT_SOURCES = [
  {
    label: "pl-2023-population",
    file: "validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.population.jsonl",
  },
  {
    label: "pl-2024-population",
    file: "pilot-2026-09-19T05-52-08-473Z.population.jsonl",
  },
  // 2025 present for integrity exclusion only — never emitted
  {
    label: "pl-2025-holdout-not-emitted",
    file: "validation-5b6-pl-2025-2026-09-19T06-15-51-490Z.population.jsonl",
  },
] as const;

function main() {
  const execute = process.argv.includes("--execute");
  const assumeFt = !process.argv.includes("--no-league-ft-assumption");

  console.log(
    JSON.stringify(
      {
        phase: "GOALS_1B_EVIDENCE_BUILDER",
        schemaVersion: GOALS_EVIDENCE_SCHEMA_VERSION,
        regulationLabelPolicy: "REGULATION_90_ONLY",
        leagueFtAssumptionDefault: true,
        assumeFt,
        holdoutExcluded: GOALS_HOLDOUT_SEASON,
        note: "No model fitting",
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const rowsBySource = DEFAULT_SOURCES.map((s) => {
    const abs = path.join(process.cwd(), CALIBRATION_ARTIFACT_DIR, s.file);
    const text = readFileSync(abs, "utf8");
    const rows = text
      .trim()
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CalibrationRow);
    return { label: s.label, text, rows };
  });

  // Prove holdout rows were loaded for exclusion counting but not emitted
  const holdoutLoaded = rowsBySource
    .flatMap((s) => s.rows)
    .filter((r) => r.season === GOALS_HOLDOUT_SEASON).length;

  const result = buildGoalsEvidenceDataset({
    rowsBySource,
    applyLeagueFtAssumption: assumeFt,
  });
  const result2 = buildGoalsEvidenceDataset({
    rowsBySource,
    applyLeagueFtAssumption: assumeFt,
  });

  const reproducible =
    result.manifest.datasetDigest === result2.manifest.datasetDigest &&
    result.rows.length === result2.rows.length &&
    result.rows.every((r, i) => r.digest === result2.rows[i]!.digest);

  if (!reproducible) {
    throw new Error("GOALS-1B reproducibility failed — STOP");
  }

  if (result.rows.some((r) => r.season === GOALS_HOLDOUT_SEASON)) {
    throw new Error("Holdout season leaked into evidence rows");
  }

  const outDir = path.join(
    process.cwd(),
    CALIBRATION_ARTIFACT_DIR,
    "goals",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "goals-evidence-v1.jsonl"),
    result.rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  writeFileSync(
    path.join(outDir, "goals-evidence-v1.manifest.json"),
    JSON.stringify(
      { ...result.manifest, holdoutRowsLoadedForExclusionOnly: holdoutLoaded },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "goals-evidence-v1.descriptive.json"),
    JSON.stringify(result.descriptive, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "BUILD_COMPLETE",
        rowCount: result.manifest.rowCount,
        datasetDigest: result.manifest.datasetDigest,
        seasonCounts: result.manifest.seasonCounts,
        labelAvailableCount: result.manifest.labelAvailableCount,
        labelUnavailableCount: result.manifest.labelUnavailableCount,
        leagueFtAssumptionApplied: result.manifest.leagueFtAssumptionApplied,
        holdoutRowsLoadedForExclusionOnly: holdoutLoaded,
        holdoutEmitted: 0,
        reproducible,
        outDir,
        descriptive: result.descriptive,
      },
      null,
      2,
    ),
  );
}

main();
