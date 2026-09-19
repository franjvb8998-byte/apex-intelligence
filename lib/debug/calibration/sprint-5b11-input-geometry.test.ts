/**
 * Sprint 5B.11 — catalogue input-geometry counterfactuals.
 * Offline synthetic + local artifacts. Zero live origin calls.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  GD_RATE_CLAMP,
  GD_RATE_COEFFICIENT,
  INPUT_GEOMETRY_ARMS,
  INPUT_GEOMETRY_EVIDENCE_SCOPES,
  INPUT_GEOMETRY_SHRINKAGE_K,
  NON_CANDIDATE_GD_RATE_LABEL,
  PE_HOME_ADVANTAGE_REMAINS,
  applyShrinkage,
  armSpec,
  assertC0MirrorsCurrentCatalogue,
  assertC1OnlyEqualizesRoleBases,
  catalogueEloGapBucket,
  createSyntheticCalibrationRows,
  evaluateSeasonInputGeometry,
  gdRateContribution,
  loadDrawForensicsSeason,
  poolHoldoutOnly,
  resolveInputGeometryElo,
  resolveMatchElos,
  unroundedCatalogueTarget,
} from "@/lib/debug/calibration";
import { reconstructTeamRecord } from "@/lib/debug/calibration/reconstruct";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
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

const IG_FILES = [
  "lib/debug/calibration/ig-5b11-shape.ts",
  "lib/debug/calibration/ig-5b11-formula.ts",
  "lib/debug/calibration/ig-5b11-evaluate.ts",
  "lib/debug/calibration/ig-5b11-report.ts",
];

describe("Sprint 5B.11 — catalogue input-geometry counterfactuals", () => {
  it("requires no network or API credentials and leaves production frozen", () => {
    expect(process.env.API_FOOTBALL_KEY).toBeUndefined();
    expect(process.env.APEX_CALIBRATION_LIVE).toBeUndefined();
    expect(DEFAULT_HYBRID_CONFIG.eloGoalScale).toBe(400);
    expect(DEFAULT_HYBRID_CONFIG.eloDrawBase).toBe(0.28);
    expect(DEFAULT_HYBRID_CONFIG.homeAdvantageElo).toBe(65);
    expect(DEFAULT_HYBRID_CONFIG.baseHomeGoals).toBe(1.45);
    expect(DEFAULT_HYBRID_CONFIG.baseAwayGoals).toBe(1.15);
    expect(PE_HOME_ADVANTAGE_REMAINS).toBe(65);
    expect(INPUT_GEOMETRY_SHRINKAGE_K).toBe(8);
    expect([...INPUT_GEOMETRY_ARMS]).toEqual(["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7"]);
    expect([...INPUT_GEOMETRY_EVIDENCE_SCOPES]).toEqual(["all", "0", "1-3", "4-9", "10+"]);
    expect(catalogueEloGapBucket(249)).toBe("200-249");
    expect(catalogueEloGapBucket(300)).toBe("300+");
  });

  it("mirrors C0/C1/C2/C3 exactly and keeps C4–C7 as labeled diagnostics", () => {
    const parts = { played: 8, wins: 8, goalsFor: 0, goalsAgainst: 0 };
    labeled("2024").forEach(assertC0MirrorsCurrentCatalogue);
    assertC1OnlyEqualizesRoleBases({ played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0 });
    assertC1OnlyEqualizesRoleBases(parts);

    const c2Home = resolveInputGeometryElo({ armId: "C2", side: "home", ...parts });
    const rawC2 = unroundedCatalogueTarget({
      base: 1580,
      ...parts,
      gdMode: "cumulative",
    });
    expect(rawC2).toBe(1720);
    expect(c2Home).toBe(applyShrinkage({ base: 1580, played: 8, raw: rawC2, shrinkage: true }));
    expect(c2Home).toBe(1650);

    const c3Home = resolveInputGeometryElo({ armId: "C3", side: "home", ...parts });
    expect(c3Home).toBe(
      applyShrinkage({
        base: 1550,
        played: 8,
        raw: unroundedCatalogueTarget({ base: 1550, ...parts, gdMode: "cumulative" }),
        shrinkage: true,
      }),
    );

    expect(gdRateContribution(30, 0, 10)).toBe(75);
    expect(gdRateContribution(0, 30, 10)).toBe(-75);
    expect(gdRateContribution(40, 0, 10)).toBe(75);
    expect(GD_RATE_CLAMP).toBe(3);
    expect(GD_RATE_COEFFICIENT).toBe(25);
    expect(armSpec("C4").label).toBe(NON_CANDIDATE_GD_RATE_LABEL);
    expect(armSpec("C4").nonCandidate).toBe(true);
    expect(armSpec("C5").nonCandidate).toBe(true);
    expect(armSpec("C6").nonCandidate).toBe(true);
    expect(armSpec("C7").nonCandidate).toBe(true);
    expect(armSpec("C4").changes).toEqual(["gd_rate_diagnostic"]);
    expect(armSpec("C5").homeBase).toBe(1550);
    expect(armSpec("C5").gdMode).toBe("rate");
    expect(armSpec("C6").shrinkage).toBe(true);
    expect(armSpec("C6").gdMode).toBe("rate");
    expect(armSpec("C7").changes).toEqual([
      "equal_role_bases",
      "sample_shrinkage_k8",
      "gd_rate_diagnostic",
    ]);

    const c4 = resolveInputGeometryElo({
      armId: "C4",
      side: "home",
      played: 10,
      wins: 10,
      goalsFor: 40,
      goalsAgainst: 0,
    });
    const c4Raw = unroundedCatalogueTarget({
      base: 1580,
      played: 10,
      wins: 10,
      goalsFor: 40,
      goalsAgainst: 0,
      gdMode: "rate",
    });
    expect(c4).toBe(Math.round(c4Raw));
    expect(c4Raw).toBe(1580 - 80 + 220 + 75);

    const c7 = resolveInputGeometryElo({
      armId: "C7",
      side: "home",
      played: 8,
      wins: 8,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    expect(c7).toBe(
      applyShrinkage({
        base: 1550,
        played: 8,
        raw: unroundedCatalogueTarget({
          base: 1550,
          played: 8,
          wins: 8,
          goalsFor: 0,
          goalsAgainst: 0,
          gdMode: "rate",
        }),
        shrinkage: true,
      }),
    );
  });

  it("evaluates isolated engines without mutating production or ranking arms", () => {
    const before = { ...DEFAULT_HYBRID_CONFIG };
    const rows = labeled("2024");
    const first = evaluateSeasonInputGeometry({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
    });
    const second = evaluateSeasonInputGeometry({
      rows,
      season: "2024",
      role: "DEVELOPMENT",
    });
    expect(first.n).toBe(rows.length);
    expect(first.failures).toEqual([]);
    expect(first.peHomeAdvantageElo).toBe(65);
    expect(first.catalogueRolePriorIsolatedFromPeHa).toBe(true);
    expect(JSON.stringify(first.arms.C0.all)).toEqual(JSON.stringify(second.arms.C0.all));
    expect(JSON.stringify(first.deltas)).toEqual(JSON.stringify(second.deltas));
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
    for (const armId of INPUT_GEOMETRY_ARMS) {
      const hybrid = first.arms[armId].namedTraces[0]?.hybrid;
      if (hybrid) {
        expect(hybrid.home + hybrid.draw + hybrid.away).toBeCloseTo(1, 12);
      }
      const all = first.arms[armId].all;
      expect(all.n).toBe(rows.length);
      expect(all.predictedHome + all.predictedDraw + all.predictedAway).toBeCloseTo(1, 8);
    }
    expect(first.arms.C0.byEvidence["0"].n + first.arms.C0.byEvidence["1-3"].n).toBeGreaterThan(0);
    const traced = evaluateSeasonInputGeometry({
      rows: [...labeled("2023"), villaRow()],
      season: "2023",
      role: "HOLDOUT",
    });
    expect(traced.arms.C0.namedTraces[0]?.label).toContain("Aston Villa vs Sheffield Utd 1-1");
    const villaHybrid = traced.arms.C0.namedTraces[0]?.hybrid;
    expect(villaHybrid).toBeDefined();
    expect((villaHybrid!.home + villaHybrid!.draw + villaHybrid!.away)).toBeCloseTo(1, 12);
    expect(first.deltas.map((delta) => delta.contrast)).toEqual([
      "C1-C0",
      "C2-C0",
      "C3-C0",
      "C4-C0",
      "C7-C0",
    ]);

    const holdout = poolHoldoutOnly([
      evaluateSeasonInputGeometry({ rows: labeled("2023"), season: "2023", role: "HOLDOUT" }),
      evaluateSeasonInputGeometry({ rows: labeled("2025"), season: "2025", role: "HOLDOUT" }),
    ]);
    expect(holdout.seasons).toEqual(["2023", "2025"]);
    expect(holdout.seasons).not.toContain("2024");
    expect(holdout.n).toBe(labeled("2023").length + labeled("2025").length);
    expect(() =>
      poolHoldoutOnly([
        {
          ...first,
          season: "2024",
          role: "HOLDOUT",
        },
      ]),
    ).toThrow(/exclude PL 2024/);

    expect(DRAW_FORENSICS_DEVELOPMENT_SEASON).toBe("2024");
    expect(DRAW_FORENSICS_HOLDOUT_SEASONS).toEqual(["2023", "2025"]);
    expect(loadDrawForensicsSeason("2023").role).toBe("HOLDOUT");
    expect(loadDrawForensicsSeason("2024").role).toBe("DEVELOPMENT");
    expect(loadDrawForensicsSeason("2025").role).toBe("HOLDOUT");
    expect(loadDrawForensicsSeason("2023").n).toBe(380);
    expect(loadDrawForensicsSeason("2024").n).toBe(380);
    expect(loadDrawForensicsSeason("2025").n).toBe(380);
    expect(DEFAULT_HYBRID_CONFIG).toEqual(before);
  });

  it("preserves same-kickoff leakage and has no live/odds/search helpers", () => {
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

    const sources = IG_FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/rankPolicy|bestArm|selectWinner|winnerScore|chooseBest/);
    expect(sources).not.toMatch(/live-transport|getFixtureOdds|API_FOOTBALL_KEY|APEX_CALIBRATION_LIVE/);
    expect(sources).not.toMatch(/homeOdds/);
    expect(sources).not.toMatch(/linearK:\s*(?!8)\d+|k=16|k=6|k=4/);
    expect(sources).not.toMatch(/eloGoalScale:\s*(?!400)\d+/);
    expect(sources).not.toMatch(/baseHomeGoals:\s*1\.3/);
    expect(sources).not.toMatch(/homeAdvantageElo:\s*0/);
    expect(sources).not.toMatch(/eloDrawBase:\s*0\.2/);
    expect(sources).not.toMatch(/DECLARED_.*GRID/);

    const c0 = resolveMatchElos("C0", labeled("2024")[1]!);
    const c1 = resolveMatchElos("C1", labeled("2024")[1]!);
    expect(c0.homeElo).not.toBe(c1.homeElo);
    expect(armSpec("C1").shrinkage).toBe(false);
    expect(armSpec("C1").gdMode).toBe("cumulative");
    expect(armSpec("C2").homeBase).toBe(1580);
    expect(armSpec("C2").shrinkage).toBe(true);
    expect(armSpec("C2").gdMode).toBe("cumulative");
  });
});
