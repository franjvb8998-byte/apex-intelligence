/**
 * Debug-only Elo→xG geometry predict. Isolated. Does not mutate production PE.
 * G4/G5 cap only the gap entering eloToExpectedGoals. Elo 1X2 still uses raw Elos.
 */

import {
  eloToExpectedGoals,
  eloToOneXTwo,
  eloWinExpectancy,
} from "@/lib/intelligence/modules/probability/math/elo";
import { EloPoissonHybridEngine, blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { resolveMatchElos } from "@/lib/debug/calibration/ig-5b11-formula";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import {
  EFFECTIVE_GAP_CAP,
  geometryArmSpec,
  panelInputArm,
  type GeometryArmId,
  type GeometryPanelId,
} from "@/lib/debug/calibration/xg-5b12-shape";
import type { CalibrationRow } from "@/lib/debug/calibration/types";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability/hybrid/types";

export function clampEffectiveGap(rawGap: number): number {
  return Math.max(-EFFECTIVE_GAP_CAP, Math.min(EFFECTIVE_GAP_CAP, rawGap));
}

export type EffectiveEloPair = {
  rawGap: number;
  effectiveGap: number;
  lambdaHomeElo: number;
  lambdaAwayElo: number;
};

export function effectiveEloPair(input: {
  homeElo: number;
  awayElo: number;
  capEffectiveGap: boolean;
}): EffectiveEloPair {
  const rawGap = input.homeElo - input.awayElo;
  const effectiveGap = input.capEffectiveGap ? clampEffectiveGap(rawGap) : rawGap;
  const mid = (input.homeElo + input.awayElo) / 2;
  return {
    rawGap,
    effectiveGap,
    lambdaHomeElo: mid + effectiveGap / 2,
    lambdaAwayElo: mid - effectiveGap / 2,
  };
}

export function panelMatchElos(
  panel: GeometryPanelId,
  row: CalibrationRow,
): { homeElo: number; awayElo: number } {
  return resolveMatchElos(panelInputArm(panel), row);
}

export function predictDebugGeometry(input: {
  homeElo: number;
  awayElo: number;
  homeTeamId?: string;
  awayTeamId?: string;
  matchId?: string;
  armId: GeometryArmId;
}): HybridProbabilityResult & EffectiveEloPair {
  const spec = geometryArmSpec(input.armId);
  const pair = effectiveEloPair({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    capEffectiveGap: spec.capEffectiveGap,
  });
  const config = DEFAULT_HYBRID_CONFIG;
  const winExpectancyHome = eloWinExpectancy({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    homeAdvantageElo: config.homeAdvantageElo,
    scale: config.eloScale,
  });
  const eloOneXTwo = eloToOneXTwo({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    homeAdvantageElo: config.homeAdvantageElo,
    drawBase: config.eloDrawBase,
    drawDecay: config.eloDrawDecay,
    scale: config.eloScale,
  });
  const { lambdaHome, lambdaAway } = eloToExpectedGoals({
    homeElo: pair.lambdaHomeElo,
    awayElo: pair.lambdaAwayElo,
    baseHomeGoals: config.baseHomeGoals,
    baseAwayGoals: config.baseAwayGoals,
    eloGoalScale: spec.eloGoalScale,
    homeGoalsAdvantage: config.homeGoalsAdvantage,
  });
  const poissonMarginals = marginalizePoissonScoreGrid({
    lambdaHome,
    lambdaAway,
    maxGoals: config.maxGoals,
  });
  const blendedOneXTwo = blendOneXTwo(
    poissonMarginals.oneXTwo,
    eloOneXTwo,
    config.poissonBlendWeight,
  );
  return {
    ...pair,
    oneXTwo: blendedOneXTwo,
    overUnder25: poissonMarginals.overUnder25,
    expectedGoals: {
      home: lambdaHome,
      away: lambdaAway,
      total: lambdaHome + lambdaAway,
    },
    elo: {
      winExpectancyHome,
      oneXTwo: eloOneXTwo,
    },
    poisson: {
      lambdaHome,
      lambdaAway,
      oneXTwo: poissonMarginals.oneXTwo,
      overUnder25: poissonMarginals.overUnder25,
      coveredMass: poissonMarginals.coveredMass,
    },
    meta: {
      modelVersion: config.modelVersion,
      poissonBlendWeight: config.poissonBlendWeight,
      config: { ...config, eloGoalScale: spec.eloGoalScale },
    },
  };
}

export function assertG0MirrorsProductionEngine(input: {
  homeElo: number;
  awayElo: number;
}): void {
  const debug = predictDebugGeometry({ ...input, armId: "G0" });
  const production = new EloPoissonHybridEngine().predict(input);
  if (
    debug.expectedGoals.home !== production.expectedGoals.home ||
    debug.expectedGoals.away !== production.expectedGoals.away
  ) {
    throw new Error("G0 λ diverged from production EloPoissonHybridEngine");
  }
  if (
    Math.abs(debug.oneXTwo.home - production.oneXTwo.home) > 1e-12 ||
    Math.abs(debug.oneXTwo.draw - production.oneXTwo.draw) > 1e-12 ||
    Math.abs(debug.oneXTwo.away - production.oneXTwo.away) > 1e-12
  ) {
    throw new Error("G0 1X2 diverged from production EloPoissonHybridEngine");
  }
}

export function assertP0MirrorsC0(row: CalibrationRow): void {
  const panel = panelMatchElos("P0", row);
  const policy = createCurrentCataloguePolicy();
  if (panel.homeElo !== policy.resolve(row, "home").elo || panel.awayElo !== policy.resolve(row, "away").elo) {
    throw new Error(`P0 inputs diverged from C0 on ${row.fixtureId}`);
  }
}

export function assertP7MirrorsC7(row: CalibrationRow): void {
  const panel = panelMatchElos("P7", row);
  const expected = resolveMatchElos("C7", row);
  if (panel.homeElo !== expected.homeElo || panel.awayElo !== expected.awayElo) {
    throw new Error(`P7 inputs diverged from C7 on ${row.fixtureId}`);
  }
}
