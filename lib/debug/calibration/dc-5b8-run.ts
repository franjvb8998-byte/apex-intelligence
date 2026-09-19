/**
 * Offline 5B.8 Dixon-Coles / low-score forensics entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:dc-5b8
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import { evaluateSeasonPoissonForensics } from "@/lib/debug/calibration/dc-5b8-evaluate";
import { evaluateDixonColesSensitivity } from "@/lib/debug/calibration/dc-5b8-sensitivity";
import { classifyDcForensics } from "@/lib/debug/calibration/dc-5b8-report";
import { DC_FORENSICS_VERSION } from "@/lib/debug/calibration/dc-5b8-shape";
import { PRODUCTION_POISSON_AUDIT } from "@/lib/debug/calibration/dc-5b8-formula";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

async function main(): Promise<void> {
  const live = ["APEX_CALIBRATION_LIVE", "API_FOOTBALL_KEY", "APISPORTS_KEY", "API_KEY"];
  for (const name of live) {
    if (process.env[name]) {
      throw new Error(`Dixon-Coles forensics is offline-only; unset ${name}`);
    }
  }
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  const seasons = datasets.map((dataset) => {
    const v0 = evaluateSeasonPoissonForensics({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
      configId: "V0",
    });
    const v5 = evaluateSeasonPoissonForensics({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
      configId: "V5",
    });
    return {
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
      v0,
      v5,
      sensitivityV0: evaluateDixonColesSensitivity({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
        configId: "V0",
      }),
      sensitivityV5: evaluateDixonColesSensitivity({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
        configId: "V5",
      }),
    };
  });
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== before.eloDrawBase) {
    throw new Error("Production eloDrawBase mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.maxGoals !== 15) {
    throw new Error("Production maxGoals mutated");
  }
  const attribution = classifyDcForensics({
    seasons: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      v0: season.v0,
      sensitivityV0: season.sensitivityV0,
    })),
  });
  const serializable = {
    version: DC_FORENSICS_VERSION,
    poissonAudit: PRODUCTION_POISSON_AUDIT,
    artifacts: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      n: season.n,
      populationPath: season.populationPath,
      metadataPath: season.metadataPath,
    })),
    attribution,
    seasons: Object.fromEntries(
      seasons.map((season) => [
        season.season,
        {
          role: season.role,
          n: season.n,
          v0: season.v0,
          v5: {
            n: season.v5.n,
            lowScore: season.v5.lowScore,
            drawDecomposition: season.v5.drawDecomposition,
            scorelines: season.v5.scorelines,
            clamp: season.v5.clamp,
            truncation: season.v5.truncation,
          },
          sensitivityV0: season.sensitivityV0.map((cell) => ({
            ...cell,
            failures: cell.failures.slice(0, 8),
            failureCount: cell.failures.length,
          })),
          sensitivityV5: season.sensitivityV5.map((cell) => ({
            rho: cell.rho,
            valid: cell.valid,
            drawBias: cell.drawBias,
            poissonPredictedDraw: cell.poissonPredictedDraw,
            hybridPredictedDraw: cell.hybridPredictedDraw,
            predicted00: cell.predicted00,
            predicted11: cell.predicted11,
            largeXgDiffDrawBias: cell.largeXgDiffDrawBias,
            failureCount: cell.failures.length,
          })),
        },
      ]),
    ),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/dc-5b8-forensics-${stamp}.json`;
  writeFileSync(path, `${JSON.stringify(serializable)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        artifact: path,
        n: seasons.map((season) => ({ season: season.season, role: season.role, n: season.n })),
        attribution,
        productionMaxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("dc-5b8-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
