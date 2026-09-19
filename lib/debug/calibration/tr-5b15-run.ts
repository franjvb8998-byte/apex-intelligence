/**
 * Offline 5B.15 HIGH_EQUAL temporal robustness entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:tr-5b15
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  d1HalfThresholds,
  d1QuartileThresholds,
  evaluateSeasonTemporal,
  leaveOneSeasonOut,
  poolCorrespondingWindows,
} from "@/lib/debug/calibration/tr-5b15-evaluate";
import { classifyTemporalRobustness } from "@/lib/debug/calibration/tr-5b15-report";
import {
  HALF_WINDOWS,
  QUARTILE_WINDOWS,
  SEASON_N,
  TEMPORAL_ROBUSTNESS_VERSION,
  TR_PANELS,
} from "@/lib/debug/calibration/tr-5b15-shape";
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
    TR_PANELS.map((panel) =>
      evaluateSeasonTemporal({
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
  const loso = leaveOneSeasonOut(d1);
  const attribution = classifyTemporalRobustness({ reports, leaveOneOut: loso });
  const serializable = {
    version: TEMPORAL_ROBUSTNESS_VERSION,
    attribution,
    artifacts: datasets.map((dataset) => ({
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
    })),
    d1HalfThresholds: d1HalfThresholds(d1),
    d1QuartileThresholds: d1QuartileThresholds(d1),
    leaveOneSeasonOut: loso,
    pooledD0: Object.fromEntries(
      [...HALF_WINDOWS, ...QUARTILE_WINDOWS].map((window) => [
        window,
        poolCorrespondingWindows(d0, window),
      ]),
    ),
    pooledD1: Object.fromEntries(
      [...HALF_WINDOWS, ...QUARTILE_WINDOWS].map((window) => [
        window,
        poolCorrespondingWindows(d1, window),
      ]),
    ),
    seasons: reports,
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/tr-5b15-forensics-${stamp}.json`;
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
        d1HalfThresholds: serializable.d1HalfThresholds,
        leaveOneSeasonOut: loso.map((row) => ({
          excluded: row.excluded,
          oe: row.oeRatio,
        })),
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("tr-5b15-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
