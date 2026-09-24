/**
 * PE-4G.3 — Offline CLI: build expectation dataset from local calibration JSONL.
 *
 * Zero network. Zero Supabase. Writes only to an explicit output directory.
 * Does not modify source files. Does not fit any model.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-pe4g3-expectation-dataset.ts --execute \
 *     --out data/calibration/pe4-expectation
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CALIBRATION_ARTIFACT_DIR,
  CALIBRATION_RECONSTRUCTION_VERSION,
  type CalibrationRow,
} from "@/lib/debug/calibration/types";
import {
  buildPe4ExpectationDataset,
  PE4_EXPECTATION_ROLLING_ORIGIN_PLAN,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation";

const DEFAULT_SOURCES = [
  "validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.population.jsonl",
  "pilot-2026-09-19T05-52-08-473Z.population.jsonl",
  "validation-5b6-pl-2025-2026-09-19T06-15-51-490Z.population.jsonl",
] as const;

function parseArgs(argv: string[]) {
  const execute = argv.includes("--execute");
  let outDir = path.join(CALIBRATION_ARTIFACT_DIR, "pe4-expectation");
  const sources: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out" && argv[i + 1]) {
      outDir = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--source" && argv[i + 1]) {
      sources.push(argv[i + 1]!);
      i += 1;
    }
  }
  return {
    execute,
    outDir,
    sources: sources.length > 0 ? sources : [...DEFAULT_SOURCES],
  };
}

function loadJsonl(filePath: string): CalibrationRow[] {
  const text = readFileSync(filePath, "utf8");
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CalibrationRow);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.execute) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          hint: "Pass --execute to write artifacts",
          defaultSources: DEFAULT_SOURCES,
          outDir: args.outDir,
        },
        null,
        2,
      ),
    );
    return;
  }

  const cwd = process.cwd();
  const loaded: CalibrationRow[] = [];
  const sourceLabels: string[] = [];
  for (const rel of args.sources) {
    const abs = path.isAbsolute(rel)
      ? rel
      : path.join(cwd, CALIBRATION_ARTIFACT_DIR, path.basename(rel));
    const rows = loadJsonl(abs);
    loaded.push(...rows);
    sourceLabels.push(path.basename(abs));
  }

  const result = buildPe4ExpectationDataset({
    sourceRows: loaded,
    sourceFileLabels: sourceLabels,
    requireProvenReconstruction: true,
  });

  mkdirSync(args.outDir, { recursive: true });
  const datasetPath = path.join(args.outDir, "dataset-v1.jsonl");
  const manifestPath = path.join(args.outDir, "dataset-v1.manifest.json");
  const splitsPath = path.join(args.outDir, "splits-v1.json");
  const descriptivePath = path.join(args.outDir, "descriptive-v1.json");

  const jsonl = result.rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(datasetPath, jsonl, "utf8");
  writeFileSync(
    manifestPath,
    JSON.stringify(result.manifest, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    splitsPath,
    JSON.stringify(
      {
        splits: result.manifest.splits,
        rollingOriginPlan: PE4_EXPECTATION_ROLLING_ORIGIN_PLAN,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeFileSync(
    descriptivePath,
    JSON.stringify(result.descriptive, null, 2) + "\n",
    "utf8",
  );

  const fileDigest = createHash("sha256").update(jsonl, "utf8").digest("hex");

  console.log(
    JSON.stringify(
      {
        ok: true,
        reconstructionContract: CALIBRATION_RECONSTRUCTION_VERSION,
        outDir: args.outDir,
        sourceFiles: sourceLabels,
        rowCount: result.manifest.rowCount,
        rejectedCount: result.manifest.rejectedCount,
        identicalDuplicateCount: result.manifest.identicalDuplicateCount,
        datasetDigest: result.manifest.datasetDigest,
        writtenFileSha256: fileDigest,
        qualityCounts: result.manifest.qualityCounts,
        outcomeCounts: result.manifest.outcomeCounts,
        seasonCounts: result.manifest.seasonCounts,
        bothBasePriorCount: result.manifest.bothBasePriorCount,
        splits: result.manifest.splits.map((s) => ({
          name: s.name,
          rowCount: s.rowCount,
          seasons: s.seasons,
          promotionEligible: s.promotionEligible,
        })),
        noModelFitted: true,
        noNetwork: true,
      },
      null,
      2,
    ),
  );
}

main();
