/**
 * PE-4G.3 — Offline expectation dataset builder tests.
 * No network. No model fitting.
 */

import { describe, expect, it } from "vitest";
import { CALIBRATION_RECONSTRUCTION_VERSION } from "@/lib/debug/calibration/types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";
import {
  buildPe4ExpectationDataset,
  buildPe4ExpectationDatasetRow,
  digestPe4ExpectationDataset,
  reconstructPe4CommonBaselineStrength,
  PE4_EXPECTATION_COMMON_BASELINE,
} from "@/lib/prematch-decision/pe4-form-schedule";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { catalogueEloFromPlayedStats } from "@/lib/match-center/catalogue-elo";

function row(
  partial: Partial<CalibrationRow> & Pick<CalibrationRow, "fixtureId">,
): CalibrationRow {
  return {
    schemaVersion: "apex.calibration.row.v1",
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    kickoff: "2024-09-01T15:00:00.000Z",
    competitionId: "39",
    competitionName: "Premier League",
    season: "2024",
    category: "mens",
    homeTeamId: "33",
    homeTeamName: "Home",
    awayTeamId: "34",
    awayTeamName: "Away",
    homePlayedBefore: 5,
    homeWinsBefore: 3,
    homeGfBefore: 8,
    homeGaBefore: 4,
    awayPlayedBefore: 5,
    awayWinsBefore: 2,
    awayGfBefore: 6,
    awayGaBefore: 5,
    actualHomeGoals: 2,
    actualAwayGoals: 1,
    actualOutcome: "home",
    bookmaker: null,
    market: null,
    homeOdds: null,
    drawOdds: null,
    awayOdds: null,
    oddsObservedAt: null,
    oddsTiming: "unknown",
    ...partial,
  };
}

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 11 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

describe("PE-4G.3 activation / safety", () => {
  it("keeps PE3C_C0_RECON_ACTIVATION false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("PE-4G.3 schema / outcome", () => {
  it("accepts valid source row and labels outcome from goals", () => {
    const built = buildPe4ExpectationDatasetRow(row({ fixtureId: "1" }));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.row.actualOutcome).toBe("HOME");
    expect(built.row.actualGoalDifferenceHome).toBe(1);
    expect(built.row.schemaVersion).toBe("pe4.expectation.dataset.v1");
  });

  it("rejects malformed / missing material fields", () => {
    expect(
      buildPe4ExpectationDatasetRow(row({ fixtureId: "", actualHomeGoals: 1 }))
        .ok,
    ).toBe(false);
    expect(
      buildPe4ExpectationDatasetRow(
        row({ fixtureId: "x", actualHomeGoals: null }),
      ).ok,
    ).toBe(false);
    expect(
      buildPe4ExpectationDatasetRow(
        row({ fixtureId: "x", homeTeamId: "1", awayTeamId: "1" }),
      ).ok,
    ).toBe(false);
  });

  it("fails closed on outcome/goal conflict", () => {
    const built = buildPe4ExpectationDatasetRow(
      row({
        fixtureId: "conflict",
        actualHomeGoals: 1,
        actualAwayGoals: 1,
        actualOutcome: "home",
      }),
    );
    expect(built.ok).toBe(false);
  });

  it("DRAW / AWAY labels correct", () => {
    expect(
      buildPe4ExpectationDatasetRow(
        row({
          fixtureId: "d",
          actualHomeGoals: 1,
          actualAwayGoals: 1,
          actualOutcome: "draw",
        }),
      ),
    ).toMatchObject({ ok: true, row: { actualOutcome: "DRAW" } });
    expect(
      buildPe4ExpectationDatasetRow(
        row({
          fixtureId: "a",
          actualHomeGoals: 0,
          actualAwayGoals: 2,
          actualOutcome: "away",
        }),
      ),
    ).toMatchObject({ ok: true, row: { actualOutcome: "AWAY" } });
  });
});

describe("PE-4G.3 temporal contract", () => {
  it("uses only *Before stats for strength; goals do not enter reconstruction", () => {
    const a = buildPe4ExpectationDatasetRow(
      row({
        fixtureId: "t1",
        actualHomeGoals: 0,
        actualAwayGoals: 0,
        actualOutcome: "draw",
      }),
    );
    const b = buildPe4ExpectationDatasetRow(
      row({
        fixtureId: "t1",
        actualHomeGoals: 7,
        actualAwayGoals: 0,
        actualOutcome: "home",
      }),
    );
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.row.homeCommonStrength).toBe(b.row.homeCommonStrength);
    expect(a.row.awayCommonStrength).toBe(b.row.awayCommonStrength);
    expect(a.row.strengthDifferentialHome).toBe(b.row.strengthDifferentialHome);
    expect(a.row.actualOutcome).not.toBe(b.row.actualOutcome);
  });

  it("rejects unproven reconstruction versions when required", () => {
    const result = buildPe4ExpectationDataset({
      sourceRows: [
        row({
          fixtureId: "bad",
          reconstructionVersion: "unknown.v0" as never,
        }),
      ],
      requireProvenReconstruction: true,
    });
    expect(result.rows).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("unproven_reconstruction_version");
  });
});

