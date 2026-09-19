/**
 * Sprint 5B.8 — low-score dependence / Dixon-Coles forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DECLARED_DIXON_COLES_RHO_GRID,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  PRODUCTION_POISSON_AUDIT,
  assertValidDixonColesTau,
  createSyntheticCalibrationRows,
  dixonColesTau,
  eloGapBucket,
  evaluateDixonColesSensitivity,
  evaluateSeasonPoissonForensics,
  independentPoissonGrid,
  loadDrawForensicsSeason,
  observedScorelineKey,
  xgDiffBucket,
} from "@/lib/debug/calibration";
import {
  DixonColesInvalidError,
  buildScoreGrid,
} from "@/lib/debug/calibration/dc-5b8-dixon-coles";
import { classifyDcForensics } from "@/lib/debug/calibration/dc-5b8-report";
import { PRODUCTION_LAMBDA_CLAMP_MAX } from "@/lib/debug/calibration/dc-5b8-shape";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import { scorelineProbability } from "@/lib/intelligence/modules/probability/math/poisson";
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

const DC_FILES = [
  "lib/debug/calibration/dc-5b8-shape.ts",
  "lib/debug/calibration/dc-5b8-formula.ts",
  "lib/debug/calibration/dc-5b8-dixon-coles.ts",
  "lib/debug/calibration/dc-5b8-evaluate.ts",
  "lib/debug/calibration/dc-5b8-sensitivity.ts",
  "lib/debug/calibration/dc-5b8-report.ts",
];

describe("Sprint 5B.8 — Dixon-Coles forensics contract", () => {
  it("requires no network or API credentials and leaves production Poisson frozen", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(PRODUCTION_POISSON_AUDIT.dependenceCurrentlyExists).toBe(false);
    expect(PRODUCTION_POISSON_AUDIT.dixonColes.productionImplementation).toBe(false);
    expect(DEFAULT_HYBRID_CONFIG.maxGoals).toBe(15);
    expect(PRODUCTION_LAMBDA_CLAMP_MAX).toBe(6);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect([...DECLARED_DIXON_COLES_RHO_GRID]).toEqual([
      -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2,
    ]);
  });

  it("uses the standard tau formula and tau=1 elsewhere; rho=0 is independent Poisson", () => {
    expect(dixonColesTau(0, 0, 1.4, 1.1, 0.1)).toBeCloseTo(1 - 1.4 * 1.1 * 0.1, 12);
    expect(dixonColesTau(0, 1, 1.4, 1.1, 0.1)).toBeCloseTo(1 + 1.4 * 0.1, 12);
    expect(dixonColesTau(1, 0, 1.4, 1.1, 0.1)).toBeCloseTo(1 + 1.1 * 0.1, 12);
    expect(dixonColesTau(1, 1, 1.4, 1.1, 0.1)).toBeCloseTo(0.9, 12);
    expect(dixonColesTau(2, 2, 1.4, 1.1, 0.1)).toBe(1);
    expect(dixonColesTau(3, 0, 1.4, 1.1, -0.2)).toBe(1);
    expect(assertValidDixonColesTau({ homeGoals: 0, awayGoals: 0, lambdaHome: 1.2, lambdaAway: 1.1, rho: 0 })).toBe(1);

    const independent = independentPoissonGrid({ lambdaHome: 1.45, lambdaAway: 1.15, maxGoals: 15 });
    const rho0 = buildScoreGrid({ lambdaHome: 1.45, lambdaAway: 1.15, maxGoals: 15, rho: 0 });
    const production = marginalizePoissonScoreGrid({
      lambdaHome: 1.45,
      lambdaAway: 1.15,
      maxGoals: 15,
    });
    expect(rho0.ok).toBe(true);
    if (!rho0.ok) throw new Error("rho=0 must succeed");
    expect(rho0.oneXTwo.draw).toBeCloseTo(independent.oneXTwo.draw, 12);
    expect(rho0.oneXTwo.home).toBeCloseTo(production.oneXTwo.home, 12);
    expect(rho0.oneXTwo.draw).toBeCloseTo(production.oneXTwo.draw, 12);
    expect(rho0.oneXTwo.away).toBeCloseTo(production.oneXTwo.away, 12);
    expect(rho0.coveredMass).toBeCloseTo(production.coveredMass, 12);
  });

  it("normalizes the corrected matrix, keeps probabilities finite, and fails visibly on invalid tau", () => {
    const ok = buildScoreGrid({ lambdaHome: 1.2, lambdaAway: 1.1, maxGoals: 15, rho: -0.1 });
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error("expected valid rho");
    const sum = ok.oneXTwo.home + ok.oneXTwo.draw + ok.oneXTwo.away;
    expect(sum).toBeCloseTo(1, 12);
    expect(ok.oneXTwo.home).toBeGreaterThanOrEqual(0);
    expect(ok.scorelines["0-0"]).toBeGreaterThanOrEqual(0);
    const partsSum =
      ok.drawParts["0-0"] +
      ok.drawParts["1-1"] +
      ok.drawParts["2-2"] +
      ok.drawParts["3-3"] +
      ok.drawParts["4-4+"];
    expect(partsSum).toBeCloseTo(ok.oneXTwo.draw, 12);

    expect(() =>
      assertValidDixonColesTau({
        homeGoals: 0,
        awayGoals: 0,
        lambdaHome: 6,
        lambdaAway: 6,
        rho: 0.2,
      }),
    ).toThrow(DixonColesInvalidError);
    const invalid = buildScoreGrid({
      lambdaHome: 6,
      lambdaAway: 6,
      maxGoals: 15,
      rho: 0.2,
      fixtureId: "clamp-row",
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("expected invalid");
    expect(invalid.failure.reason).toMatch(/negative/);
    expect(invalid.failure.fixtureId).toBe("clamp-row");
  });

  it("keeps gap/xG buckets, clamp detection, coveredMass, and scoreline grouping deterministic", () => {
    expect(eloGapBucket(49.9)).toBe("0-49");
    expect(eloGapBucket(250)).toBe("250+");
    expect(xgDiffBucket(0.249)).toBe("<0.25");
    expect(xgDiffBucket(1.5)).toBe("1.50+");
    expect(observedScorelineKey(0, 0)).toBe("0-0");
    expect(observedScorelineKey(1, 0)).toBe("1-0");
    expect(observedScorelineKey(4, 4)).toBe("3-3+");
    expect(observedScorelineKey(3, 1)).toBe("other");
    const p00 = scorelineProbability(0, 0, 1.45, 1.15);
    expect(p00).toBeGreaterThan(0);
    const grid = independentPoissonGrid({ lambdaHome: 1.45, lambdaAway: 1.15, maxGoals: 15 });
    expect(grid.coveredMass).toBeGreaterThan(0.99);
    expect(grid.coveredMass).toBeLessThanOrEqual(1);
  });

  it("preserves N, season roles, and does not mutate production during evaluation", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2023");
    const v0 = evaluateSeasonPoissonForensics({
      rows,
      season: "2023",
      role: "HOLDOUT",
      configId: "V0",
    });
    expect(v0.n).toBe(rows.length);
    expect(v0.role).toBe("HOLDOUT");
    expect(v0.season).toBe("2023");
    expect(v0.drawDecomposition.partsSumToPredictedDraw).toBeCloseTo(
      v0.drawDecomposition.predictedDraw,
      12,
    );
    const scoreCount = v0.scorelines.reduce((sum, row) => sum + row.observedCount, 0);
    expect(scoreCount).toBe(rows.length);
    const cells = evaluateDixonColesSensitivity({
      rows: labeled("2024"),
      season: "2024",
      role: "DEVELOPMENT",
      configId: "V0",
    });
    expect(cells.map((cell) => cell.rho)).toEqual([...DECLARED_DIXON_COLES_RHO_GRID]);
    const rho0 = cells.find((cell) => cell.rho === 0)!;
    expect(rho0.valid).toBe(true);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").role).toBe("HOLDOUT");
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
    expect(loadDrawForensicsSeason("2025").role).toBe("HOLDOUT");
    const attribution = classifyDcForensics({
      seasons: [{ season: "2023", role: "HOLDOUT", v0, sensitivityV0: cells }],
    });
    expect(["YES", "NO", "MIXED"]).toContain(attribution.lowScoreDependence);
    expect(attribution.truncation === "YES" || attribution.truncation === "NO").toBe(true);
  });

  it("has no ranking helper, odds path, or live transport in DC modules", () => {
    const sources = DC_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankRho|bestRho|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
  });
});
