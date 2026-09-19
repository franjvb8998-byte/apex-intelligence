/**
 * Sprint 5B.16 — local HIGH_EQUAL mass diagnostic.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  HALF_SIZE,
  HIGH_EQUAL_MULTIPLIERS,
  LOCAL_MASS_ARMS,
  LM_PANELS,
  QUARTILE_SIZE,
  SEASON_N,
  TRANSFER_HIGH_EQUAL_RELATIVE,
  applyHighEqualMultiplier,
  applyHighEqualTransfer,
  applyLocalMassArm,
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  assertM0MirrorsIndependent,
  buildControlGrid,
  createSyntheticCalibrationRows,
  evaluateSeasonLocalMass,
  isHighEqual,
  isHighEqualCell,
  isLowEqual,
  isLowEqualCell,
  leaveOneSeasonOutLocal,
  loadDrawForensicsSeason,
  panelDrawElos,
  panelMatchElos,
  poolHoldoutLocal,
  resolveMatchElos,
  summarizeCells,
} from "@/lib/debug/calibration";
import { reconstructTeamRecord } from "@/lib/debug/calibration/reconstruct";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { CalibrationRow, ReconstructionFixture } from "@/lib/debug/calibration/types";

function usableBase(): CalibrationRow[] {
  return createSyntheticCalibrationRows().filter(
    (row) => row.actualOutcome != null && row.actualHomeGoals != null && row.actualAwayGoals != null,
  );
}

function expandSeason(season: "2023" | "2024" | "2025"): CalibrationRow[] {
  const base = usableBase();
  return Array.from({ length: SEASON_N }, (_, index) => {
    const src = base[index % base.length]!;
    return {
      ...src,
      fixtureId: `${season}-${String(index).padStart(3, "0")}-${src.fixtureId}`,
      kickoff: new Date(Date.parse("2024-08-10T15:00:00.000Z") + Math.floor(index / 2) * 3_600_000).toISOString(),
      competitionId: "39",
      competitionName: "Premier League",
      season,
    };
  });
}

const LM16_FILES = [
  "lib/debug/calibration/lm-5b16-shape.ts",
  "lib/debug/calibration/lm-5b16-formula.ts",
  "lib/debug/calibration/lm-5b16-evaluate.ts",
  "lib/debug/calibration/lm-5b16-report.ts",
];

describe("Sprint 5B.16 — local HIGH_EQUAL mass diagnostic", () => {
  it("requires no network or credentials and freezes production", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect([...LM_PANELS]).toEqual(["D0", "D1"]);
    expect([...LOCAL_MASS_ARMS]).toEqual(["M0", "M1", "M2", "M3", "T1"]);
    expect(HIGH_EQUAL_MULTIPLIERS).toEqual({ M0: 1, M1: 1.1, M2: 1.25, M3: 1.5 });
    expect(TRANSFER_HIGH_EQUAL_RELATIVE).toBe(0.1);
    expect(isHighEqualCell(2, 2)).toBe(true);
    expect(isHighEqualCell(1, 1)).toBe(false);
    expect(isLowEqualCell(0, 0)).toBe(true);
    expect(isHighEqual(2, 2)).toBe(true);
    expect(isLowEqual(1, 1)).toBe(true);
    expect(HALF_SIZE).toBe(190);
    expect(QUARTILE_SIZE).toBe(95);
  });

  it("reproduces D0/D1, M0 independent Poisson, and isolated local-mass probes", () => {
    expandSeason("2024").slice(0, 6).forEach(assertD0MirrorsProduction);
    expandSeason("2024").slice(0, 6).forEach(assertD1MirrorsP7G0);
    const row = expandSeason("2024")[1]!;
    expect(panelDrawElos("D0", row)).toEqual(resolveMatchElos("C0", row));
    expect(panelDrawElos("D0", row)).toEqual(panelMatchElos("P0", row));
    expect(panelDrawElos("D1", row)).toEqual(resolveMatchElos("C7", row));

    assertM0MirrorsIndependent({ lambdaHome: 1.45, lambdaAway: 1.15 });
    const control = buildControlGrid(1.45, 1.15);
    const m0 = applyLocalMassArm({
      control,
      elo: { home: 0.45, draw: 0.25, away: 0.3 },
      arm: "M0",
    });
    expect(m0.grid.draw).toBeCloseTo(control.draw, 12);
    expect(m0.grid.p22).toBeCloseTo(control.p22, 12);
    const sum0 = m0.grid.cells.reduce((sum, line) => sum + line.reduce((inner, value) => inner + value, 0), 0);
    expect(sum0).toBeCloseTo(1, 12);
    expect(m0.hybrid.home + m0.hybrid.draw + m0.hybrid.away).toBeCloseTo(1, 12);

    const m1 = applyHighEqualMultiplier(control, 1.1);
    const m2 = applyHighEqualMultiplier(control, 1.25);
    const m3 = applyHighEqualMultiplier(control, 1.5);
    const grid1 = summarizeCells(m1.cells);
    expect(grid1.p22 / (control.p22 * m1.indirectScale)).toBeCloseTo(1.1, 10);
    expect(grid1.p00).toBeLessThan(control.p00);
    expect(grid1.p11).toBeLessThan(control.p11);
    expect(summarizeCells(m2.cells).p22).toBeGreaterThan(grid1.p22);
    expect(summarizeCells(m3.cells).p22).toBeGreaterThan(summarizeCells(m2.cells).p22);

    const transfer = applyHighEqualTransfer(control);
    const gridT = summarizeCells(transfer.cells);
    expect(gridT.p00).toBeCloseTo(control.p00 * transfer.indirectScale, 12);
    expect(gridT.p11).toBeCloseTo(control.p11 * transfer.indirectScale, 12);
    const highControl = control.p22 + control.p33 + control.p44 + control.p55plus;
    const highT = gridT.p22 + gridT.p33 + gridT.p44 + gridT.p55plus;
    expect(highT / transfer.indirectScale).toBeCloseTo(highControl * 1.1, 10);
    expect(gridT.oneXTwo.home + gridT.oneXTwo.draw + gridT.oneXTwo.away).toBeCloseTo(1, 12);
  });

  it("evaluates isolated arms with locked 5B.15 splits and no ranking", { timeout: 30000 }, () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = expandSeason("2024");
    const first = evaluateSeasonLocalMass({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    const second = evaluateSeasonLocalMass({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    expect(first.n).toBe(380);
    expect(first.failures).toEqual([]);
    expect(first.arms.map((row) => row.arm)).toEqual(["M0", "M1", "M2", "M3", "T1"]);
    expect(first.arms.every((row) => row.diagnosticOnly)).toBe(true);
    expect(JSON.stringify(first.arms)).toEqual(JSON.stringify(second.arms));
    expect(first.halves.H1.n).toBe(190);
    expect(first.halves.H2.n).toBe(190);
    expect(first.quartiles.Q1.n).toBe(95);
    const m0High = first.arms[0]!.scorelines.find((row) => row.key === "HIGH_EQUAL");
    const two = first.arms[0]!.scorelines.find((row) => row.key === "2-2");
    const three = first.arms[0]!.scorelines.find((row) => row.key === "3-3+");
    expect(m0High?.observedCount).toBe((two?.observedCount ?? 0) + (three?.observedCount ?? 0));
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);

    const d1dev = evaluateSeasonLocalMass({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D1",
    });
    const d1 = [
      { ...d1dev, season: "2023", role: "HOLDOUT" as const },
      d1dev,
      { ...d1dev, season: "2025", role: "HOLDOUT" as const },
    ];
    const holdout = poolHoldoutLocal(d1);
    expect(holdout.seasons).toEqual(["2023", "2025"]);
    expect(() =>
      poolHoldoutLocal([
        {
          ...first,
          season: "2024",
          role: "HOLDOUT",
          panel: "D1",
        },
      ]),
    ).toThrow(/exclude PL 2024/);
    const loso = leaveOneSeasonOutLocal(d1);
    expect(loso.filter((row) => row.arm === "M0")).toHaveLength(3);
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

    const sources = LM16_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/lambda3|dixonColes|fitMultiplier|searchGrid|1\.15|1\.35/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(500|600|800)/);
  });
});
