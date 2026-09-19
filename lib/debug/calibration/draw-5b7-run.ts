/**
 * Offline 5B.7 draw-forensics entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:draw-5b7
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import { evaluateDrawForensicsConfigs } from "@/lib/debug/calibration/draw-5b7-evaluate";
import { evaluateEloDrawBaseSensitivity } from "@/lib/debug/calibration/draw-5b7-sensitivity";
import { buildDrawForensicsReport } from "@/lib/debug/calibration/draw-5b7-report";
import { DRAW_FORENSICS_VERSION } from "@/lib/debug/calibration/draw-5b7-shape";
import { PRODUCTION_DRAW_FORMULA_AUDIT } from "@/lib/debug/calibration/draw-5b7-formula";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

function stripTraces<T extends { traces?: unknown }>(value: T): Omit<T, "traces"> {
  const rest = { ...value };
  delete rest.traces;
  return rest;
}

async function main(): Promise<void> {
  const live = ["APEX_CALIBRATION_LIVE", "API_FOOTBALL_KEY", "APISPORTS_KEY", "API_KEY"];
  for (const name of live) {
    if (process.env[name]) {
      throw new Error(`Draw forensics is offline-only; unset ${name}`);
    }
  }
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  const seasons = datasets.map((dataset) => {
    const configs = evaluateDrawForensicsConfigs({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
    });
    return {
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
      V0: configs.V0,
      V5: configs.V5,
      sensitivityV0: evaluateEloDrawBaseSensitivity({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
        configId: "V0",
      }),
      sensitivityV5: evaluateEloDrawBaseSensitivity({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
        configId: "V5",
      }),
    };
  });
  const report = buildDrawForensicsReport({ seasons });
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== before.eloDrawBase) {
    throw new Error("Production eloDrawBase mutated");
  }
  const serializable = {
    version: DRAW_FORENSICS_VERSION,
    formulaAudit: PRODUCTION_DRAW_FORMULA_AUDIT,
    artifacts: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      n: season.n,
      populationPath: season.populationPath,
      metadataPath: season.metadataPath,
    })),
    attribution: report.attribution,
    descriptivePool: report.descriptivePool,
    seasons: Object.fromEntries(
      seasons.map((season) => [
        season.season,
        {
          role: season.role,
          n: season.n,
          V0: stripTraces(season.V0),
          V5: stripTraces(season.V5),
          sensitivity: { V0: season.sensitivityV0, V5: season.sensitivityV5 },
        },
      ]),
    ),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/draw-5b7-forensics-${stamp}.json`;
  writeFileSync(path, `${JSON.stringify(serializable)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        artifact: path,
        n: seasons.map((season) => ({ season: season.season, role: season.role, n: season.n })),
        attribution: report.attribution,
        productionEloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      },
      null,
      2,
    ),
  );
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("draw-5b7-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