describe("PE-4G.3 common-base reconstruction", () => {
  it("matches catalogueEloFromPlayedStats at common baseline", () => {
    const rebuilt = reconstructPe4CommonBaselineStrength({
      played: 10,
      wins: 6,
      goalsFor: 20,
      goalsAgainst: 12,
    });
    expect(rebuilt.source).toBe("catalogue");
    expect(rebuilt.strength).toBe(
      catalogueEloFromPlayedStats({
        base: PE4_EXPECTATION_COMMON_BASELINE,
        played: 10,
        wins: 6,
        goalsFor: 20,
        goalsAgainst: 12,
      }),
    );
  });

  it("base_prior when played=0 equals common baseline", () => {
    const rebuilt = reconstructPe4CommonBaselineStrength({
      played: 0,
      wins: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    });
    expect(rebuilt.source).toBe("base_prior");
    expect(rebuilt.strength).toBe(PE4_EXPECTATION_COMMON_BASELINE);
  });

  it("D is invariant to common B for catalogue-catalogue (up to quantization)", () => {
    const home = { played: 8, wins: 4, goalsFor: 12, goalsAgainst: 10 };
    const away = { played: 8, wins: 3, goalsFor: 9, goalsAgainst: 11 };
    const d1580 =
      reconstructPe4CommonBaselineStrength({ ...home, commonBaseline: 1580 })
        .strength -
      reconstructPe4CommonBaselineStrength({ ...away, commonBaseline: 1580 })
        .strength;
    const d1500 =
      reconstructPe4CommonBaselineStrength({ ...home, commonBaseline: 1500 })
        .strength -
      reconstructPe4CommonBaselineStrength({ ...away, commonBaseline: 1500 })
        .strength;
    expect(Math.abs(d1580 - d1500)).toBeLessThanOrEqual(2);
  });

  it("quality combinations deterministic", () => {
    const bothCat = buildPe4ExpectationDatasetRow(row({ fixtureId: "cc" }));
    expect(bothCat.ok && bothCat.row.qualityKind).toBe("catalogue_catalogue");

    const homeBp = buildPe4ExpectationDatasetRow(
      row({
        fixtureId: "bc",
        homePlayedBefore: 0,
        homeWinsBefore: 0,
        homeGfBefore: 0,
        homeGaBefore: 0,
      }),
    );
    expect(homeBp.ok && homeBp.row.qualityKind).toBe("base_prior_catalogue");

    const bothBp = buildPe4ExpectationDatasetRow(
      row({
        fixtureId: "bb",
        homePlayedBefore: 0,
        homeWinsBefore: 0,
        homeGfBefore: 0,
        homeGaBefore: 0,
        awayPlayedBefore: 0,
        awayWinsBefore: 0,
        awayGfBefore: 0,
        awayGaBefore: 0,
      }),
    );
    expect(bothBp.ok && bothBp.row.qualityKind).toBe("base_prior_base_prior");
    expect(bothBp.ok && bothBp.row.lowInformationBothBasePrior).toBe(true);
    expect(bothBp.ok && bothBp.row.strengthDifferentialHome).toBe(0);
  });
});

describe("PE-4G.3 dedup / determinism / splits", () => {
  it("identical duplicate once; conflicting duplicate fails closed", () => {
    const a = row({ fixtureId: "dup", season: "2024" });
    const once = buildPe4ExpectationDataset({
      sourceRows: [a, { ...a }],
    });
    expect(once.rows).toHaveLength(1);
    expect(once.manifest.identicalDuplicateCount).toBe(1);

    expect(() =>
      buildPe4ExpectationDataset({
        sourceRows: [
          a,
          row({
            fixtureId: "dup",
            season: "2024",
            actualHomeGoals: 9,
            actualAwayGoals: 0,
            actualOutcome: "home",
          }),
        ],
      }),
    ).toThrow(/Conflicting duplicate/);
  });

  it("shuffled inputs yield same rows and digest", () => {
    const sources = [
      row({ fixtureId: "3", season: "2023", kickoff: "2023-09-01T15:00:00Z" }),
      row({ fixtureId: "1", season: "2024", kickoff: "2024-09-01T15:00:00Z" }),
      row({ fixtureId: "2", season: "2025", kickoff: "2025-09-01T15:00:00Z" }),
    ];
    const a = buildPe4ExpectationDataset({ sourceRows: sources });
    const b = buildPe4ExpectationDataset({ sourceRows: shuffle(sources) });
    expect(a.manifest.datasetDigest).toBe(b.manifest.datasetDigest);
    expect(a.rows.map((r) => r.fixtureId)).toEqual(
      b.rows.map((r) => r.fixtureId),
    );
    expect(digestPe4ExpectationDataset(a.rows)).toBe(a.manifest.datasetDigest);
  });

  it("material change changes digest", () => {
    const a = buildPe4ExpectationDataset({
      sourceRows: [row({ fixtureId: "1", homeWinsBefore: 2 })],
    });
    const b = buildPe4ExpectationDataset({
      sourceRows: [row({ fixtureId: "1", homeWinsBefore: 4 })],
    });
    expect(a.manifest.datasetDigest).not.toBe(b.manifest.datasetDigest);
  });

  it("season splits are chronological, disjoint, promotionEligible=false", () => {
    const result = buildPe4ExpectationDataset({
      sourceRows: [
        row({ fixtureId: "a", season: "2023", kickoff: "2023-08-01T12:00:00Z" }),
        row({ fixtureId: "b", season: "2024", kickoff: "2024-08-01T12:00:00Z" }),
        row({ fixtureId: "c", season: "2025", kickoff: "2025-08-01T12:00:00Z" }),
      ],
    });
    expect(result.manifest.splits).toHaveLength(3);
    const ids = new Set<string>();
    for (const split of result.manifest.splits) {
      expect(split.promotionEligible).toBe(false);
      expect(split.rowCount).toBe(1);
      expect(split.fixtureIdDigest).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(result.rows.every((r) => {
      if (ids.has(r.fixtureId)) return false;
      ids.add(r.fixtureId);
      return true;
    })).toBe(true);
  });
});
