/**
 * Offline 5B.16 local HIGH_EQUAL mass diagnostic entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:lm-5b16
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluateSeasonLocalMass,
  leaveOneSeasonOutLocal,
  poolHoldoutLocal,
  poolTemporal,
} from "@/lib/debug/calibration/lm-5b16-evaluate";
import { classifyLocalMass } from "@/lib/debug/calibration/lm-5b16-report";
import { LOCAL_MASS_NORMALIZATION } from "@/lib/debug/calibration/lm-5b16-formula";
import {
  HALF_WINDOWS,
  QUARTILE_WINDOWS,
  SEASON_N,
} from "@/lib/debug/calibration/tr-5b15-shape";
import {
  LM_PANELS,
  LOCAL_MASS_VERSION,
} from "@/lib/debug/calibration/lm-5b16-shape";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

async function main(): Promise<void> {
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  for (const dataset of datasets) {
    if (dataset.n !== SEASON_N) {
      throw new Error(`STOP: ${dataset.season} N=${dataset.n} !== ${SEASON_N}`);
    }
  }
  const reports = datasets.flatMap((dataset) =>
    LM_PANELS.map((panel) =>
      evaluateSeasonLocalMass({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
        panel,
      }),
    ),
  );
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== before.eloDrawBase) {
    throw new Error("Production eloDrawBase mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  const d0 = reports.filter((report) => report.panel === "D0");
  const d1 = reports.filter((report) => report.panel === "D1");
  const holdoutD0 = poolHoldoutLocal(d0);
  const holdoutD1 = poolHoldoutLocal(d1);
  const attribution = classifyLocalMass({
    reports,
    holdoutD1: holdoutD1.arms,
    holdoutD0: holdoutD0.arms,
  });
  const serializable = {
    version: LOCAL_MASS_VERSION,
    attribution,
    normalization: LOCAL_MASS_NORMALIZATION,
    artifacts: datasets.map((dataset) => ({
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
    })),
    developmentD0: d0.find((report) => report.season === "2024") ?? null,
    developmentD1: d1.find((report) => report.season === "2024") ?? null,
    holdout2023D0: d0.find((report) => report.season === "2023") ?? null,
    holdout2023D1: d1.find((report) => report.season === "2023") ?? null,
    holdout2025D0: d0.find((report) => report.season === "2025") ?? null,
    holdout2025D1: d1.find((report) => report.season === "2025") ?? null,
    holdoutOnlyD0: holdoutD0,
    holdoutOnlyD1: holdoutD1,
    leaveOneSeasonOut: leaveOneSeasonOutLocal(d1),
    pooledD1Halves: Object.fromEntries(HALF_WINDOWS.map((window) => [window, poolTemporal(d1, window)])),
    pooledD1Quartiles: Object.fromEntries(
      QUARTILE_WINDOWS.map((window) => [window, poolTemporal(d1, window)]),
    ),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/lm-5b16-forensics-${stamp}.json`;
  writeFileSync(path, `${JSON.stringify(serializable)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        artifact: path,
        n: datasets.map((dataset) => ({
          season: dataset.season,
          role: dataset.role,
          n: dataset.n,
        })),
        attribution,
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("lm-5b16-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
