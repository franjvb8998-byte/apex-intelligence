/**
 * Single-predict draw traces from frozen PE internals.
 * Does not call predict more than once per row/config.
 */

import {
  applyEqualizedRolePrior,
  assertProductionHybridConfigUnchanged,
  snapshotDefaultHybridConfig,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import { isValidOneXTwo } from "@/lib/debug/calibration/metrics";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import {
  frozenValidationConfig,
  type ValidationHaConfig,
} from "@/lib/debug/calibration/validation-5b6-configs";
import {
  DRAW_FORENSICS_CONFIG_IDS,
  DRAW_FORENSICS_PRIMARY_POLICY_ID,
  type DrawForensicsConfigId,
  type DrawForensicsSeason,
  type ForensicConfidenceBand,
} from "@/lib/debug/calibration/draw-5b7-shape";
import type {
  CalibrationOutcome,
  CalibrationRow,
  EvidenceBucket,
  OneXTwo,
} from "@/lib/debug/calibration/types";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import type { HybridProbabilityConfig } from "@/lib/intelligence/modules/probability/hybrid/types";

export type DrawTrace = {
  fixtureId: string;
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
  policyId: typeof DRAW_FORENSICS_PRIMARY_POLICY_ID;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string;
  actualOutcome: CalibrationOutcome;
  actualHomeGoals: number;
  actualAwayGoals: number;
  evidenceBucket: EvidenceBucket;
  homeElo: number;
  awayElo: number;
  eloGap: number;
  absEloGap: number;
  eloOneXTwo: OneXTwo;
  poissonOneXTwo: OneXTwo;
  hybridOneXTwo: OneXTwo;
  eloDraw: number;
  poissonDraw: number;
  hybridDraw: number;
  poissonBlendWeight: number;
  xgHome: number;
  xgAway: number;
  xgTotal: number;
  absXgDiff: number;
  confidence: number;
  confidenceBand: ForensicConfidenceBand;
};

export function createIsolatedDrawEngine(
  config: ValidationHaConfig,
  overrides: Partial<HybridProbabilityConfig> = {},
): EloPoissonHybridEngine {
  const before = snapshotDefaultHybridConfig();
  const engine = new EloPoissonHybridEngine({
    homeAdvantageElo: config.homeAdvantageElo,
    baseHomeGoals: config.baseHomeGoals,
    baseAwayGoals: config.baseAwayGoals,
    ...overrides,
  });
  assertProductionHybridConfigUnchanged(before);
  return engine;
}

function assertFiniteOneXTwo(label: string, vector: OneXTwo): void {
  if (!isValidOneXTwo(vector)) {
    throw new Error(`${label} is not a finite 1X2 summing to 1`);
  }
}

export function traceRowDraw(input: {
  row: CalibrationRow;
  configId: DrawForensicsConfigId;
  role: "HOLDOUT" | "DEVELOPMENT";
  engine: EloPoissonHybridEngine;
}): DrawTrace {
  const row = input.row;
  if (row.actualOutcome == null || row.actualHomeGoals == null || row.actualAwayGoals == null) {
    throw new Error(`Unlabeled outcome on ${row.fixtureId}`);
  }
  const config = frozenValidationConfig(input.configId);
  const policy = createCurrentCataloguePolicy();
  const home = policy.resolve(row, "home");
  const away = policy.resolve(row, "away");
  const homeElo = applyEqualizedRolePrior(home.elo, "home", config.equalizeRolePriors);
  const awayElo = applyEqualizedRolePrior(away.elo, "away", config.equalizeRolePriors);
  const hybrid = input.engine.predict({
    homeElo,
    awayElo,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    matchId: row.fixtureId,
  });
  assertFiniteOneXTwo("elo", hybrid.elo.oneXTwo);
  assertFiniteOneXTwo("poisson", hybrid.poisson.oneXTwo);
  assertFiniteOneXTwo("hybrid", hybrid.oneXTwo);
  const confidence = confidenceFromHybrid(hybrid);
  const eloGap = homeElo - awayElo;
  return {
    fixtureId: row.fixtureId,
    season: row.season,
    role: input.role,
    configId: input.configId,
    policyId: DRAW_FORENSICS_PRIMARY_POLICY_ID,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    kickoff: row.kickoff,
    actualOutcome: row.actualOutcome,
    actualHomeGoals: row.actualHomeGoals,
    actualAwayGoals: row.actualAwayGoals,
    evidenceBucket: rowEvidenceBucket(row),
    homeElo,
    awayElo,
    eloGap,
    absEloGap: Math.abs(eloGap),
    eloOneXTwo: hybrid.elo.oneXTwo,
    poissonOneXTwo: hybrid.poisson.oneXTwo,
    hybridOneXTwo: hybrid.oneXTwo,
    eloDraw: hybrid.elo.oneXTwo.draw,
    poissonDraw: hybrid.poisson.oneXTwo.draw,
    hybridDraw: hybrid.oneXTwo.draw,
    poissonBlendWeight: hybrid.meta.poissonBlendWeight,
    xgHome: hybrid.expectedGoals.home,
    xgAway: hybrid.expectedGoals.away,
    xgTotal: hybrid.expectedGoals.total,
    absXgDiff: Math.abs(hybrid.expectedGoals.home - hybrid.expectedGoals.away),
    confidence: confidence.value,
    confidenceBand: confidence.band,
  };
}

export function traceSeasonDraw(input: {
  rows: readonly CalibrationRow[];
  season: DrawForensicsSeason | string;
  role: "HOLDOUT" | "DEVELOPMENT";
  configId: DrawForensicsConfigId;
  eloDrawBase?: number;
}): DrawTrace[] {
  if (!DRAW_FORENSICS_CONFIG_IDS.includes(input.configId)) {
    throw new Error(`Draw forensics forbids config ${input.configId}`);
  }
  const config = frozenValidationConfig(input.configId);
  const engine = createIsolatedDrawEngine(
    config,
    input.eloDrawBase == null ? {} : { eloDrawBase: input.eloDrawBase },
  );
  return input.rows.map((row) => {
    if (row.season !== input.season) {
      throw new Error(`Season identity mismatch: row ${row.season} vs ${input.season}`);
    }
    return traceRowDraw({
      row,
      configId: input.configId,
      role: input.role,
      engine,
    });
  });
}

export function peakOneXTwo(oneXTwo: OneXTwo): number {
  return Math.max(oneXTwo.home, oneXTwo.draw, oneXTwo.away);
}
