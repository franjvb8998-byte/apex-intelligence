/**
 * Sprint 5B.10 — catalogue Elo input / gap-generation forensics.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_CONSTANT_OFFSET,
  CATALOGUE_ELO_GAP_BUCKETS,
  CATALOGUE_GD_CLAMP,
  CATALOGUE_GD_COEFFICIENT,
  CATALOGUE_WIN_RATE_COEFFICIENT,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  PLAYED_BEFORE_BUCKETS,
  PRODUCTION_CATALOGUE_ELO_AUDIT,
  R0_AWAY_BASE,
  R0_HOME_BASE,
  R1_EQUAL_BASE,
  assertComponentSum,
  assertMirrorsProductionCatalogue,
  catalogueEloFromParts,
  catalogueEloGapBucket,
  createSyntheticCalibrationRows,
  decomposeMatchGap,
  evaluateRoleBaseCounterfactual,
  evaluateSeasonCatalogueGeometry,
  loadDrawForensicsSeason,
  playedBeforeBucket,
  sparseWinRateSynthetics,
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

const CAT_FILES = [
  "lib/debug/calibration/cat-5b10-shape.ts",
  "lib/debug/calibration/cat-5b10-formula.ts",
  "lib/debug/calibration/cat-5b10-evaluate.ts",
  "lib/debug/calibration/cat-5b10-counterfactual.ts",
  "lib/debug/calibration/cat-5b10-maturity.ts",
  "lib/debug/calibration/cat-5b10-report.ts",
];

describe("Sprint 5B.10 — catalogue Elo input forensics contract", () => {
  it("requires no network or API credentials and leaves production catalogue Elo frozen", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(PRODUCTION_CATALOGUE_ELO_AUDIT.playedPositiveFormula.constantOffset).toBe(-80);
    expect(CATALOGUE_CONSTANT_OFFSET).toBe(-80);
    expect(CATALOGUE_WIN_RATE_COEFFICIENT).toBe(220);
    expect(CATALOGUE_GD_COEFFICIENT).toBe(2.5);
    expect(CATALOGUE_GD_CLAMP).toBe(30);
    expect(R0_HOME_BASE).toBe(1580);
    expect(R0_AWAY_BASE).toBe(1520);
    expect(R1_EQUAL_BASE).toBe(1550);
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
  });

  it("mirrors current_catalogue exactly for played=0, 1/1, 0/1, and cumulative GD clamps", () => {
    const zero = catalogueEloFromParts({
      base: 1580,
      played: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      teamId: "any",
    });
    expect(zero.source).toBe("base_prior");
    expect(zero.finalCatalogueElo).toBe(1580);
    expect(zero.constantContribution).toBe(0);
    assertComponentSum(zero);
    assertMirrorsProductionCatalogue({
      teamId: "any",
      base: 1580,
      played: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });

    const win11 = catalogueEloFromParts({
      base: 1580,
      played: 1,
      wins: 1,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    expect(win11.finalCatalogueElo).toBe(Math.round(1580 - 80 + 220));
    expect(win11.constantContribution).toBe(-80);

    const lose01 = catalogueEloFromParts({
      base: 1580,
      played: 1,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    expect(lose01.finalCatalogueElo).toBe(1500);

    const plus = catalogueEloFromParts({
      base: 1580,
      played: 10,
      wins: 10,
      goalsFor: 50,
      goalsAgainst: 0,
    });
    expect(plus.clampedGd).toBe(30);
    expect(plus.gdContribution).toBe(75);
    const minus = catalogueEloFromParts({
      base: 1520,
      played: 10,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 50,
    });
    expect(minus.clampedGd).toBe(-30);
    expect(minus.gdContribution).toBe(-75);
    assertMirrorsProductionCatalogue({
      teamId: "t",
      base: 1580,
      played: 2,
      wins: 1,
      goalsFor: 4,
      goalsAgainst: 1,
    });
  });

  it("decomposes components and raw gaps exactly, including constant cancellation and role-prior gap", () => {
    const home = catalogueEloFromParts({
      base: 1580,
      played: 4,
      wins: 2,
      goalsFor: 6,
      goalsAgainst: 4,
    });
    const away = catalogueEloFromParts({
      base: 1520,
      played: 4,
      wins: 2,
      goalsFor: 6,
      goalsAgainst: 4,
    });
    assertComponentSum(home);
    assertComponentSum(away);
    const gap = decomposeMatchGap(home, away);
    expect(gap.rolePriorGap).toBe(60);
    expect(gap.constantGap).toBe(0);
    expect(gap.winRateGap).toBeCloseTo(0, 12);
    expect(gap.gdGap).toBeCloseTo(0, 12);
    expect(gap.rawGap).toBe(home.finalCatalogueElo - away.finalCatalogueElo);
    expect(playedBeforeBucket(0)).toBe("0");
    expect(playedBeforeBucket(4)).toBe("4-5");
    expect(playedBeforeBucket(30)).toBe("30+");
    expect(catalogueEloGapBucket(249)).toBe("200-249");
    expect(catalogueEloGapBucket(250)).toBe("250-299");
    expect(catalogueEloGapBucket(300)).toBe("300+");
    expect([...PLAYED_BEFORE_BUCKETS]).toHaveLength(10);
    expect([...CATALOGUE_ELO_GAP_BUCKETS]).toEqual([
      "0-49",
      "50-99",
      "100-149",
      "150-199",
      "200-249",
      "250-299",
      "300+",
    ]);
    const sparse = sparseWinRateSynthetics();
    expect(sparse.find((row) => row.played === 1 && row.wins === 1)?.homeElo).toBe(1720);
    expect(sparse.find((row) => row.played === 1 && row.wins === 0)?.homeElo).toBe(1500);
  });

  it("keeps R0/R1 isolated, preserves leakage, and uses frozen production geometry for the bridge", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2024");
    const roles = evaluateRoleBaseCounterfactual({ rows });
    expect(roles.R0.homeBase).toBe(1580);
    expect(roles.R1.homeBase).toBe(1550);
    expect(roles.R1.awayBase).toBe(1550);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);

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
    const record = reconstructTeamRecord({
      teamId: "t1",
      kickoff: "2024-08-10T15:00:00.000Z",
      competitionId: "39",
      season: "2024",
      fixtures: sameKickoff,
    });
    expect(record.played).toBe(0);

    const geometry = evaluateSeasonCatalogueGeometry({
      rows: labeled("2023"),
      season: "2023",
      role: "HOLDOUT",
    });
    expect(geometry.report.nMatches).toBe(labeled("2023").length);
    expect(geometry.report.failures).toEqual([]);
    const first = geometry.matches[0]!;
    const production = eloToExpectedGoals({
      homeElo: first.home.finalCatalogueElo,
      awayElo: first.away.finalCatalogueElo,
      baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
      baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
      eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
      homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    });
    expect(first.lambdaHome).toBe(production.lambdaHome);
    expect(first.lambdaAway).toBe(production.lambdaAway);
    const sum = first.hybrid.home + first.hybrid.draw + first.hybrid.away;
    expect(sum).toBeCloseTo(1, 12);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").role).toBe("HOLDOUT");
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
    expect(loadDrawForensicsSeason("2025").role).toBe("HOLDOUT");
  });

  it("has no ranking helper, odds path, or live transport in catalogue-input modules", () => {
    const sources = CAT_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestShrinkage|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
  });
});
