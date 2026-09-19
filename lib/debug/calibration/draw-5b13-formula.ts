/**
 * Debug-only draw-channel compose. Isolated. Does not mutate production PE.
 * D0 = C0 + production G0. D1 = C7 + production G0. Diagnostics change one knob.
 */

import { EloPoissonHybridEngine, blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  eloToExpectedGoals,
  eloToOneXTwo,
} from "@/lib/intelligence/modules/probability/math/elo";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import { resolveMatchElos } from "@/lib/debug/calibration/ig-5b11-formula";
import { createCurrentCataloguePolicy } from "@/lib/debug/calibration/policies";
import {
  assertG0MirrorsProductionEngine,
  panelMatchElos,
  predictDebugGeometry,
} from "@/lib/debug/calibration/xg-5b12-formula";
import { lambdaRatio, totalXg } from "@/lib/debug/calibration/xg-5b9-geometry";
import {
  buildScoreGrid,
  independentPoissonGrid,
} from "@/lib/debug/calibration/dc-5b8-dixon-coles";
import {
  DRAW_SCORELINE_KEYS,
  drawPanelInputArm,
  type DeclaredBlendWeight,
  type DeclaredDcRho,
  type DeclaredDrawBaseDelta,
  type DrawPanelId,
  type DrawScorelineKey,
} from "@/lib/debug/calibration/draw-5b13-shape";
import type { CalibrationRow, OneXTwo } from "@/lib/debug/calibration/types";

export const PRODUCTION_DRAW_PIPELINE_AUDIT = {
  eloWinExpectancy: {
    function: "eloWinExpectancy",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    equation: "E_home = 1 / (1 + 10^((R_away - (R_home + homeAdvantageElo)) / eloScale))",
    eloScale: DEFAULT_HYBRID_CONFIG.eloScale,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
  },
  eloOneXTwo: {
    function: "eloToOneXTwo",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    equations: [
      "delta = R_home + homeAdvantageElo - R_away",
      "P_draw_raw = eloDrawBase * exp(-|delta| / eloDrawDecay)",
      "remaining = max(0, 1 - P_draw_raw)",
      "P_home_raw = remaining * E_home",
      "P_away_raw = remaining * (1 - E_home)",
      "then normalizeOutcomeProbability",
    ],
    eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
    eloDrawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
    homeAdvantageEloEntersDelta: true,
  },
  lambdas: {
    function: "eloToExpectedGoals",
    file: "lib/intelligence/modules/probability/math/elo.ts",
    equations: [
      "ratio = 10^((R_home - R_away) / eloGoalScale)",
      "λ_home = clamp(μ_home * ratio * γ, 0.05, 6)",
      "λ_away = clamp(μ_away / ratio, 0.05, 6)",
    ],
    eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    homeAdvantageEloEnters: false,
  },
  poissonScoreMatrix: {
    function: "marginalizePoissonScoreGrid",
    file: "lib/intelligence/modules/probability/hybrid/score-matrix.ts",
    pmf: "scorelineProbability = poissonPmf(i; λ_h) * poissonPmf(j; λ_a)",
    pmfFile: "lib/intelligence/modules/probability/math/poisson.ts",
    equations: [
      "P(i,j) = e^{-λ_h} λ_h^i / i! * e^{-λ_a} λ_a^j / j!",
      "P_home = Σ_{i>j} P(i,j) / coveredMass",
      "P_draw = Σ_{i=j} P(i,j) / coveredMass",
      "P_away = Σ_{i<j} P(i,j) / coveredMass",
      "coveredMass = Σ_{i,j=0..maxGoals} P(i,j)",
      "then normalizeOutcomeProbability",
    ],
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    dependence: "independent Poisson; no Dixon-Coles in production",
  },
  hybridBlend: {
    function: "blendOneXTwo",
    file: "lib/intelligence/modules/probability/hybrid/elo-poisson-engine.ts",
    equations: [
      "P = w * P_poisson + (1 - w) * P_elo",
      "then normalizeOutcomeProbability",
    ],
    poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
  },
  finalNormalization: {
    function: "normalizeOutcomeProbability",
    file: "lib/intelligence/modules/probability/math/normalize.ts",
    equation: "p_i' = p_i / (p_home + p_draw + p_away); zero-vector → uniform 1/3",
  },
} as const;

export const DRAW_CONTRIBUTION_TOLERANCE = 1e-12;

export type DrawScorelineMasses = Record<DrawScorelineKey, number>;

export type DrawSnapshot = {
  homeElo: number;
  awayElo: number;
  rawGap: number;
  elo: OneXTwo;
  poisson: OneXTwo;
  hybrid: OneXTwo;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  totalXg: number;
  drawContributionFromElo: number;
  drawContributionFromPoisson: number;
  expectedDrawScorelines: DrawScorelineMasses;
};

