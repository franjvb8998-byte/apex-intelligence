/**
 * PE-4G.4 — Offline expectation POC tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestPe4ExpectationPocProtocol,
  pe4ExpectationPocProtocol,
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import {
  multiclassBrier,
  multiclassLogLoss,
  normalizeOneXTwo,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import { buildPe4ExpectationInternalFolds } from "@/lib/debug/calibration/pe4-expectation/folds";
import {
  filterFitEligible,
  rejectHoldoutSeasonRows,
  selectSeasonRows,
} from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { fitModelD, predictModelD } from "@/lib/debug/calibration/pe4-expectation/model-d";
import { fitModelC, predictModelC } from "@/lib/debug/calibration/pe4-expectation/model-c";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

function fakeRow(
  partial: Partial<Pe4ExpectationDatasetRow> &
    Pick<Pe4ExpectationDatasetRow, "fixtureId" | "season" | "kickoffUtc">,
): Pe4ExpectationDatasetRow {
  return {
    schemaVersion: "pe4.expectation.dataset.v1",
    competitionId: "39",
    homeTeamId: "1",
    awayTeamId: "2",
    homeCommonStrength: 1600,
    awayCommonStrength: 1550,
    strengthDifferentialHome: 50,
    homeStrengthSource: "catalogue",
    awayStrengthSource: "catalogue",
    homePlayed: 5,
    awayPlayed: 5,
    qualityKind: "catalogue_catalogue",
    lowInformationBothBasePrior: false,
    actualHomeGoals: 1,
    actualAwayGoals: 0,
    actualOutcome: "HOME",
    actualGoalDifferenceHome: 1,
    sourceReconstructionVersion: "same_competition_season.kickoff_lt.v2",
    sourceSchemaVersion: "apex.calibration.row.v1",
    ...partial,
  };
}

describe("PE-4G.4 protocol", () => {
  it("has deterministic digest and locks dataset digest", () => {
    const a = digestPe4ExpectationPocProtocol();
    const b = digestPe4ExpectationPocProtocol(pe4ExpectationPocProtocol());
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST).toBe(
      "139f6f8139490ea95154ada6b68df571b4326cf348c786034a011d25250feda3",
    );
  });

  it("keeps activation false", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("PE-4G.4 metrics", () => {
  it("computes known log loss / brier", () => {
    // Floor renormalizes near-degenerate mass; use already-valid probs.
    const p = { HOME: 0.98, DRAW: 0.01, AWAY: 0.01 };
    expect(multiclassLogLoss([p], ["HOME"])).toBeCloseTo(-Math.log(0.98), 10);
    expect(multiclassBrier([p], ["HOME"])).toBeCloseTo(
      (0.98 - 1) ** 2 + (0.01 - 0) ** 2 + (0.01 - 0) ** 2,
      10,
    );
    const uniform = normalizeOneXTwo({ HOME: 1, DRAW: 1, AWAY: 1 });
    expect(multiclassLogLoss([uniform], ["DRAW"])).toBeCloseTo(Math.log(3), 10);
  });
});

describe("PE-4G.4 folds / holdout", () => {
  it("builds chronological disjoint folds", () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      fakeRow({
        fixtureId: `f${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 7, 1 + i)).toISOString(),
        strengthDifferentialHome: i - 50,
      }),
    );
    const folds = buildPe4ExpectationInternalFolds(rows);
    expect(folds.length).toBeGreaterThan(0);
    for (const fold of folds) {
      const trainIds = new Set(fold.train.map((r) => r.fixtureId));
      for (const r of fold.eval) expect(trainIds.has(r.fixtureId)).toBe(false);
      expect(fold.trainLastKickoffUtc <= fold.evalLastKickoffUtc).toBe(true);
    }
  });

  it("rejects holdout season in train/eval path", () => {
    expect(() =>
      rejectHoldoutSeasonRows([
        fakeRow({
          fixtureId: "x",
          season: "2025",
          kickoffUtc: "2025-09-01T12:00:00.000Z",
        }),
      ]),
    ).toThrow(/Holdout/);
    expect(() =>
      selectSeasonRows(
        [
          fakeRow({
            fixtureId: "x",
            season: "2025",
            kickoffUtc: "2025-09-01T12:00:00.000Z",
          }),
        ],
        "2025",
      ),
    ).toThrow();
  });

  it("filters catalogue_catalogue for fitting", () => {
    const rows = [
      fakeRow({
        fixtureId: "a",
        season: "2023",
        kickoffUtc: "2023-09-01T12:00:00.000Z",
        qualityKind: "catalogue_catalogue",
      }),
      fakeRow({
        fixtureId: "b",
        season: "2023",
        kickoffUtc: "2023-09-02T12:00:00.000Z",
        qualityKind: "base_prior_base_prior",
        lowInformationBothBasePrior: true,
        homePlayed: 0,
        awayPlayed: 0,
      }),
    ];
    expect(filterFitEligible(rows)).toHaveLength(1);
  });
});

describe("PE-4G.4 models", () => {
  it("Model D probabilities sum to 1 and are deterministic", () => {
    const train = Array.from({ length: 40 }, (_, i) =>
      fakeRow({
        fixtureId: `t${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 8, 1 + i)).toISOString(),
        strengthDifferentialHome: (i % 5) * 30 - 60,
        actualOutcome: i % 3 === 0 ? "HOME" : i % 3 === 1 ? "DRAW" : "AWAY",
      }),
    );
    const a = fitModelD({ trainRows: train, binWidth: 40, shrinkKappa: 20 });
    const b = fitModelD({ trainRows: train, binWidth: 40, shrinkKappa: 20 });
    expect(a.parameterDigest).toBe(b.parameterDigest);
    const preds = predictModelD(a, train.slice(0, 3));
    for (const p of preds) {
      expect(p.HOME + p.DRAW + p.AWAY).toBeCloseTo(1, 10);
    }
  });

  it("Model C trains with train-only scaling and deterministic fit", () => {
    const train = Array.from({ length: 60 }, (_, i) =>
      fakeRow({
        fixtureId: `c${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 8, 1 + i)).toISOString(),
        strengthDifferentialHome: i - 30,
        actualOutcome: i > 35 ? "HOME" : i < 15 ? "AWAY" : "DRAW",
      }),
    );
    const a = fitModelC({ trainRows: train, l2Lambda: 0.1 });
    const b = fitModelC({ trainRows: train, l2Lambda: 0.1 });
    expect(a.parameterDigest).toBe(b.parameterDigest);
    expect(a.converged).toBe(true);
    const preds = predictModelC(a, train.slice(0, 5));
    for (const p of preds) {
      expect(p.HOME + p.DRAW + p.AWAY).toBeCloseTo(1, 9);
    }
  });
});
