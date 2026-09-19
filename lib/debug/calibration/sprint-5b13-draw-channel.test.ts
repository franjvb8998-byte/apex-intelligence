/**
 * Sprint 5B.13 — draw-channel residual forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  D1_NON_CANDIDATE_LABEL,
  DECLARED_BLEND_WEIGHTS,
  DECLARED_DC_RHOS,
  DECLARED_DRAW_BASE_DELTAS,
  DECLARED_HA_VALUES,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  DRAW_PANELS,
  PRODUCTION_DRAW_PIPELINE_AUDIT,
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  assertHybridDrawDecomposition,
  createSyntheticCalibrationRows,
  decomposeHybridDraw,
  dixonColesTau,
  drawProbBucket,
  eloGapDrawBucket,
  evaluateDrawPanelSeason,
  lambdaRatioDrawBucket,
  loadDrawForensicsSeason,
  observedDrawScoreline,
  panelDrawElos,
  panelMatchElos,
  poolHoldoutDraw,
  predictBlendHybrid,
  predictDcHybrid,
  predictDrawBaseHybrid,
  predictHaHybrid,
  predictProductionDrawChain,
  resolveMatchElos,
  totalXgDrawBucket,
} from "@/lib/debug/calibration";
import { reconstructTeamRecord } from "@/lib/debug/calibration/reconstruct";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
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

const DRAW13_FILES = [
  "lib/debug/calibration/draw-5b13-shape.ts",
  "lib/debug/calibration/draw-5b13-formula.ts",
  "lib/debug/calibration/draw-5b13-evaluate.ts",
  "lib/debug/calibration/draw-5b13-report.ts",
];

describe("Sprint 5B.13 — draw-channel residual forensics", () => {
  it("requires no network or credentials and freezes the production draw pipeline", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawDecay).toBe(220);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect(DEFAULT_HYBRID_CONFIG.maxGoals).toBe(15);
    expect(PRODUCTION_DRAW_PIPELINE_AUDIT.eloOneXTwo.eloDrawBase).toBe(0.28);
    expect(PRODUCTION_DRAW_PIPELINE_AUDIT.poissonScoreMatrix.maxGoals).toBe(15);
    expect(PRODUCTION_DRAW_PIPELINE_AUDIT.hybridBlend.poissonBlendWeight).toBe(0.7);
    expect([...DRAW_PANELS]).toEqual(["D0", "D1"]);
    expect(D1_NON_CANDIDATE_LABEL).toContain("NON_CANDIDATE");
    expect([...DECLARED_DC_RHOS]).toEqual([0, -0.05, -0.1]);
    expect([...DECLARED_DRAW_BASE_DELTAS]).toEqual([-0.03, 0.03]);
    expect([...DECLARED_BLEND_WEIGHTS]).toEqual([0.7, 0.5, 0.9]);
    expect([...DECLARED_HA_VALUES]).toEqual([65, 0]);
    expect(drawProbBucket(0.024)).toBe("0-2.5%");
    expect(drawProbBucket(0.26)).toBe("25-30%");
    expect(eloGapDrawBucket(249)).toBe("200-249");
    expect(eloGapDrawBucket(250)).toBe("250+");
    expect(lambdaRatioDrawBucket(12)).toBe("12+");
    expect(totalXgDrawBucket(2.4)).toBe("2.0-2.49");
    expect(observedDrawScoreline(2, 2)).toBe("2-2");
    expect(observedDrawScoreline(4, 4)).toBe("4-4+");
    expect(observedDrawScoreline(1, 0)).toBeNull();
  });

  it("reproduces D0/D1 and isolates one diagnostic at a time", () => {
    labeled("2024").forEach(assertD0MirrorsProduction);
    labeled("2024").forEach(assertD1MirrorsP7G0);
    const row = labeled("2024")[1]!;
    expect(panelDrawElos("D0", row)).toEqual(resolveMatchElos("C0", row));
    expect(panelDrawElos("D0", row)).toEqual(panelMatchElos("P0", row));
    expect(panelDrawElos("D1", row)).toEqual(resolveMatchElos("C7", row));
    expect(panelDrawElos("D1", row)).toEqual(panelMatchElos("P7", row));

    const snap = predictProductionDrawChain({ homeElo: 1700, awayElo: 1400 });
    const production = new EloPoissonHybridEngine().predict({ homeElo: 1700, awayElo: 1400 });
    expect(snap.hybrid.draw).toBeCloseTo(production.oneXTwo.draw, 12);
    expect(snap.lambdaHome).toBe(production.expectedGoals.home);
    const parts = decomposeHybridDraw(snap.elo.draw, snap.poisson.draw, 0.7);
    expect(parts.drawContributionFromElo + parts.drawContributionFromPoisson).toBeCloseTo(
      snap.hybrid.draw,
      12,
    );
    assertHybridDrawDecomposition(snap.hybrid.draw, snap.elo.draw, snap.poisson.draw);

    const rho0 = predictDcHybrid(snap, 0);
    expect(rho0.draw).toBeCloseTo(snap.hybrid.draw, 12);
    const independent = marginalizePoissonScoreGrid({
      lambdaHome: snap.lambdaHome,
      lambdaAway: snap.lambdaAway,
      maxGoals: 15,
    });
    expect(snap.poisson.draw).toBeCloseTo(independent.oneXTwo.draw, 12);

    expect(dixonColesTau(2, 2, snap.lambdaHome, snap.lambdaAway, -0.1)).toBe(1);
    expect(dixonColesTau(3, 3, snap.lambdaHome, snap.lambdaAway, -0.05)).toBe(1);
    const dc05 = predictDcHybrid(snap, -0.05);
    const dc10 = predictDcHybrid(snap, -0.1);
    expect(dc05.draw).not.toBe(snap.hybrid.draw);
    expect(dc10.draw).not.toBe(snap.hybrid.draw);

    const down = predictDrawBaseHybrid(snap, -0.03);
    const up = predictDrawBaseHybrid(snap, 0.03);
    expect(down.elo.draw).toBeLessThan(snap.elo.draw);
    expect(up.elo.draw).toBeGreaterThan(snap.elo.draw);
    expect(down.hybrid.home + down.hybrid.draw + down.hybrid.away).toBeCloseTo(1, 12);

    const b05 = predictBlendHybrid(snap, 0.5);
    const b09 = predictBlendHybrid(snap, 0.9);
    const b07 = predictBlendHybrid(snap, 0.7);
    expect(b07.draw).toBeCloseTo(snap.hybrid.draw, 12);
    expect(b05.draw).not.toBe(b09.draw);

    const ha0 = predictHaHybrid(snap, 0);
    const ha65 = predictHaHybrid(snap, 65);
    expect(ha65.hybrid.draw).toBeCloseTo(snap.hybrid.draw, 12);
    expect(ha0.elo.home).not.toBe(snap.elo.home);
  });

  it("evaluates isolated panels without mutating production or ranking diagnostics", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2024");
    const first = evaluateDrawPanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    const second = evaluateDrawPanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    expect(first.n).toBe(rows.length);
    expect(first.failures).toEqual([]);
    expect(JSON.stringify(first.production)).toEqual(JSON.stringify(second.production));
    expect(JSON.stringify(first.drawProbBuckets)).toEqual(JSON.stringify(second.drawProbBuckets));
    expect(JSON.stringify(first.eloGapForensics)).toEqual(JSON.stringify(second.eloGapForensics));
    expect(JSON.stringify(first.poissonRatioForensics)).toEqual(
      JSON.stringify(second.poissonRatioForensics),
    );
    expect(JSON.stringify(first.totalXgForensics)).toEqual(JSON.stringify(second.totalXgForensics));
    expect(JSON.stringify(first.scorelines)).toEqual(JSON.stringify(second.scorelines));
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    const sum = first.production.predictedHome + first.production.predictedDraw + first.production.predictedAway;
    expect(sum).toBeCloseTo(1, 8);
    expect(first.diagnostics.every((row) => row.diagnosticOnly)).toBe(true);
    expect(first.diagnostics.map((row) => row.id).sort()).toEqual(
      ["blend:0.5", "blend:0.9", "dc:-0.05", "dc:-0.1", "drawBase:+0.03", "drawBase:-0.03", "ha:0"].sort(),
    );

    const traced = evaluateDrawPanelSeason({
      rows: [...labeled("2023"), villaRow()],
      season: "2023",
      role: "HOLDOUT",
      panel: "D0",
    });
    expect(traced.namedTraces[0]?.label).toContain("Aston Villa vs Sheffield Utd 1-1");
    const hybrid = traced.namedTraces[0]!.hybrid;
    expect(hybrid.home + hybrid.draw + hybrid.away).toBeCloseTo(1, 12);
    expect(traced.namedTraces[0]!.diagnostics.dcRho0.draw).toBeCloseTo(hybrid.draw, 12);

    const holdout = poolHoldoutDraw([
      evaluateDrawPanelSeason({ rows: labeled("2023"), season: "2023", role: "HOLDOUT", panel: "D0" }),
      evaluateDrawPanelSeason({ rows: labeled("2025"), season: "2025", role: "HOLDOUT", panel: "D0" }),
    ]);
    expect(holdout.seasons).toEqual(["2023", "2025"]);
    expect(holdout.seasons).not.toContain("2024");
    expect(() =>
      poolHoldoutDraw([
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
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
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

    const sources = DRAW13_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/DECLARED_DIXON_COLES_RHO_GRID/);
    expect(sources).not.toMatch(/rho = -0\.15|rho = 0\.05|rho: -0\.2/);
    expect(sources).not.toMatch(/eloDrawBase:\s*0\.2[^28]|eloDrawBase:\s*0\.31/);
    expect(sources).not.toMatch(/poissonBlendWeight:\s*0\.[468]/);
    expect(sources).not.toMatch(/homeAdvantageElo:\s*(32|50|80)/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(500|600|800)/);
    expect(sources).not.toMatch(/DECLARED_.*GRID/);
  });
});