export function emptyDrawScorelines(): DrawScorelineMasses {
  return {
    "0-0": 0,
    "1-1": 0,
    "2-2": 0,
    "3-3": 0,
    "4-4+": 0,
    "other-equal": 0,
  };
}

export function panelDrawElos(
  panel: DrawPanelId,
  row: CalibrationRow,
): { homeElo: number; awayElo: number } {
  return resolveMatchElos(drawPanelInputArm(panel), row);
}

export function decomposeHybridDraw(
  eloDraw: number,
  poissonDraw: number,
  poissonBlendWeight: number = DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
): { drawContributionFromElo: number; drawContributionFromPoisson: number } {
  return {
    drawContributionFromElo: (1 - poissonBlendWeight) * eloDraw,
    drawContributionFromPoisson: poissonBlendWeight * poissonDraw,
  };
}

export function assertHybridDrawDecomposition(
  hybridDraw: number,
  eloDraw: number,
  poissonDraw: number,
  poissonBlendWeight: number = DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
): void {
  const parts = decomposeHybridDraw(eloDraw, poissonDraw, poissonBlendWeight);
  const raw = parts.drawContributionFromElo + parts.drawContributionFromPoisson;
  if (Math.abs(raw - hybridDraw) > DRAW_CONTRIBUTION_TOLERANCE) {
    throw new Error(
      `hybrid draw decomposition drifted: raw=${raw} hybrid=${hybridDraw}`,
    );
  }
}

function expectedDrawScorelines(lambdaHome: number, lambdaAway: number): DrawScorelineMasses {
  const grid = independentPoissonGrid({
    lambdaHome,
    lambdaAway,
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
  });
  const masses = emptyDrawScorelines();
  masses["0-0"] = grid.drawParts["0-0"];
  masses["1-1"] = grid.drawParts["1-1"];
  masses["2-2"] = grid.drawParts["2-2"];
  masses["3-3"] = grid.drawParts["3-3"];
  masses["4-4+"] = grid.drawParts["4-4+"];
  return masses;
}

export function predictProductionDrawChain(input: {
  homeElo: number;
  awayElo: number;
}): DrawSnapshot {
  const config = DEFAULT_HYBRID_CONFIG;
  const elo = eloToOneXTwo({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    homeAdvantageElo: config.homeAdvantageElo,
    drawBase: config.eloDrawBase,
    drawDecay: config.eloDrawDecay,
    scale: config.eloScale,
  });
  const { lambdaHome, lambdaAway } = eloToExpectedGoals({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    baseHomeGoals: config.baseHomeGoals,
    baseAwayGoals: config.baseAwayGoals,
    eloGoalScale: config.eloGoalScale,
    homeGoalsAdvantage: config.homeGoalsAdvantage,
  });
  const poissonMarginals = marginalizePoissonScoreGrid({
    lambdaHome,
    lambdaAway,
    maxGoals: config.maxGoals,
  });
  const hybrid = blendOneXTwo(poissonMarginals.oneXTwo, elo, config.poissonBlendWeight);
  const parts = decomposeHybridDraw(elo.draw, poissonMarginals.oneXTwo.draw);
  assertHybridDrawDecomposition(hybrid.draw, elo.draw, poissonMarginals.oneXTwo.draw);
  return {
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    rawGap: input.homeElo - input.awayElo,
    elo,
    poisson: poissonMarginals.oneXTwo,
    hybrid,
    lambdaHome,
    lambdaAway,
    lambdaRatio: lambdaRatio(lambdaHome, lambdaAway),
    totalXg: totalXg(lambdaHome, lambdaAway),
    drawContributionFromElo: parts.drawContributionFromElo,
    drawContributionFromPoisson: parts.drawContributionFromPoisson,
    expectedDrawScorelines: expectedDrawScorelines(lambdaHome, lambdaAway),
  };
}

export function assertD0MirrorsProduction(row: CalibrationRow): void {
  const panel = panelDrawElos("D0", row);
  const policy = createCurrentCataloguePolicy();
  if (panel.homeElo !== policy.resolve(row, "home").elo || panel.awayElo !== policy.resolve(row, "away").elo) {
    throw new Error(`D0 inputs diverged from C0 on ${row.fixtureId}`);
  }
  if (panel.homeElo !== panelMatchElos("P0", row).homeElo || panel.awayElo !== panelMatchElos("P0", row).awayElo) {
    throw new Error(`D0 inputs diverged from P0 on ${row.fixtureId}`);
  }
  assertG0MirrorsProductionEngine(panel);
  const debug = predictProductionDrawChain(panel);
  const production = new EloPoissonHybridEngine().predict(panel);
  if (
    Math.abs(debug.hybrid.home - production.oneXTwo.home) > 1e-12 ||
    Math.abs(debug.hybrid.draw - production.oneXTwo.draw) > 1e-12 ||
    Math.abs(debug.hybrid.away - production.oneXTwo.away) > 1e-12
  ) {
    throw new Error(`D0 hybrid diverged from production engine on ${row.fixtureId}`);
  }
}

