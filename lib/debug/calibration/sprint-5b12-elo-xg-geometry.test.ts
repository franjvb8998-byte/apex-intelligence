/**
 * Sprint 5B.12 — Elo→xG geometry counterfactuals.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DECLARED_ELO_GOAL_SCALES,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  EFFECTIVE_GAP_CAP,
  GEOMETRY_ARMS,
  GEOMETRY_PANELS,
  P7_NON_CANDIDATE_LABEL,
  assertG0MirrorsProductionEngine,
  assertP0MirrorsC0,
  assertP7MirrorsC7,
  catalogueEloGapBucket,
  clampEffectiveGap,
  createSyntheticCalibrationRows,
  effectiveEloPair,
  evaluatePanelSeason,
  geometryArmSpec,
  loadDrawForensicsSeason,
  panelMatchElos,
  poolHoldoutGeometry,
  predictDebugGeometry,
  resolveMatchElos,
} from "@/lib/debug/calibration";
import { reconstructTeamRecord } from "@/lib/debug/calibration/reconstruct";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { eloToExpectedGoals } from "@/lib/intelligence/modules/probability/math/elo";
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

const XG12_FILES = [
  "lib/debug/calibration/xg-5b12-shape.ts",
  "lib/debug/calibration/xg-5b12-formula.ts",
  "lib/debug/calibration/xg-5b12-evaluate.ts",
  "lib/debug/calibration/xg-5b12-report.ts",
];

describe("Sprint 5B.12 — Elo→xG geometry counterfactuals", () => {
  it("requires no network or credentials and freezes production geometry", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect([...DECLARED_ELO_GOAL_SCALES]).toEqual([400, 500, 600, 800]);
    expect(EFFECTIVE_GAP_CAP).toBe(200);
    expect([...GEOMETRY_PANELS]).toEqual(["P0", "P7"]);
    expect([...GEOMETRY_ARMS]).toEqual(["G0", "G1", "G2", "G3", "G4", "G5"]);
    expect(P7_NON_CANDIDATE_LABEL).toContain("NON_CANDIDATE");
    expect(catalogueEloGapBucket(249)).toBe("200-249");
    expect(geometryArmSpec("G0").eloGoalScale).toBe(400);
    expect(geometryArmSpec("G1").eloGoalScale).toBe(500);
    expect(geometryArmSpec("G2").eloGoalScale).toBe(600);
    expect(geometryArmSpec("G3").eloGoalScale).toBe(800);
    expect(geometryArmSpec("G4").capEffectiveGap).toBe(true);
    expect(geometryArmSpec("G4").eloGoalScale).toBe(400);
    expect(geometryArmSpec("G5").eloGoalScale).toBe(600);
    expect(geometryArmSpec("G5").capEffectiveGap).toBe(true);
  });

  it("reproduces G0 and isolates S / cap / panel inputs", () => {
    assertG0MirrorsProductionEngine({ homeElo: 1695, awayElo: 1391 });
    const g0 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G0" });
    const production = eloToExpectedGoals({
      homeElo: 1700,
      awayElo: 1400,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: 400,
      homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    });
    expect(g0.expectedGoals.home).toBe(production.lambdaHome);
    expect(g0.expectedGoals.away).toBe(production.lambdaAway);
    expect(g0.effectiveGap).toBe(300);

    const g1 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G1" });
    const s500 = eloToExpectedGoals({
      homeElo: 1700,
      awayElo: 1400,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: 500,
      homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    });
    expect(g1.expectedGoals.home).toBe(s500.lambdaHome);
    expect(g1.meta.config.eloGoalScale).toBe(500);

    const g2 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G2" });
    expect(g2.meta.config.eloGoalScale).toBe(600);
    const g3 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G3" });
    expect(g3.meta.config.eloGoalScale).toBe(800);
    expect(g3.expectedGoals.home).toBeLessThan(g0.expectedGoals.home);

    expect(clampEffectiveGap(300)).toBe(200);
    expect(clampEffectiveGap(-250)).toBe(-200);
    const capped = effectiveEloPair({ homeElo: 1700, awayElo: 1400, capEffectiveGap: true });
    expect(capped.rawGap).toBe(300);
    expect(capped.effectiveGap).toBe(200);
    const g4 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G4" });
    const cappedLambda = eloToExpectedGoals({
      homeElo: capped.lambdaHomeElo,
      awayElo: capped.lambdaAwayElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: 400,
      homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    });
    expect(g4.expectedGoals.home).toBe(cappedLambda.lambdaHome);
    expect(g4.effectiveGap).toBe(200);
    expect(g4.elo.oneXTwo.home).toBe(g0.elo.oneXTwo.home);

    const g5 = predictDebugGeometry({ homeElo: 1700, awayElo: 1400, armId: "G5" });
    expect(g5.meta.config.eloGoalScale).toBe(600);
    expect(g5.effectiveGap).toBe(200);

    labeled("2024").forEach(assertP0MirrorsC0);
    labeled("2024").forEach(assertP7MirrorsC7);
    const row = labeled("2024")[1]!;
    expect(panelMatchElos("P0", row)).toEqual(resolveMatchElos("C0", row));
    expect(panelMatchElos("P7", row)).toEqual(resolveMatchElos("C7", row));
  });

  it("evaluates isolated panels without mutating production or ranking arms", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2024");
    const first = evaluatePanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "P0",
    });
    const second = evaluatePanelSeason({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "P0",
    });
    expect(first.n).toBe(rows.length);
    expect(first.failures).toEqual([]);
    expect(first.peHomeAdvantageElo).toBe(65);
    expect(JSON.stringify(first.arms.G0.all)).toEqual(JSON.stringify(second.arms.G0.all));
    expect(JSON.stringify(first.deltas)).toEqual(JSON.stringify(second.deltas));
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    for (const armId of GEOMETRY_ARMS) {
      const sum =
        first.arms[armId].all.predictedHome +
        first.arms[armId].all.predictedDraw +
        first.arms[armId].all.predictedAway;
      expect(sum).toBeCloseTo(1, 8);
      expect(first.arms[armId].all.n).toBe(rows.length);
    }
    expect(first.deltas.map((delta) => delta.contrast)).toEqual([
      "G1-G0",
      "G2-G0",
      "G3-G0",
      "G4-G0",
      "G5-G0",
    ]);
    expect(first.arms.G0.byEvidence["0"].n + first.arms.G0.byEvidence["1-3"].n).toBeGreaterThan(0);

    const traced = evaluatePanelSeason({
      rows: [...labeled("2023"), villaRow()],
      season: "2023",
      role: "HOLDOUT",
      panel: "P0",
    });
    expect(traced.arms.G0.namedTraces[0]?.label).toContain("Aston Villa vs Sheffield Utd 1-1");
    const hybrid = traced.arms.G0.namedTraces[0]!.hybrid;
    expect(hybrid.home + hybrid.draw + hybrid.away).toBeCloseTo(1, 12);

    const holdout = poolHoldoutGeometry([
      evaluatePanelSeason({ rows: labeled("2023"), season: "2023", role: "HOLDOUT", panel: "P0" }),
      evaluatePanelSeason({ rows: labeled("2025"), season: "2025", role: "HOLDOUT", panel: "P0" }),
    ]);
    expect(holdout.seasons).toEqual(["2023", "2025"]);
    expect(holdout.seasons).not.toContain("2024");
    expect(() =>
      poolHoldoutGeometry([
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

  it("preserves leakage and has no live/odds/search helpers", () => {
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

    const sources = XG12_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(450|700|900|1000)/);
    expect(sources).not.toMatch(/EFFECTIVE_GAP_CAP = (150|250|180)/);
    expect(sources).not.toMatch(/homeAdvantageElo:\s*0/);
    expect(sources).not.toMatch(/eloDrawBase:\s*0\.2/);
    expect(sources).not.toMatch(/DECLARED_.*GRID/);
  });
});
