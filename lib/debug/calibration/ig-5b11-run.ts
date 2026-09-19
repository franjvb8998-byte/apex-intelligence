/**
 * Offline 5B.11 catalogue input-geometry counterfactual entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:ig-5b11
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluateSeasonInputGeometry,
  poolHoldoutOnly,
} from "@/lib/debug/calibration/ig-5b11-evaluate";
import { classifyInputGeometry } from "@/lib/debug/calibration/ig-5b11-report";
import {
  INPUT_GEOMETRY_VERSION,
  PE_HOME_ADVANTAGE_REMAINS,
} from "@/lib/debug/calibration/ig-5b11-shape";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

async function main(): Promise<void> {
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  for (const dataset of datasets) {
    if (dataset.n !== 380) {
      throw new Error(`STOP: ${dataset.season} N=${dataset.n} !== 380`);
    }
  }
  const seasons = datasets.map((dataset) =>
    evaluateSeasonInputGeometry({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
    }),
  );
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== before.eloDrawBase) {
    throw new Error("Production eloDrawBase mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== PE_HOME_ADVANTAGE_REMAINS) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  const ordered = [
    seasons.find((season) => season.season === "2024"),
    seasons.find((season) => season.season === "2023"),
    seasons.find((season) => season.season === "2025"),
  ].filter((season): season is NonNullable<typeof season> => season != null);
  const holdoutOnly = poolHoldoutOnly(seasons);
  const attribution = classifyInputGeometry({ seasons });
  const serializable = {
    version: INPUT_GEOMETRY_VERSION,
    attribution,
    peHomeAdvantageElo: PE_HOME_ADVANTAGE_REMAINS,
    catalogueRolePriorIsolatedFromPeHa: true,
    artifacts: datasets.map((dataset) => ({
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
    })),
    development: ordered.find((season) => season.season === "2024") ?? null,
    holdout2023: ordered.find((season) => season.season === "2023") ?? null,
    holdout2025: ordered.find((season) => season.season === "2025") ?? null,
    holdoutOnly,
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/ig-5b11-forensics-${stamp}.json`;
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

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("ig-5b11-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
