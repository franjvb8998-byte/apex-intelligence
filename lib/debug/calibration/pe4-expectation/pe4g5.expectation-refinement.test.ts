/**
 * PE-4G.5 — Expectation refinement tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestPe4ExpectationRefinementProtocol,
  PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST,
  PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_FEATURE,
  pe4ExpectationRefinementProtocol,
} from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";
import { digestPe4ExpectationPocProtocol } from "@/lib/debug/calibration/pe4-expectation/protocol";
import {
  assertModelC2DrawShapeValid,
  fitModelC2,
  modelC2DiagnosticGrid,
  predictModelC2,
} from "@/lib/debug/calibration/pe4-expectation/model-c2";
import {
  fitLowInfoFallbackPrior,
  resolveHomeOrientedExpectation,
} from "@/lib/debug/calibration/pe4-expectation/low-information";
import {
  expectedHomePoints,
  expectedAwayPoints,
  expectedTargetPoints,
  GOAL_DIFFERENCE_RESIDUAL_STATUS,
  orientToTarget,
  resultResidualPoints,
} from "@/lib/debug/calibration/pe4-expectation/orientation";
import {
  inferRefinementExpectation,
  PE4_EXPECTATION_REFINEMENT_MODEL_VERSION,
} from "@/lib/debug/calibration/pe4-expectation/inference-adapter";
import { rejectHoldoutSeasonRows } from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
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

describe("PE-4G.5 protocol", () => {
  it("has deterministic digest and pins parent PE-4G.4 digest", () => {
    const a = digestPe4ExpectationRefinementProtocol();
    const b = digestPe4ExpectationRefinementProtocol(
      pe4ExpectationRefinementProtocol(),
    );
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST).toBe(
      digestPe4ExpectationPocProtocol(),
    );
    expect(PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST).toBe(
      "1c43a79034d6e167b6a2368a3db56061f9d05a9252fa45ade5538b7a6ec3ed24",
    );
    expect(PE4_EXPECTATION_REFINEMENT_C2_MAGNITUDE_FEATURE).toBe("abs_zD");
  });

  it("keeps activation false and production UNAVAILABLE", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    const e = resolvePe4HistoricalExpectation({
      targetStrengthCommon: 1600,
      opponentStrengthCommon: 1550,
      targetVenueRole: "HOME",
      pairwiseAvailable: true,
      historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
      targetSource: "catalogue",
      opponentSource: "catalogue",
    });
    expect(e.status).toBe("UNAVAILABLE");
  });
});

describe("PE-4G.5 Model C2", () => {
  it("fits deterministically with train-only scaling and valid simplex", () => {
    // Mild association: larger D → more HOME, smaller → more AWAY; draws near 0.
    const train = Array.from({ length: 120 }, (_, i) => {
      const D = (i - 60) * 3;
      let actualOutcome: "HOME" | "DRAW" | "AWAY" = "DRAW";
      if (D > 40) actualOutcome = i % 5 === 0 ? "DRAW" : "HOME";
      else if (D < -40) actualOutcome = i % 5 === 0 ? "DRAW" : "AWAY";
      else actualOutcome = i % 3 === 0 ? "DRAW" : i % 3 === 1 ? "HOME" : "AWAY";
      return fakeRow({
        fixtureId: `c2_${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 8, 1 + (i % 28), Math.floor(i / 28))).toISOString(),
        strengthDifferentialHome: D,
        actualOutcome,
      });
    });
    const a = fitModelC2({ trainRows: train, l2Lambda: 1.0 });
    const b = fitModelC2({ trainRows: train, l2Lambda: 1.0 });
    expect(a.parameterDigest).toBe(b.parameterDigest);
    expect(a.converged).toBe(true);
    expect(a.featureSchema).toBe("intercept_plus_zD_plus_abs_zD");
    const preds = predictModelC2(a, train.slice(0, 5));
    for (const p of preds) {
      expect(p.HOME + p.DRAW + p.AWAY).toBeCloseTo(1, 9);
    }
    const grid = modelC2DiagnosticGrid(a, [-200, -50, 0, 50, 200]);
    expect(() => assertModelC2DrawShapeValid(grid)).not.toThrow();
  });
});

describe("PE-4G.5 low-information policy", () => {
  it("does not silently equate both_base_prior with model D=0", () => {
    const prior = { HOME: 0.45, DRAW: 0.22, AWAY: 0.33 };
    const modelD0 = { HOME: 0.54, DRAW: 0.2, AWAY: 0.26 };
    const resolved = resolveHomeOrientedExpectation({
      qualityKind: "base_prior_base_prior",
      lowInformationBothBasePrior: true,
      modelPrediction: modelD0,
      lowInfoPrior: prior,
      modelVersion: PE4_EXPECTATION_REFINEMENT_MODEL_VERSION,
    });
    expect(resolved.expectedOneXTwo).toEqual(prior);
    expect(resolved.metadata.lowInformationFallbackUsed).toBe(true);
    expect(resolved.metadata.expectationStatus).toBe("FALLBACK_PRIOR");
    expect(resolved.expectedOneXTwo).not.toEqual(modelD0);
  });

  it("uses catalogue prediction when strength evidence is present", () => {
    const prior = fitLowInfoFallbackPrior([
      fakeRow({
        fixtureId: "t",
        season: "2023",
        kickoffUtc: "2023-09-01T12:00:00.000Z",
        actualOutcome: "HOME",
      }),
    ]);
    const modelP = { HOME: 0.6, DRAW: 0.2, AWAY: 0.2 };
    const resolved = resolveHomeOrientedExpectation({
      qualityKind: "catalogue_catalogue",
      lowInformationBothBasePrior: false,
      modelPrediction: modelP,
      lowInfoPrior: prior,
      modelVersion: "v",
    });
    expect(resolved.expectedOneXTwo).toEqual(modelP);
    expect(resolved.metadata.lowInformationFallbackUsed).toBe(false);
  });
});

describe("PE-4G.5 orientation / expected points / residual", () => {
  it("transforms HOME and AWAY perspectives correctly", () => {
    const p = { HOME: 0.5, DRAW: 0.2, AWAY: 0.3 };
    expect(orientToTarget(p, "HOME")).toEqual({
      targetWinP: 0.5,
      targetDrawP: 0.2,
      targetLossP: 0.3,
    });
    expect(orientToTarget(p, "AWAY")).toEqual({
      targetWinP: 0.3,
      targetDrawP: 0.2,
      targetLossP: 0.5,
    });
  });

  it("derives expected points from 1X2 exactly", () => {
    const p = { HOME: 0.5, DRAW: 0.2, AWAY: 0.3 };
    expect(expectedHomePoints(p)).toBeCloseTo(1.7, 10);
    expect(expectedAwayPoints(p)).toBeCloseTo(1.1, 10);
    expect(expectedTargetPoints(orientToTarget(p, "HOME"))).toBeCloseTo(1.7, 10);
    expect(expectedTargetPoints(orientToTarget(p, "AWAY"))).toBeCloseTo(1.1, 10);
  });

  it("computes points residual and keeps GD UNAVAILABLE", () => {
    expect(resultResidualPoints("WIN", 1.5)).toBeCloseTo(1.5, 10);
    expect(resultResidualPoints("DRAW", 1.5)).toBeCloseTo(-0.5, 10);
    expect(resultResidualPoints("LOSS", 1.5)).toBeCloseTo(-1.5, 10);
    expect(GOAL_DIFFERENCE_RESIDUAL_STATUS).toBe("UNAVAILABLE");
  });
});

describe("PE-4G.5 adapter / holdout", () => {
  it("infers deterministically from frozen C2 bundle", () => {
    const train = Array.from({ length: 60 }, (_, i) =>
      fakeRow({
        fixtureId: `a_${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 8, 1 + i)).toISOString(),
        strengthDifferentialHome: i - 30,
        actualOutcome: i % 3 === 0 ? "HOME" : i % 3 === 1 ? "DRAW" : "AWAY",
      }),
    );
    const model = fitModelC2({ trainRows: train, l2Lambda: 1.0 });
    const bundle = {
      model,
      lowInfoPrior: fitLowInfoFallbackPrior(train),
      modelVersion: PE4_EXPECTATION_REFINEMENT_MODEL_VERSION,
      protocolDigest: "x",
      parentProtocolDigest: "y",
      datasetDigest: "z",
    };
    const r1 = inferRefinementExpectation({
      bundle,
      strengthDifferentialHome: 0,
      qualityKind: "catalogue_catalogue",
      lowInformationBothBasePrior: false,
      targetVenueRole: "HOME",
    });
    const r2 = inferRefinementExpectation({
      bundle,
      strengthDifferentialHome: 0,
      qualityKind: "catalogue_catalogue",
      lowInformationBothBasePrior: false,
      targetVenueRole: "HOME",
    });
    expect(r1).toEqual(r2);
    expect(r1.expectedHomeProbability + r1.expectedDrawProbability + r1.expectedAwayProbability).toBeCloseTo(1, 9);
  });

  it("rejects holdout season rows", () => {
    expect(() =>
      rejectHoldoutSeasonRows([
        fakeRow({
          fixtureId: "h",
          season: "2025",
          kickoffUtc: "2025-09-01T12:00:00.000Z",
        }),
      ]),
    ).toThrow(/Holdout/);
  });
});
