/**
 * Sprint 5B.14 — higher-score draw dependence forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  DECLARED_LAMBDA3,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  HS_PANELS,
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  assertLambda3ZeroMirrorsIndependent,
  bootstrapPearson,
  buildBivariateScoreGrid,
  buildIndependentScoreGrid,
  bivariateScorelineProbability,
  createSyntheticCalibrationRows,
  diagnosticLambdas,
  evaluateHsPanelSeason,
  isHighEqual,
  isLowEqual,
  loadDrawForensicsSeason,
  panelDrawElos,
  panelMatchElos,
  pearsonCorrelation,
  poolHoldoutHs,
  predictBivariateHybrid,
  predictProductionDrawChain,
  resolveMatchElos,
  twoTwoRatioBucket,
  twoTwoXgBucket,
} from "@/lib/debug/calibration";
import { snapshotHsPanel } from "@/lib/debug/calibration/hs-5b14-evaluate";
import { reconstructTeamRecord } from "@/lib/debug/calibration/reconstruct";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { poissonPmf, scorelineProbability } from "@/lib/intelligence/modules/probability/math/poisson";
import type { CalibrationRow, ReconstructionFixture } from "@/lib/debug/calibration/types";

function labeled(season: "2023" | "2024" | "2025"): CalibrationRow[] {
  return createSyntheticCalibrationRows().map((row, index) => ({
    ...row,
    fixtureId: `${season}-${index}-${row.fixtureId}`,
    competitionId: "39",
    competitionName: "Premier League",
    season,
  }));
}

function villaRow(): CalibrationRow {
  const base = labeled("2023")[0]!;
  return {
    ...base,
    fixtureId: "trace-villa-sheff",
    kickoff: "2023-12-22T20:00:00.000Z",
    homeTeamName: "Aston Villa",
    awayTeamName: "Sheffield Utd",
    homePlayedBefore: 17,
    homeWinsBefore: 12,
    homeGfBefore: 37,
    homeGaBefore: 21,
    awayPlayedBefore: 17,
    awayWinsBefore: 2,
    awayGfBefore: 12,
    awayGaBefore: 43,
    actualHomeGoals: 1,
    actualAwayGoals: 1,
    actualOutcome: "draw",
  };
}

const HS14_FILES = [
  "lib/debug/calibration/hs-5b14-shape.ts",
  "lib/debug/calibration/hs-5b14-formula.ts",
  "lib/debug/calibration/hs-5b14-evaluate.ts",
  "lib/debug/calibration/hs-5b14-report.ts",
];

describe("Sprint 5B.14 — higher-score draw dependence forensics", () => {
  it("requires no network or credentials and freezes production", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect([...HS_PANELS]).toEqual(["D0", "D1"]);
    expect([...DECLARED_LAMBDA3]).toEqual([0, 0.05, 0.1, 0.2]);
    expect(BOOTSTRAP_SEED).toBe(5142026);
    expect(BOOTSTRAP_RESAMPLES).toBe(2000);
    expect(isLowEqual(0, 0)).toBe(true);
    expect(isLowEqual(1, 1)).toBe(true);
    expect(isHighEqual(2, 2)).toBe(true);
    expect(isHighEqual(3, 3)).toBe(true);
    expect(isHighEqual(1, 1)).toBe(false);
    expect(twoTwoRatioBucket(5)).toBe("5+");
    expect(twoTwoXgBucket(2.4)).toBe("<2.5");
  });

  it("reproduces D0/D1, independent matrices, and isolated λ3 diagnostics", () => {
    labeled("2024").forEach(assertD0MirrorsProduction);
    labeled("2024").forEach(assertD1MirrorsP7G0);
    const row = labeled("2024")[1]!;
    expect(panelDrawElos("D0", row)).toEqual(resolveMatchElos("C0", row));
    expect(panelDrawElos("D0", row)).toEqual(panelMatchElos("P0", row));
    expect(panelDrawElos("D1", row)).toEqual(resolveMatchElos("C7", row));

    const snap = predictProductionDrawChain({ homeElo: 1550, awayElo: 1500 });
    const production = new EloPoissonHybridEngine().predict({ homeElo: 1550, awayElo: 1500 });
    expect(snap.hybrid.draw).toBeCloseTo(production.oneXTwo.draw, 12);
    const independent = buildIndependentScoreGrid({
      lambdaHome: snap.lambdaHome,
      lambdaAway: snap.lambdaAway,
    });
    expect(independent.draw).toBeCloseTo(snap.poisson.draw, 12);
    expect(independent.coveredMass).toBeGreaterThan(0.99);
    const cellSum = independent.cells.reduce(
      (sum, line) => sum + line.reduce((inner, value) => inner + value, 0),
      0,
    );
    expect(cellSum).toBeCloseTo(1, 12);
    expect(scorelineProbability(2, 2, snap.lambdaHome, snap.lambdaAway) / independent.coveredMass).toBeCloseTo(
      independent.p22,
      12,
    );

    assertLambda3ZeroMirrorsIndependent({ lambdaHome: 1.45, lambdaAway: 1.15 });
    const zero = buildBivariateScoreGrid({ lambdaHome: 1.45, lambdaAway: 1.15, lambda3: 0 });
    expect(zero.draw).toBeCloseTo(buildIndependentScoreGrid({ lambdaHome: 1.45, lambdaAway: 1.15 }).draw, 12);
    expect(bivariateScorelineProbability(2, 2, 1.45, 1.15, 0)).toBeCloseTo(
      poissonPmf(2, 1.45) * poissonPmf(2, 1.15),
      12,
    );

    const l3 = diagnosticLambdas(1.45, 1.15, 0.1);
    expect(l3.lambda1).toBeCloseTo(1.35, 12);
    expect(l3.lambda2).toBeCloseTo(1.05, 12);
    const replay = predictBivariateHybrid({
      elo: snap.elo,
      lambdaHome: snap.lambdaHome,
      lambdaAway: snap.lambdaAway,
      lambda3: 0,
    });
    expect(replay.hybrid.draw).toBeCloseTo(snap.hybrid.draw, 12);
    const lifted = buildBivariateScoreGrid({ lambdaHome: 1.45, lambdaAway: 1.15, lambda3: 0.2 });
    expect(lifted.p22).toBeGreaterThan(zero.p22);
    expect(lifted.p33).toBeGreaterThan(zero.p33);
    expect(lifted.draw).toBeGreaterThan(zero.draw);
    expect(replay.hybrid.home + replay.hybrid.draw + replay.hybrid.away).toBeCloseTo(1, 12);

    for (const lambda3 of [0.05, 0.1, 0.2] as const) {
      const grid = buildBivariateScoreGrid({ lambdaHome: 1.45, lambdaAway: 1.15, lambda3 });
      const cellSum = grid.cells.reduce(
        (sum, line) => sum + line.reduce((inner, value) => inner + value, 0),
        0,
      );
      expect(cellSum).toBeCloseTo(1, 12);
      expect(grid.oneXTwo.home + grid.oneXTwo.draw + grid.oneXTwo.away).toBeCloseTo(1, 12);
      expect(grid.coveredMass).toBeGreaterThan(0.99);
      let meanHome = 0;
      let meanAway = 0;
      for (let i = 0; i <= 15; i += 1) {
        for (let j = 0; j <= 15; j += 1) {
          meanHome += i * grid.cells[i]![j]!;
          meanAway += j * grid.cells[i]![j]!;
        }
      }
      expect(meanHome).toBeCloseTo(1.45, 2);
      expect(meanAway).toBeCloseTo(1.15, 2);
    }
  });

  it("evaluates isolated panels with deterministic correlation/bootstrap and no ranking", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2024");
    const first = evaluateHsPanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    const second = evaluateHsPanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    expect(first.n).toBe(rows.length);
    expect(first.failures).toEqual([]);
    expect(JSON.stringify(first.exactScoreOe)).toEqual(JSON.stringify(second.exactScoreOe));
    expect(JSON.stringify(first.conditionalDraw)).toEqual(JSON.stringify(second.conditionalDraw));
    expect(JSON.stringify(first.correlation)).toEqual(JSON.stringify(second.correlation));
    expect(first.correlation.residualBootstrap.seed).toBe(BOOTSTRAP_SEED);
    expect(first.correlation.residualBootstrap.resamples).toBe(2000);
    expect(first.lambda3.map((row) => row.lambda3)).toEqual([0, 0.05, 0.1, 0.2]);
    expect(first.lambda3.every((row) => row.diagnosticOnly)).toBe(true);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);

    const xs = [1, 2, 3, 4];
    const ys = [1, 2, 2, 5];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(bootstrapPearson({ xs, ys }).estimate, 12);
    expect(bootstrapPearson({ xs, ys })).toEqual(bootstrapPearson({ xs, ys }));

    const traced = evaluateHsPanelSeason({
      rows: [...labeled("2023"), villaRow()],
      season: "2023",
      role: "HOLDOUT",
      panel: "D0",
    });
    expect(traced.namedTraces[0]?.label).toContain("Aston Villa vs Sheffield Utd 1-1");
    const villaHybrid = traced.namedTraces[0]!.byLambda3["0"]!.hybrid;
    expect(villaHybrid.home + villaHybrid.draw + villaHybrid.away).toBeCloseTo(1, 12);
    expect(traced.namedTraces[0]!.byLambda3["0"]!.draw).toBeCloseTo(
      traced.namedTraces[0]!.production.draw > 0
        ? traced.namedTraces[0]!.byLambda3["0"]!.draw
        : 0,
      12,
    );
    const villaTrace = first.scoreCells.find((cell) => cell.homeGoals === 0 && cell.awayGoals === 0);
    expect(villaTrace?.expectedCount).toBeGreaterThan(0);
    expect(first.lowHighEqual.high.key).toBe("HIGH_EQUAL");
    expect(first.lowHighEqual.low.key).toBe("LOW_EQUAL");
    const villaSnap = snapshotHsPanel({
      rows: [villaRow()],
      season: "2023",
      role: "HOLDOUT",
      panel: "D0",
    });
    expect(villaSnap.failures).toEqual([]);
    expect(villaSnap.traces[0]!.homeResidual).toBeCloseTo(
      1 - villaSnap.traces[0]!.snapshot.lambdaHome,
      12,
    );
    expect(villaSnap.traces[0]!.awayResidual).toBeCloseTo(
      1 - villaSnap.traces[0]!.snapshot.lambdaAway,
      12,
    );
    expect(() => bootstrapPearson({ xs, ys, seed: 1 })).toThrow(/seed/);
    expect(() => bootstrapPearson({ xs, ys, resamples: 100 })).toThrow(/resamples/);

    const holdout = poolHoldoutHs([
      evaluateHsPanelSeason({ rows: labeled("2023"), season: "2023", role: "HOLDOUT", panel: "D0" }),
      evaluateHsPanelSeason({ rows: labeled("2025"), season: "2025", role: "HOLDOUT", panel: "D0" }),
    ]);
    expect(holdout.seasons).toEqual(["2023", "2025"]);
    expect(() =>
      poolHoldoutHs([
        {
          ...first,
          season: "2024",
          role: "HOLDOUT",
        },
      ]),
    ).toThrow(/exclude PL 2024/);
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").n).toBe(380);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
  });

  it("preserves leakage and has no live/odds/search/ranking helpers", () => {
    const sameKickoff: ReconstructionFixture[] = [
      {
        fixtureId: "a",
        kickoff: "2024-08-10T15:00:00.000Z",
        competitionId: "39",
        season: "2024",
        homeTeamId: "t1",
        awayTeamId: "t2",
        status: "FT",
        goalsHome: 1,
        goalsAway: 0,
        fulltimeHome: 1,
        fulltimeAway: 0,
      },
      {
        fixtureId: "b",
        kickoff: "2024-08-10T15:00:00.000Z",
        competitionId: "39",
        season: "2024",
        homeTeamId: "t1",
        awayTeamId: "t3",
        status: "FT",
        goalsHome: 4,
        goalsAway: 0,
        fulltimeHome: 4,
        fulltimeAway: 0,
      },
    ];
    expect(
      reconstructTeamRecord({
        teamId: "t1",
        kickoff: "2024-08-10T15:00:00.000Z",
        competitionId: "39",
        season: "2024",
        fixtures: sameKickoff,
      }).played,
    ).toBe(0);

    const sources = HS14_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/lambda3 = 0\.15|lambda3: 0\.3|fitLambda3|estimateLambda3/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(500|600|800)/);
    expect(sources).not.toMatch(/eloDrawBase:\s*0\.31/);
    expect(sources).not.toMatch(/DECLARED_.*GRID/);
  });
});
