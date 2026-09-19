/**
 * Sprint 5B.15 — HIGH_EQUAL temporal robustness.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  HALF_SIZE,
  HIGH_EQUAL_OE_THRESHOLD,
  QUARTILE_SIZE,
  SEASON_N,
  TR_BOOTSTRAP_RESAMPLES,
  TR_BOOTSTRAP_SEED,
  TR_PANELS,
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  bootstrapHighEqual,
  bootstrapResidual,
  compareChronological,
  createSyntheticCalibrationRows,
  evaluateSeasonTemporal,
  isHighEqual,
  isHighEqualTrace,
  isLowEqual,
  isLowEqualTrace,
  leaveOneSeasonOut,
  loadDrawForensicsSeason,
  panelDrawElos,
  panelMatchElos,
  resolveMatchElos,
  sortChronological,
  splitHalves,
  splitQuartiles,
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

const TR15_FILES = [
  "lib/debug/calibration/tr-5b15-shape.ts",
  "lib/debug/calibration/tr-5b15-formula.ts",
  "lib/debug/calibration/tr-5b15-evaluate.ts",
  "lib/debug/calibration/tr-5b15-report.ts",
];

describe("Sprint 5B.15 — HIGH_EQUAL temporal robustness", () => {
  it("requires no network or credentials and freezes production", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect([...TR_PANELS]).toEqual(["D0", "D1"]);
    expect(SEASON_N).toBe(380);
    expect(HALF_SIZE).toBe(190);
    expect(QUARTILE_SIZE).toBe(95);
    expect(TR_BOOTSTRAP_SEED).toBe(5152026);
    expect(TR_BOOTSTRAP_RESAMPLES).toBe(2000);
    expect(HIGH_EQUAL_OE_THRESHOLD).toBe(1.1);
    expect(isLowEqual(0, 0)).toBe(true);
    expect(isLowEqual(1, 1)).toBe(true);
    expect(isHighEqual(2, 2)).toBe(true);
    expect(isHighEqual(3, 3)).toBe(true);
    expect(isHighEqual(1, 1)).toBe(false);
  });

  it("keeps D0/D1 exact and splits seasons deterministically", () => {
    expandSeason("2024").slice(0, 8).forEach(assertD0MirrorsProduction);
    expandSeason("2024").slice(0, 8).forEach(assertD1MirrorsP7G0);
    const row = expandSeason("2024")[1]!;
    expect(panelDrawElos("D0", row)).toEqual(resolveMatchElos("C0", row));
    expect(panelDrawElos("D0", row)).toEqual(panelMatchElos("P0", row));
    expect(panelDrawElos("D1", row)).toEqual(resolveMatchElos("C7", row));
    expect(panelDrawElos("D1", row)).toEqual(panelMatchElos("P7", row));

    const items = [
      { kickoff: "2024-08-10T15:00:00.000Z", fixtureId: "b" },
      { kickoff: "2024-08-10T15:00:00.000Z", fixtureId: "a" },
      { kickoff: "2024-08-10T14:00:00.000Z", fixtureId: "z" },
    ];
    const first = sortChronological(items);
    const second = sortChronological(items);
    expect(first.map((item) => item.fixtureId)).toEqual(["z", "a", "b"]);
    expect(first).toEqual(second);
    expect(compareChronological(items[0]!, items[1]!)).toBeGreaterThan(0);

    const rows = expandSeason("2024");
    expect(rows).toHaveLength(380);
    const sorted = sortChronological(rows);
    const halves = splitHalves(sorted);
    const quartiles = splitQuartiles(sorted);
    expect(halves.H1).toHaveLength(190);
    expect(halves.H2).toHaveLength(190);
    expect(quartiles.Q1).toHaveLength(95);
    expect(quartiles.Q2).toHaveLength(95);
    expect(quartiles.Q3).toHaveLength(95);
    expect(quartiles.Q4).toHaveLength(95);
    expect([...halves.H1, ...halves.H2].map((item) => item.fixtureId)).toEqual(
      sorted.map((item) => item.fixtureId),
    );
    expect(() => splitHalves(sorted.slice(0, 379))).toThrow(/380/);
  });

  it("evaluates isolated windows with deterministic bootstrap and leave-one-season-out", { timeout: 30000 }, () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows2024 = expandSeason("2024");
    const first = evaluateSeasonTemporal({
      rows: rows2024,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    const second = evaluateSeasonTemporal({
      rows: rows2024,
      season: "2024",
      role: "DEVELOPMENT",
      panel: "D0",
    });
    expect(first.n).toBe(380);
    expect(first.failures).toEqual([]);
    expect(first.role).toBe("DEVELOPMENT");
    expect(first.halves.H1.n).toBe(190);
    expect(first.halves.H2.n).toBe(190);
    expect(first.quartiles.Q1.n).toBe(95);
    expect(JSON.stringify(first.halves)).toEqual(JSON.stringify(second.halves));
    expect(first.halves.H1.highEqualBootstrap.seed).toBe(5152026);
    expect(first.halves.H1.highEqualBootstrap.resamples).toBe(2000);
    expect(first.halves.H1.residual.seed).toBe(5152026);
    expect(first.halves.H1.residual.resamples).toBe(2000);
    expect(first.halves.H1.highEqual.key).toBe("HIGH_EQUAL");
    expect(first.halves.H1.lowEqual.key).toBe("LOW_EQUAL");
    const highObs =
      first.halves.H1.twoTwo.observedCount +
      first.halves.H1.threeThree.observedCount +
      first.halves.H1.fourPlus.observedCount;
    expect(first.halves.H1.highEqual.observedCount).toBe(highObs);
    const highExp =
      first.halves.H1.twoTwo.expectedCount +
      first.halves.H1.threeThree.expectedCount +
      first.halves.H1.fourPlus.expectedCount;
    expect(first.halves.H1.highEqual.expectedCount).toBeCloseTo(highExp, 12);
    if (first.halves.H1.highEqual.expectedCount > 0) {
      expect(first.halves.H1.highEqual.oeRatio).toBeCloseTo(
        first.halves.H1.highEqual.observedCount / first.halves.H1.highEqual.expectedCount,
        12,
      );
    }
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);

    const d1 = ["2023", "2024", "2025"].map((season) =>
      evaluateSeasonTemporal({
        rows: expandSeason(season as "2023" | "2024" | "2025"),
        season,
        role: season === "2024" ? "DEVELOPMENT" : "HOLDOUT",
        panel: "D1",
      }),
    );
    const loso = leaveOneSeasonOut(d1);
    expect(loso).toHaveLength(3);
    expect(loso.map((row) => row.excluded).sort()).toEqual(["2023", "2024", "2025"]);
    expect(loso.every((row) => row.n === 760)).toBe(true);
    expect(() => leaveOneSeasonOut([first])).toThrow(/D1 only/);
    expect(() =>
      evaluateSeasonTemporal({
        rows: rows2024,
        season: "2024",
        role: "HOLDOUT",
        panel: "D0",
      }),
    ).toThrow(/DEVELOPMENT/);

    const boot = bootstrapHighEqual({ traces: [] });
    expect(boot.seed).toBe(5152026);
    expect(() => bootstrapHighEqual({ traces: [], seed: 1 })).toThrow(/seed/);
    expect(() => bootstrapResidual({ traces: [], resamples: 100 })).toThrow(/resamples/);
    expect(isHighEqualTrace).toBeTypeOf("function");
    expect(isLowEqualTrace).toBeTypeOf("function");
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").n).toBe(380);
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
  });

  it("preserves leakage and has no live/odds/fit/ranking helpers", () => {
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

    const sources = TR15_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/lambda3|dixonColes|DECLARED_DC|fitLambda|searchGrid/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(500|600|800)/);
    expect(sources).not.toMatch(/eloDrawBase:\s*0\.31/);
  });
});
