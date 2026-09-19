/**
 * Sprint 5B.9 — Elo→xG / lambda-ratio geometry forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DECLARED_ELO_DIFF_GRID,
  DECLARED_ELO_GOAL_SCALE_GRID,
  DECLARED_EXPONENT_GAPS,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  LAMBDA_RATIO_BUCKETS,
  PRODUCTION_ELO_XG_AUDIT,
  analyticEloGapGeometry,
  assertMirrorsProductionEloToExpectedGoals,
  clampCohortOf,
  createSyntheticCalibrationRows,
  debugClampLambda,
  eloGapBucket,
  eloToExpectedGoalsMirrored,
  eloToExpectedGoalsUnclamped,
  evaluateDenominatorSensitivity,
  evaluateGoalBaseVariants,
  evaluateSeasonLambdaGeometry,
  exponentMultiplier,
  extractTopBy,
  lambdaRatio,
  lambdaRatioBucket,
  loadDrawForensicsSeason,
  productionAnalyticClampThresholds,
  productionExponentMultipliers,
  totalXg,
} from "@/lib/debug/calibration";
import { productionEloXgInputs } from "@/lib/debug/calibration/xg-5b9-formula";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { eloToExpectedGoals } from "@/lib/intelligence/modules/probability/math/elo";
import { VALIDATION_NEUTRAL_GOAL_BASELINE } from "@/lib/debug/calibration/validation-5b6-configs";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

function labeled(season: "2023" | "2024" | "2025"): CalibrationRow[] {
  return createSyntheticCalibrationRows().map((row, index) => ({
    ...row,
    fixtureId: `${season}-${index}-${row.fixtureId}`,
    competitionId: "39",
    competitionName: "Premier League",
    season,
  }));
}

const XG_FILES = [
  "lib/debug/calibration/xg-5b9-shape.ts",
  "lib/debug/calibration/xg-5b9-formula.ts",
  "lib/debug/calibration/xg-5b9-geometry.ts",
  "lib/debug/calibration/xg-5b9-evaluate.ts",
  "lib/debug/calibration/xg-5b9-counterfactual.ts",
  "lib/debug/calibration/xg-5b9-report.ts",
];

describe("Sprint 5B.9 — Elo→xG geometry forensics contract", () => {
  it("requires no network or API credentials and leaves production Elo→xG frozen", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(PRODUCTION_ELO_XG_AUDIT.homeAdvantageElo.affectsLambda).toBe(false);
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect(DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage).toBe(1);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect([...DECLARED_ELO_GOAL_SCALE_GRID]).toEqual([300, 400, 500, 600]);
    expect([...DECLARED_EXPONENT_GAPS]).toEqual([50, 100, 150, 200, 250, 300, 350, 400]);
  });

  it("mirrors the production formula at gap 0, positive gap, and negative gap", () => {
    const bases = productionEloXgInputs();
    const equal = eloToExpectedGoalsMirrored({ ...bases, homeElo: 1500, awayElo: 1500 });
    expect(equal.rawEloDiff).toBe(0);
    expect(equal.lambdaHomeUnclamped).toBeCloseTo(1.45, 12);
    expect(equal.lambdaAwayUnclamped).toBeCloseTo(1.15, 12);
    expect(equal.lambdaHomeClamped).toBeCloseTo(1.45, 12);
    expect(equal.lambdaAwayClamped).toBeCloseTo(1.15, 12);

    const homeFav = eloToExpectedGoalsMirrored({ ...bases, homeElo: 1600, awayElo: 1500 });
    expect(homeFav.lambdaHomeUnclamped).toBeGreaterThan(1.45);
    expect(homeFav.lambdaAwayUnclamped).toBeLessThan(1.15);

    const awayFav = eloToExpectedGoalsMirrored({ ...bases, homeElo: 1400, awayElo: 1500 });
    expect(awayFav.lambdaHomeUnclamped).toBeLessThan(1.45);
    expect(awayFav.lambdaAwayUnclamped).toBeGreaterThan(1.15);

    assertMirrorsProductionEloToExpectedGoals({ homeElo: 1700, awayElo: 1400 });
    const production = eloToExpectedGoals({
      homeElo: 1700,
      awayElo: 1400,
      baseHomeGoals: 1.45,
      baseAwayGoals: 1.15,
      eloGoalScale: 400,
      homeGoalsAdvantage: 1,
    });
    expect(homeFav.multiplier).toBeCloseTo(10 ** (100 / 400), 12);
    expect(production.lambdaHome).toBe(debugClampLambda(production.lambdaHome));
  });

  it("detects clamps, leaves unclamped values unclamped, and keeps ratio/total xG deterministic", () => {
    const bases = productionEloXgInputs();
    const clamped = eloToExpectedGoalsMirrored({ ...bases, homeElo: 1900, awayElo: 1500 });
    expect(clamped.clampHomeMax).toBe(true);
    expect(clamped.lambdaHomeClamped).toBe(6);
    const unclamped = eloToExpectedGoalsUnclamped({ ...bases, homeElo: 1900, awayElo: 1500 });
    expect(unclamped.lambdaHomeUnclamped).toBeGreaterThan(6);
    expect(unclamped.lambdaHomeUnclamped).toBeCloseTo(1.45 * 10 ** (400 / 400), 12);
    expect(debugClampLambda(0.01)).toBe(0.05);
    expect(
      clampCohortOf({
        clampHomeMax: true,
        clampAwayMax: false,
        clampHomeMin: false,
        clampAwayMin: false,
      }),
    ).toBe("HOME_MAX_CLAMP");
    expect(
      clampCohortOf({
        clampHomeMax: true,
        clampAwayMax: false,
        clampHomeMin: false,
        clampAwayMin: true,
      }),
    ).toBe("MULTIPLE_CLAMP");
    expect(lambdaRatio(2, 1)).toBe(2);
    expect(totalXg(1.45, 1.15)).toBeCloseTo(2.6, 12);
    expect(lambdaRatioBucket(1.2)).toBe("1.00-1.49");
    expect(lambdaRatioBucket(12)).toBe("12.00+");
    expect([...LAMBDA_RATIO_BUCKETS]).toEqual([
      "1.00-1.49",
      "1.50-1.99",
      "2.00-2.99",
      "3.00-4.99",
      "5.00-7.99",
      "8.00-11.99",
      "12.00+",
    ]);
    expect(eloGapBucket(49.9)).toBe("0-49");
    expect(eloGapBucket(250)).toBe("250+");
  });

  it("builds a finite analytic table, exact G0/G1 bases, and the audited exponent grid", () => {
    const table = analyticEloGapGeometry();
    expect(table.map((row) => row.rawEloDiff)).toEqual([...DECLARED_ELO_DIFF_GRID]);
    for (const row of table) {
      const sum = row.hybrid.home + row.hybrid.draw + row.hybrid.away;
      expect(sum).toBeCloseTo(1, 12);
      expect(Number.isFinite(row.clampedLambdaHome)).toBe(true);
      expect(row.clampedLambdaHome).toBeGreaterThan(0);
    }
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect(VALIDATION_NEUTRAL_GOAL_BASELINE).toBe(1.3);
    expect(exponentMultiplier(400, 400)).toEqual({ gap: 400, multiplier: 10, reciprocal: 0.1 });
    expect(productionExponentMultipliers()).toHaveLength(8);
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    const thresholds = productionAnalyticClampThresholds();
    expect(thresholds.homeMax).toBeCloseTo(400 * Math.log10(6 / 1.45), 12);
  });

  it("preserves N, season roles, actual-draw extraction, extreme-row order, and does not mutate production", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2023");
    const geometry = evaluateSeasonLambdaGeometry({
      rows,
      season: "2023",
      role: "HOLDOUT",
    });
    expect(geometry.n).toBe(rows.length);
    expect(geometry.role).toBe("HOLDOUT");
    expect(geometry.actualDraws.nDraws + geometry.actualDraws.nNonDraws).toBe(rows.length);
    const tops = extractTopBy(
      [
        {
          fixtureId: "b",
          season: "2023",
          role: "HOLDOUT",
          kickoff: "2023-01-01T00:00:00.000Z",
          homeTeamName: "A",
          awayTeamName: "B",
          actualOutcome: "home",
          actualHomeGoals: 1,
          actualAwayGoals: 0,
          homeElo: 1600,
          awayElo: 1500,
          rawEloDiff: 100,
          absEloGap: 100,
          lambdaHome: 2,
          lambdaAway: 1,
          lambdaHomeUnclamped: 2,
          lambdaAwayUnclamped: 1,
          ratio: 2,
          totalXg: 3,
          poissonOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          eloOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          hybridOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          confidence: 0.5,
          clampCohort: "NO_CLAMP",
        },
        {
          fixtureId: "a",
          season: "2023",
          role: "HOLDOUT",
          kickoff: "2023-01-01T00:00:00.000Z",
          homeTeamName: "C",
          awayTeamName: "D",
          actualOutcome: "draw",
          actualHomeGoals: 1,
          actualAwayGoals: 1,
          homeElo: 1600,
          awayElo: 1500,
          rawEloDiff: 100,
          absEloGap: 100,
          lambdaHome: 2,
          lambdaAway: 1,
          lambdaHomeUnclamped: 2,
          lambdaAwayUnclamped: 1,
          ratio: 2,
          totalXg: 3,
          poissonOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          eloOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          hybridOneXTwo: { home: 0.5, draw: 0.25, away: 0.25 },
          confidence: 0.5,
          clampCohort: "NO_CLAMP",
        },
      ],
      (snapshot) => snapshot.ratio,
    );
    expect(tops.map((row) => row.fixtureId)).toEqual(["a", "b"]);
    const goals = evaluateGoalBaseVariants({
      rows: labeled("2024"),
      season: "2024",
      role: "DEVELOPMENT",
    });
    expect(goals.G0.baseHomeGoals).toBe(1.45);
    expect(goals.G1.baseHomeGoals).toBe(1.3);
    const denom = evaluateDenominatorSensitivity({
      rows: labeled("2024"),
      season: "2024",
      role: "DEVELOPMENT",
    });
    expect(denom.map((cell) => cell.eloGoalScale)).toEqual([300, 400, 500, 600]);
    expect(denom.find((cell) => cell.eloGoalScale === 400)?.isCurrent).toBe(true);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").role).toBe("HOLDOUT");
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
    expect(loadDrawForensicsSeason("2025").role).toBe("HOLDOUT");
  });

  it("has no ranking helper, odds path, or live transport in geometry modules", () => {
    const sources = XG_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankDenom|bestScale|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
  });
});
