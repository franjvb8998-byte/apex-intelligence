/**
 * Offline 5B.10 catalogue Elo input forensics entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 *   npm run calibration:cat-5b10
 *
 * Requires already-persisted local artifacts. No live env. No API key.
 */

import { writeFileSync } from "node:fs";
import { loadDrawForensicsDatasets } from "@/lib/debug/calibration/draw-5b7-dataset";
import {
  evaluateSeasonCatalogueGeometry,
  type MatchCatalogueTrace,
  type SideObservation,
} from "@/lib/debug/calibration/cat-5b10-evaluate";
import {
  evaluateRoleBaseCounterfactual,
  evaluateShrinkageCharacterization,
  gdScaleDiagnostics,
} from "@/lib/debug/calibration/cat-5b10-counterfactual";
import {
  extremeMatchTraces,
  gdSaturationExamples,
  maturityStability,
  sameTeamRoleEffect,
} from "@/lib/debug/calibration/cat-5b10-maturity";
import { classifyCatalogueInput } from "@/lib/debug/calibration/cat-5b10-report";
import { sparseWinRateSynthetics } from "@/lib/debug/calibration/cat-5b10-evaluate";
import { PRODUCTION_CATALOGUE_ELO_AUDIT } from "@/lib/debug/calibration/cat-5b10-formula";
import { CATALOGUE_INPUT_VERSION } from "@/lib/debug/calibration/cat-5b10-shape";
import { snapshotDefaultHybridConfig } from "@/lib/debug/calibration/experiment-5b5-ha";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";

async function main(): Promise<void> {
  const before = snapshotDefaultHybridConfig();
  const datasets = loadDrawForensicsDatasets();
  const allMatches: MatchCatalogueTrace[] = [];
  const allSides: SideObservation[] = [];
  const seasons = datasets.map((dataset) => {
    const evaluated = evaluateSeasonCatalogueGeometry({
      rows: dataset.rows,
      season: dataset.season,
      role: dataset.role,
    });
    allMatches.push(...evaluated.matches);
    allSides.push(...evaluated.sides);
    return {
      season: dataset.season,
      role: dataset.role,
      n: dataset.n,
      populationPath: dataset.populationPath,
      metadataPath: dataset.metadataPath,
      geometry: evaluated.report,
      roleBases: evaluateRoleBaseCounterfactual({ rows: dataset.rows }),
      maturity: maturityStability(evaluated.sides),
      roleEffect: sameTeamRoleEffect(evaluated.sides),
      gdScale: gdScaleDiagnostics(evaluated.sides),
      gdSaturation: gdSaturationExamples(evaluated.sides),
      shrinkage: evaluateShrinkageCharacterization({ rows: dataset.rows }),
      traces: extremeMatchTraces(evaluated.matches),
    };
  });
  if (DEFAULT_HYBRID_CONFIG.eloDrawBase !== before.eloDrawBase) {
    throw new Error("Production eloDrawBase mutated");
  }
  const attribution = classifyCatalogueInput({
    seasons: seasons.map((season) => ({
      season: season.season,
      role: season.role,
      geometry: season.geometry,
      roleBases: season.roleBases,
      maturity: season.maturity,
    })),
  });
  const serializable = {
    version: CATALOGUE_INPUT_VERSION,
    catalogueAudit: PRODUCTION_CATALOGUE_ELO_AUDIT,
    sparseWinRateSynthetics: sparseWinRateSynthetics(),
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
          geometry: season.geometry,
          roleBases: season.roleBases,
          maturity: season.maturity,
          roleEffect: season.roleEffect,
          gdScale: season.gdScale,
          gdSaturation: season.gdSaturation,
          shrinkage: season.shrinkage,
          traces: season.traces,
        },
      ]),
    ),
    pooled: {
      nMatches: allMatches.length,
      nSides: allSides.length,
    },
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
  const path = `data/calibration/cat-5b10-forensics-${stamp}.json`;
  writeFileSync(path, `${JSON.stringify(serializable)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        artifact: path,
        n: seasons.map((season) => ({ season: season.season, role: season.role, n: season.n })),
        attribution,
      },
      null,
      2,
    ),
  );
}

const invoked = process.argv[1]?.replace(/\\/g, "/").endsWith("cat-5b10-run.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
