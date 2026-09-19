/**
 * Offline 5B.14 higher-score draw dependence entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:hs-5b14
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  contrastDrawSeasons,
  evaluateHsPanelSeason,
  poolHoldoutHs,
} from "@/lib/debug/calibration/hs-5b14-evaluate";
import { classifyHigherScoreDraw } from "@/lib/debug/calibration/hs-5b14-report";
import {
  HIGHER_SCORE_DRAW_VERSION,
  HS_PANELS,
} from "@/lib/debug/calibration/hs-5b14-shape";
import { BIVARIATE_POISSON_EQUATIONS } from "@/lib/debug/calibration/hs-5b14-formula";
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
    HS_PANELS.map((panel) =>
      evaluateHsPanelSeason({
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
  const byPanelSeason = (panel: "D0" | "D1", season: string) =>
    reports.find((report) => report.panel === panel && report.season === season) ?? null;
  const d1_2023 = byPanelSeason("D1", "2023");
  const d1_2025 = byPanelSeason("D1", "2025");
  const attribution = classifyHigherScoreDraw({ reports });
  const serializable = {
    version: HIGHER_SCORE_DRAW_VERSION,
    attribution,
    equations: BIVARIATE_POISSON_EQUATIONS,
    artifacts: datasets.map((dataset) => ({
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
    })),
    developmentD0: byPanelSeason("D0", "2024"),
    developmentD1: byPanelSeason("D1", "2024"),
    holdout2023D0: byPanelSeason("D0", "2023"),
    holdout2023D1: d1_2023,
    holdout2025D0: byPanelSeason("D0", "2025"),
    holdout2025D1: d1_2025,
    holdoutOnlyD0: poolHoldoutHs(reports.filter((report) => report.panel === "D0")),
    holdoutOnlyD1: poolHoldoutHs(reports.filter((report) => report.panel === "D1")),
    contrast2023v2025D1:
      d1_2023 && d1_2025 ? contrastDrawSeasons(d1_2023, d1_2025) : null,
    contrast2023v2025D0: (() => {
      const a = byPanelSeason("D0", "2023");
      const b = byPanelSeason("D0", "2025");
      return a && b ? contrastDrawSeasons(a, b) : null;
    })(),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/hs-5b14-forensics-${stamp}.json`;
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

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("hs-5b14-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
