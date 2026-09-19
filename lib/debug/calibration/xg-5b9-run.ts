/**
 * Offline 5B.9 Elo→xG geometry forensics entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:xg-5b9
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluateSeasonLambdaGeometry,
  lambdaDistributions,
  snapshotLambdaSeason,
  type LambdaSnapshot,
} from "@/lib/debug/calibration/xg-5b9-evaluate";
import {
  evaluateDenominatorSensitivity,
  evaluateGoalBaseVariants,
  unclampedCounterfactual,
} from "@/lib/debug/calibration/xg-5b9-counterfactual";
import { classifyXgGeometry } from "@/lib/debug/calibration/xg-5b9-report";
import {
  analyticEloGapGeometry,
  productionExponentMultipliers,
} from "@/lib/debug/calibration/xg-5b9-geometry";
import {
  PRODUCTION_ELO_XG_AUDIT,
  productionAnalyticClampThresholds,
} from "@/lib/debug/calibration/xg-5b9-formula";
import { XG_GEOMETRY_VERSION } from "@/lib/debug/calibration/xg-5b9-shape";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

async function main(): Promise<void> {
  const live = ["APEX_CALIBRATION_LIVE", "API_FOOTBALL_KEY", "APISPORTS_KEY", "API_KEY"];
  for (const name of live) {
    if (process.env[name]) {
      throw new Error(`Elo→xG geometry forensics is offline-only; unset ${name}`);
    }
  }
  const before = snapshotDefaultHybridConfig();
  const analytic = analyticEloGapGeometry();
  const datasets = loadDrawForensicsDatasets();
  const allSnapshots: LambdaSnapshot[] = [];
  const seasons = datasets.map((dataset) => {
    const snapshots = snapshotLambdaSeason({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
    });
    allSnapshots.push(...snapshots);
    const geometry = evaluateSeasonLambdaGeometry({
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
      geometry,
      unclamped: unclampedCounterfactual(snapshots),
      goalBases: evaluateGoalBaseVariants({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
      }),
      denominator: evaluateDenominatorSensitivity({
        rows: dataset.rows,
        season: dataset.season,
        role: dataset.role,
      }),
    };
  });
  if (DEFAULT_HYBRID_CONFIG.eloGoalScale !== before.eloGoalScale) {
    throw new Error("Production eloGoalScale mutated");
  }
  if (DEFAULT_HYBRID_CONFIG.baseHomeGoals !== before.baseHomeGoals) {
    throw new Error("Production baseHomeGoals mutated");
  }
  const attribution = classifyXgGeometry({
    seasons: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      geometry: season.geometry,
      unclamped: season.unclamped,
      goalBases: season.goalBases,
    })),
    analytic,
  });
  const serializable = {
    version: XG_GEOMETRY_VERSION,
    eloXgAudit: PRODUCTION_ELO_XG_AUDIT,
    analyticClampThresholds: productionAnalyticClampThresholds(),
    exponentMultipliers: productionExponentMultipliers(),
    analytic,
    pooled: lambdaDistributions(allSnapshots),
    attribution,
    artifacts: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      n: season.n,
      populationPath: season.populationPath,
      metadataPath: season.metadataPath,
    })),
    seasons: Object.fromEntries(
      seasons.map((season) => [
        season.season,
        {
          role: season.role,
          n: season.n,
          distributions: season.geometry.distributions,
          ratioBuckets: season.geometry.ratioBuckets,
          eloGap: season.geometry.eloGap,
          actualDraws: season.geometry.actualDraws,
          extremes: {
            byAbsEloGap: season.geometry.extremes.byAbsEloGap.slice(0, 20),
            byLambdaRatio: season.geometry.extremes.byLambdaRatio.slice(0, 20),
            byPeakHybrid: season.geometry.extremes.byPeakHybrid.slice(0, 20),
          },
          clamp: season.geometry.clamp,
          unclamped: season.unclamped,
          goalBases: season.goalBases,
          denominator: season.denominator,
        },
      ]),
    ),
    productionUnchanged: {
      eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
      homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
      maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    },
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `data/calibration/xg-5b9-forensics-${stamp}.json`;
  writeFileSync(path, `${JSON.stringify(serializable)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        artifact: path,
        n: seasons.map((season) => ({ season: season.season, role: season.role, n: season.n })),
        attribution,
        eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("xg-5b9-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
