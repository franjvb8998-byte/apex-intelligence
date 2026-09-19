/**
 * Sprint 5B.7 — draw probability forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DECLARED_ELO_DRAW_BASE_GRID,
  DRAW_FORENSICS_CONFIG_IDS,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  PRODUCTION_DRAW_FORMULA_AUDIT,
  PRODUCTION_ELO_DRAW_BASE,
  classifyComponentAttribution,
  createSyntheticCalibrationRows,
  eloDrawBaseSensitivityValues,
  eloGapBucket,
  evaluateDrawForensicsConfigs,
  evaluateEloDrawBaseSensitivity,
  extractExtremeDrawMisses,
  FROZEN_VALIDATION_CONFIGS,
  MissingDrawForensicsArtifactError,
  requireLocalArtifact,
  scorelineGroup,
  totalXgBucket,
  xgDiffBucket,
} from "@/lib/debug/calibration";
import { loadDrawForensicsSeason } from "@/lib/debug/calibration/draw-5b7-dataset";
import { assertHoldoutsUntuned } from "@/lib/debug/calibration/draw-5b7-report";
import { frozenValidationConfig } from "@/lib/debug/calibration/validation-5b6-configs";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

function labeled(season: "2023" | "2024" | "2025", rows = createSyntheticCalibrationRows()): CalibrationRow[] {
  return rows.map((row, index) => ({
    ...row,
    fixtureId: `${season}-${index}-${row.fixtureId}`,
    competitionId: "39",
    competitionName: "Premier League",
    season,
  }));
}

function withScore(row: CalibrationRow, home: number, away: number): CalibrationRow {
  return {
    ...row,
    actualHomeGoals: home,
    actualAwayGoals: away,
    actualOutcome: home === away ? "draw" : home > away ? "home" : "away",
  };
}

const FORENSIC_FILES = [
  "lib/debug/calibration/draw-5b7-shape.ts",
  "lib/debug/calibration/draw-5b7-formula.ts",
  "lib/debug/calibration/draw-5b7-buckets.ts",
  "lib/debug/calibration/draw-5b7-trace.ts",
  "lib/debug/calibration/draw-5b7-evaluate.ts",
  "lib/debug/calibration/draw-5b7-sensitivity.ts",
  "lib/debug/calibration/draw-5b7-report.ts",
  "lib/debug/calibration/draw-5b7-dataset.ts",
];

describe("Sprint 5B.7 — draw forensics contract", () => {
  it("does not require network or API credentials on import", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APISPORTS_KEY).toBeUndefined();
    expect(process.env.API_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DRAW_FORENSICS_CONFIG_IDS).toEqual(["V0", "V5"]);
  });

  it("freezes V0/V5 and reads eloDrawBase from production config", () => {
    const v0 = frozenValidationConfig("V0");
    const v5 = frozenValidationConfig("V5");
    expect(v0.roleHomeElo).toBe(1580);
    expect(v0.roleAwayElo).toBe(1520);
    expect(v0.homeAdvantageElo).toBe(65);
    expect(v0.baseHomeGoals).toBe(1.45);
    expect(v0.baseAwayGoals).toBe(1.15);
    expect(v5.roleHomeElo).toBe(1550);
    expect(v5.roleAwayElo).toBe(1550);
    expect(v5.homeAdvantageElo).toBe(0);
    expect(v5.baseHomeGoals).toBe(1.3);
    expect(v5.baseAwayGoals).toBe(1.3);
    expect(DRAW_FORENSICS_CONFIG_IDS).toHaveLength(2);
    expect(FROZEN_VALIDATION_CONFIGS.map((config) => config.id)).toEqual([
      "V0",
      "V1",
      "V2",
      "V3",
      "V4",
      "V5",
    ]);
    expect(PRODUCTION_ELO_DRAW_BASE).toBe(DEFAULT_HYBRID_CONFIG.eloDrawBase);
    expect(PRODUCTION_DRAW_FORMULA_AUDIT.eloDrawBase.value).toBe(0.28);
    expect(PRODUCTION_DRAW_FORMULA_AUDIT.eloOneXTwo.drawMassChangesWithEloGap).toBe(true);
    expect(PRODUCTION_DRAW_FORMULA_AUDIT.blend.postBlendNormalization).toBe(true);
    expect(PRODUCTION_DRAW_FORMULA_AUDIT.confidence.changesProbabilities).toBe(false);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.poissonBlendWeight).toBe(0.7);
  });

  it("uses deterministic buckets, scorelines, and confidence grouping", () => {
    expect(eloGapBucket(0)).toBe("0-49");
    expect(eloGapBucket(49.9)).toBe("0-49");
    expect(eloGapBucket(50)).toBe("50-99");
    expect(eloGapBucket(99.9)).toBe("50-99");
    expect(eloGapBucket(100)).toBe("100-149");
    expect(eloGapBucket(150)).toBe("150-199");
    expect(eloGapBucket(200)).toBe("200-249");
    expect(eloGapBucket(249.9)).toBe("200-249");
    expect(eloGapBucket(250)).toBe("250+");
    expect(xgDiffBucket(0.249)).toBe("<0.25");
    expect(xgDiffBucket(0.25)).toBe("0.25-0.49");
    expect(xgDiffBucket(0.499)).toBe("0.25-0.49");
    expect(xgDiffBucket(0.5)).toBe("0.50-0.99");
    expect(xgDiffBucket(1)).toBe("1.00-1.49");
    expect(xgDiffBucket(1.5)).toBe("1.50+");
    expect(totalXgBucket(1.99)).toBe("<2.0");
    expect(totalXgBucket(2)).toBe("2.0-2.49");
    expect(totalXgBucket(2.5)).toBe("2.5-2.99");
    expect(totalXgBucket(3)).toBe("3.0-3.49");
    expect(totalXgBucket(3.5)).toBe("3.5+");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 0, actualAwayGoals: 0 })).toBe("0-0");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 1, actualAwayGoals: 1 })).toBe("1-1");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 2, actualAwayGoals: 2 })).toBe("2-2");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 3, actualAwayGoals: 3 })).toBe("3-3");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 4, actualAwayGoals: 4 })).toBe("4-4+");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 5, actualAwayGoals: 5 })).toBe("4-4+");
    expect(scorelineGroup({ actualOutcome: "draw", actualHomeGoals: 1, actualAwayGoals: 0 })).toBe("other_draw");
    expect(scorelineGroup({ actualOutcome: "home", actualHomeGoals: 1, actualAwayGoals: 0 })).toBe("non_draw");
  });

  it("keeps decomposition deterministic, finite, and N/season identity preserved", () => {
    const rows = labeled("2023");
    const a = evaluateDrawForensicsConfigs({ rows, season: "2023", role: "HOLDOUT" });
    const b = evaluateDrawForensicsConfigs({ rows, season: "2023", role: "HOLDOUT" });
    expect(a.V0.n).toBe(rows.length);
    expect(a.V5.n).toBe(rows.length);
    expect(a.V0.season).toBe("2023");
    expect(a.V0.role).toBe("HOLDOUT");
    expect(a.V0.decomposition.n).toBe(rows.length);
    expect(a.V0.decomposition).toEqual(b.V0.decomposition);
    expect(a.V5.decomposition).toEqual(b.V5.decomposition);
    for (const trace of [...a.V0.traces, ...a.V5.traces]) {
      const sum =
        trace.hybridOneXTwo.home + trace.hybridOneXTwo.draw + trace.hybridOneXTwo.away;
      expect(Number.isFinite(sum)).toBe(true);
      expect(sum).toBeCloseTo(1, 6);
      expect(trace.season).toBe("2023");
      expect(trace.poissonBlendWeight).toBe(DEFAULT_HYBRID_CONFIG.poissonBlendWeight);
    }
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
  });

  it("extracts extreme actual-draw misses deterministically", () => {
    const base = labeled("2025");
    const rows = [
      withScore(base[0]!, 1, 1),
      withScore(base[1]!, 0, 0),
      withScore(base[6]!, 2, 2),
    ];
    const evaluated = evaluateDrawForensicsConfigs({
      rows,
      season: "2025",
      role: "HOLDOUT",
    });
    const first = extractExtremeDrawMisses(evaluated.V0.traces, 10);
    const second = extractExtremeDrawMisses(evaluated.V0.traces, 10);
    expect(first).toEqual(second);
    expect(first.every((item) => item.actualScore.includes("-"))).toBe(true);
    expect(evaluated.V0.role).toBe("HOLDOUT");
  });

  it("dedupes the eloDrawBase grid, does not mutate production, and does not rank", () => {
    const values = eloDrawBaseSensitivityValues();
    expect(values).toEqual([...new Set(values)].sort((left, right) => left - right));
    expect(values).toContain(PRODUCTION_ELO_DRAW_BASE);
    for (const declared of DECLARED_ELO_DRAW_BASE_GRID) {
      expect(values).toContain(declared);
    }
    expect(values.filter((value) => value === PRODUCTION_ELO_DRAW_BASE)).toHaveLength(1);
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const cells = evaluateEloDrawBaseSensitivity({
      rows: labeled("2024"),
      season: "2024",
      role: "DEVELOPMENT",
      configId: "V0",
    });
    expect(cells.map((cell) => cell.eloDrawBase)).toEqual(values);
    expect(cells.filter((cell) => cell.isCurrent)).toHaveLength(1);
    expect(cells[0]?.n).toBe(labeled("2024").length);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    const sources = FORENSIC_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankConfigs|bestEloDrawBase|selectWinner|winnerScore|chooseBest/);
  });

  it("preserves DEVELOPMENT vs HOLDOUT labels and fails closed on missing artifacts", () => {
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(() =>
      assertHoldoutsUntuned({
        seasons: [{ season: "2023", role: "DEVELOPMENT" }],
      }),
    ).toThrow(/HOLDOUT/);
    expect(() =>
      assertHoldoutsUntuned({
        seasons: [{ season: "2024", role: "HOLDOUT" }],
      }),
    ).toThrow(/DEVELOPMENT/);
    expect(() => requireLocalArtifact("data/calibration/does-not-exist-5b7.json")).toThrow(
      MissingDrawForensicsArtifactError,
    );
    const holdout = loadDrawForensicsSeason("2023");
    expect(holdout.role).toBe("HOLDOUT");
    expect(holdout.season).toBe("2023");
    const development = loadDrawForensicsSeason("2024");
    expect(development.role).toBe("DEVELOPMENT");
    expect(development.season).toBe("2024");
    const holdout2025 = loadDrawForensicsSeason("2025");
    expect(holdout2025.role).toBe("HOLDOUT");
  });

  it("classifies components without a ranking helper and keeps attribution forensic", () => {
    const v0 = evaluateDrawForensicsConfigs({
      rows: labeled("2023"),
      season: "2023",
      role: "HOLDOUT",
    }).V0;
    const v5 = evaluateDrawForensicsConfigs({
      rows: labeled("2023"),
      season: "2023",
      role: "HOLDOUT",
    }).V5;
    const attribution = classifyComponentAttribution({ v0: [v0], v5: [v5] });
    expect(["YES", "NO", "MIXED"]).toContain(attribution.eloDrawComponent);
    expect(["YES", "NO"]).toContain(attribution.blendLowersRelativeToBothInputs);
    expect(Object.keys(attribution).sort()).toEqual(
      [
        "blendLowersRelativeToBothInputs",
        "confidence",
        "eloDrawComponent",
        "eloGap",
        "homeAdvantageStack",
        "poissonDrawComponent",
        "totalXg",
        "xgImbalance",
      ].sort(),
    );
  });
});

describe("Sprint 5B.7 — no live/odds surface", () => {
  it("does not import live transport, odds, or API credentials", () => {
    for (const file of FORENSIC_FILES) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
      expect(source).not.toMatch(/homeOdds|getFixtureOdds/);
    }
  });
});
