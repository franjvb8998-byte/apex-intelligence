/**
 * Offline 5B.13 draw-channel residual entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:draw-5b13
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluateDrawPanelSeason,
  poolHoldoutDraw,
  residual2025,
} from "@/lib/debug/calibration/draw-5b13-evaluate";
import { classifyDrawChannelResidual } from "@/lib/debug/calibration/draw-5b13-report";
import {
  DRAW_CHANNEL_VERSION,
  DRAW_PANELS,
} from "@/lib/debug/calibration/draw-5b13-shape";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { PRODUCTION_DRAW_PIPELINE_AUDIT } from "@/lib/debug/calibration/draw-5b13-formula";

async function main(): Promise<void> {
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  for (const dataset of datasets) {
    if (dataset.n !== 380) {
      throw new Error(`STOP: ${dataset.season} N=${dataset.n} !== 380`);
    }
  }
  const reports = datasets.flatMap((dataset) =>
    DRAW_PANELS.map((panel) =>
      evaluateDrawPanelSeason({
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
  if (DEFAULT_HYBRID_CONFIG.poissonBlendWeight !== before.poissonBlendWeight) {
    throw new Error("Production blend mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.homeAdvantageElo !== before.homeAdvantageElo) {
    throw new Error("Production homeAdvantageElo mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== 400) {
    throw new Error("Production eloGoalScale mutated");
  }
  const byPanelSeason = (panel: "D0" | "D1", season: string) =>
    reports.find((report) => report.panel === panel && report.season === season) ?? null;
  const holdout2025D0 = byPanelSeason("D0", "2025");
  const holdout2025D1 = byPanelSeason("D1", "2025");
  const attribution = classifyDrawChannelResidual({ reports });
  const serializable = {
    version: DRAW_CHANNEL_VERSION,
    attribution,
    pipeline: PRODUCTION_DRAW_PIPELINE_AUDIT,
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
    holdout2023D1: byPanelSeason("D1", "2023"),
    holdout2025D0,
    holdout2025D1,
    holdoutOnlyD0: poolHoldoutDraw(reports.filter((report) => report.panel === "D0")),
    holdoutOnlyD1: poolHoldoutDraw(reports.filter((report) => report.panel === "D1")),
    residual2025D0: holdout2025D0 ? residual2025(holdout2025D0) : null,
    residual2025D1: holdout2025D1 ? residual2025(holdout2025D1) : null,
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      eloDrawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/draw-5b13-forensics-${stamp}.json`;
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

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("draw-5b13-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