export function assertD1MirrorsP7G0(row: CalibrationRow): void {
  const panel = panelDrawElos("D1", row);
  const expected = resolveMatchElos("C7", row);
  if (panel.homeElo !== expected.homeElo || panel.awayElo !== expected.awayElo) {
    throw new Error(`D1 inputs diverged from C7 on ${row.fixtureId}`);
  }
  const p7 = panelMatchElos("P7", row);
  if (panel.homeElo !== p7.homeElo || panel.awayElo !== p7.awayElo) {
    throw new Error(`D1 inputs diverged from P7 on ${row.fixtureId}`);
  }
  const debug = predictProductionDrawChain(panel);
  const g0 = predictDebugGeometry({ ...panel, armId: "G0" });
  if (
    Math.abs(debug.hybrid.draw - g0.oneXTwo.draw) > 1e-12 ||
    debug.lambdaHome !== g0.expectedGoals.home ||
    debug.lambdaAway !== g0.expectedGoals.away
  ) {
    throw new Error(`D1 G0 diverged from P7 G0 on ${row.fixtureId}`);
  }
}

export function predictDcHybrid(snapshot: DrawSnapshot, rho: DeclaredDcRho): OneXTwo {
  const grid = buildScoreGrid({
    lambdaHome: snapshot.lambdaHome,
    lambdaAway: snapshot.lambdaAway,
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    rho,
  });
  if (!grid.ok) {
    throw new Error(`Dixon-Coles diagnostic failed: ${grid.failure.reason}`);
  }
  return blendOneXTwo(grid.oneXTwo, snapshot.elo, DEFAULT_HYBRID_CONFIG.poissonBlendWeight);
}

export function predictDrawBaseHybrid(
  snapshot: DrawSnapshot,
  delta: DeclaredDrawBaseDelta,
): { elo: OneXTwo; hybrid: OneXTwo } {
  const elo = eloToOneXTwo({
    homeElo: snapshot.homeElo,
    awayElo: snapshot.awayElo,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    drawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase + delta,
    drawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
    scale: DEFAULT_HYBRID_CONFIG.eloScale,
  });
  return {
    elo,
    hybrid: blendOneXTwo(snapshot.poisson, elo, DEFAULT_HYBRID_CONFIG.poissonBlendWeight),
  };
}

export function predictBlendHybrid(
  snapshot: DrawSnapshot,
  weight: DeclaredBlendWeight,
): OneXTwo {
  return blendOneXTwo(snapshot.poisson, snapshot.elo, weight);
}

export function predictHaHybrid(
  snapshot: DrawSnapshot,
  homeAdvantageElo: 0 | 65,
): { elo: OneXTwo; hybrid: OneXTwo } {
  const elo = eloToOneXTwo({
    homeElo: snapshot.homeElo,
    awayElo: snapshot.awayElo,
    homeAdvantageElo,
    drawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
    drawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
    scale: DEFAULT_HYBRID_CONFIG.eloScale,
  });
  return {
    elo,
    hybrid: blendOneXTwo(snapshot.poisson, elo, DEFAULT_HYBRID_CONFIG.poissonBlendWeight),
  };
}

export function dcPoissonDraw(snapshot: DrawSnapshot, rho: DeclaredDcRho): number {
  const grid = buildScoreGrid({
    lambdaHome: snapshot.lambdaHome,
    lambdaAway: snapshot.lambdaAway,
    maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
    rho,
  });
  if (!grid.ok) {
    throw new Error(`Dixon-Coles diagnostic failed: ${grid.failure.reason}`);
  }
  return grid.oneXTwo.draw;
}

export function assertRho0MirrorsIndependentPoisson(snapshot: DrawSnapshot): void {
  const hybrid = predictDcHybrid(snapshot, 0);
  if (
    Math.abs(hybrid.draw - snapshot.hybrid.draw) > 1e-12 ||
    Math.abs(hybrid.home - snapshot.hybrid.home) > 1e-12
  ) {
    throw new Error("rho=0 Dixon-Coles must reproduce independent Poisson hybrid");
  }
  const parts = snapshot.expectedDrawScorelines;
  const sum = DRAW_SCORELINE_KEYS.reduce((acc, key) => acc + parts[key], 0);
  if (Math.abs(sum - snapshot.poisson.draw) > 1e-9) {
    throw new Error("Independent Poisson draw parts must sum to Poisson draw");
  }
}
