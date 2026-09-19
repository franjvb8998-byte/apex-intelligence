/**
 * Offline 5B.12 Elo→xG geometry counterfactual entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:xg-5b12
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluatePanelSeason,
  poolHoldoutGeometry,
} from "@/lib/debug/calibration/xg-5b12-evaluate";
import { classifyXgGeometryCounterfactual } from "@/lib/debug/calibration/xg-5b12-report";
import {
  GEOMETRY_PANELS,
  XG_GEOMETRY_COUNTERFACTUAL_VERSION,
} from "@/lib/debug/calibration/xg-5b12-shape";
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
  const reports = datasets.flatMap((dataset) =>
    GEOMETRY_PANELS.map((panel) =>
      evaluatePanelSeason({
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
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== before.eloGoalScale) {
    throw new Error("Production eloGoalScale mutated");
  }
  const byPanelSeason = (panel: "P0" | "P7", season: string) =>
    reports.find((report) => report.panel === panel && report.season === season) ?? null;
  const attribution = classifyXgGeometryCounterfactual({ reports });
  const serializable = {
    version: XG_GEOMETRY_COUNTERFACTUAL_VERSION,
    attribution,
    artifacts: datasets.map((dataset) => ({
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
    })),
    developmentP0: byPanelSeason("P0", "2024"),
    developmentP7: byPanelSeason("P7", "2024"),
    holdout2023P0: byPanelSeason("P0", "2023"),
    holdout2023P7: byPanelSeason("P7", "2023"),
    holdout2025P0: byPanelSeason("P0", "2025"),
    holdout2025P7: byPanelSeason("P7", "2025"),
    holdoutOnlyP0: poolHoldoutGeometry(reports.filter((report) => report.panel === "P0")),
    holdoutOnlyP7: poolHoldoutGeometry(reports.filter((report) => report.panel === "P7")),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/xg-5b12-forensics-${stamp}.json`;
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

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("xg-5b12-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
