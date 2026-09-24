/**
 * PE-4H.1 — Residual form signal audit tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestPe4FormSignalProtocol,
  PE4_FORM_SIGNAL_PARENT_POC_PROTOCOL_DIGEST,
  PE4_FORM_SIGNAL_PARENT_REFINEMENT_PROTOCOL_DIGEST,
  pe4FormSignalProtocol,
} from "@/lib/debug/calibration/pe4-form/protocol";
import {
  buildTeamObservationsForFixture,
  fitFrozenExpectationModelC,
} from "@/lib/debug/calibration/pe4-form/observations";
import {
  computeHistorySummaries,
  priorObservationsForTarget,
  residualAtHorizon,
  groupObservationsByTeam,
} from "@/lib/debug/calibration/pe4-form/history";
import {
  pearson,
  spearman,
  signAgreement,
} from "@/lib/debug/calibration/pe4-form/diagnostics";
import { teamShufflePearson } from "@/lib/debug/calibration/pe4-form/shuffle";
import type { SignalPair } from "@/lib/debug/calibration/pe4-form/diagnostics";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import type { Pe4FormTeamObservation } from "@/lib/debug/calibration/pe4-form/observations";

function row(
  partial: Partial<Pe4ExpectationDatasetRow> &
    Pick<Pe4ExpectationDatasetRow, "fixtureId" | "season" | "kickoffUtc">,
): Pe4ExpectationDatasetRow {
  return {
    schemaVersion: "pe4.expectation.dataset.v1",
    competitionId: "39",
    homeTeamId: "H1",
    awayTeamId: "A1",
    homeCommonStrength: 1600,
    awayCommonStrength: 1550,
    strengthDifferentialHome: 50,
    homeStrengthSource: "catalogue",
    awayStrengthSource: "catalogue",
    homePlayed: 5,
    awayPlayed: 5,
    qualityKind: "catalogue_catalogue",
    lowInformationBothBasePrior: false,
    actualHomeGoals: 2,
    actualAwayGoals: 1,
    actualOutcome: "HOME",
    actualGoalDifferenceHome: 1,
    sourceReconstructionVersion: "same_competition_season.kickoff_lt.v2",
    sourceSchemaVersion: "apex.calibration.row.v1",
    ...partial,
  };
}

describe("PE-4H.1 protocol", () => {
  it("has deterministic digest and pins parents", () => {
    const a = digestPe4FormSignalProtocol();
    const b = digestPe4FormSignalProtocol(pe4FormSignalProtocol());
    expect(a).toBe(b);
    expect(PE4_FORM_SIGNAL_PARENT_POC_PROTOCOL_DIGEST).toBe(
      "1c43a79034d6e167b6a2368a3db56061f9d05a9252fa45ade5538b7a6ec3ed24",
    );
    expect(PE4_FORM_SIGNAL_PARENT_REFINEMENT_PROTOCOL_DIGEST).toBe(
      "9aabd539c72a3b7c2efd984014912a29d1dd5a7ee0253eae7823d1dfff12050f",
    );
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: 1,
        opponentStrengthCommon: 2,
        targetVenueRole: "HOME",
        pairwiseAvailable: true,
        historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
        targetSource: "catalogue",
        opponentSource: "catalogue",
      }).status,
    ).toBe("UNAVAILABLE");
  });
});

describe("PE-4H.1 observations", () => {
  it("builds two perspectives with correct EP/residual", () => {
    const train = Array.from({ length: 40 }, (_, i) =>
      row({
        fixtureId: `t${i}`,
        season: "2023",
        kickoffUtc: new Date(Date.UTC(2023, 8, 1 + i)).toISOString(),
        strengthDifferentialHome: (i - 20) * 5,
        actualHomeGoals: i % 3,
        actualAwayGoals: (i + 1) % 3,
        actualOutcome:
          i % 3 > (i + 1) % 3 ? "HOME" : i % 3 < (i + 1) % 3 ? "AWAY" : "DRAW",
      }),
    );
    const { model, lowInfoPrior } = fitFrozenExpectationModelC(train);
    const fixture = row({
      fixtureId: "fx1",
      season: "2023",
      kickoffUtc: "2023-10-01T15:00:00.000Z",
      homeTeamId: "T1",
      awayTeamId: "T2",
      actualHomeGoals: 1,
      actualAwayGoals: 0,
      actualOutcome: "HOME",
    });
    const [home, away] = buildTeamObservationsForFixture(
      fixture,
      model,
      lowInfoPrior,
    );
    expect(home.venueRole).toBe("HOME");
    expect(away.venueRole).toBe("AWAY");
    expect(home.teamId).toBe("T1");
    expect(away.teamId).toBe("T2");
    expect(home.realizedTargetPoints).toBe(3);
    expect(away.realizedTargetPoints).toBe(0);
    expect(home.expectedTargetPoints).toBeCloseTo(
      3 * home.expectedTargetWinProbability +
        home.expectedTargetDrawProbability,
      10,
    );
    expect(away.expectedTargetPoints).toBeCloseTo(
      3 * away.expectedTargetWinProbability +
        away.expectedTargetDrawProbability,
      10,
    );
    expect(home.resultResidualPoints).toBeCloseTo(
      home.realizedTargetPoints - home.expectedTargetPoints,
      10,
    );
    expect(home.expectedTargetWinProbability).toBeCloseTo(
      away.expectedTargetLossProbability,
      10,
    );
  });

  it("rejects holdout season", () => {
    const train = [
      row({
        fixtureId: "t0",
        season: "2023",
        kickoffUtc: "2023-09-01T12:00:00.000Z",
      }),
    ];
    const { model, lowInfoPrior } = fitFrozenExpectationModelC(train);
    expect(() =>
      buildTeamObservationsForFixture(
        row({
          fixtureId: "h",
          season: "2025",
          kickoffUtc: "2025-09-01T12:00:00.000Z",
        }),
        model,
        lowInfoPrior,
      ),
    ).toThrow(/Holdout/);
  });
});

describe("PE-4H.1 temporal / windows", () => {
  it("excludes self, same kickoff, and future", () => {
    const obs: Pe4FormTeamObservation[] = [
      {
        fixtureId: "1",
        competitionId: "39",
        season: "2023",
        kickoffUtc: "2023-09-01T12:00:00.000Z",
        teamId: "T",
        opponentTeamId: "O",
        venueRole: "HOME",
        strengthDifferentialTarget: 0,
        expectedTargetWinProbability: 0.4,
        expectedTargetDrawProbability: 0.3,
        expectedTargetLossProbability: 0.3,
        expectedTargetPoints: 1.5,
        realizedTargetPoints: 3,
        resultResidualPoints: 1.5,
        expectationModelVersion: "v",
        strengthEvidenceQuality: "catalogue_catalogue",
        lowInformationFallbackUsed: false,
      },
      {
        fixtureId: "2",
        competitionId: "39",
        season: "2023",
        kickoffUtc: "2023-09-08T12:00:00.000Z",
        teamId: "T",
        opponentTeamId: "O2",
        venueRole: "AWAY",
        strengthDifferentialTarget: 0,
        expectedTargetWinProbability: 0.4,
        expectedTargetDrawProbability: 0.3,
        expectedTargetLossProbability: 0.3,
        expectedTargetPoints: 1.5,
        realizedTargetPoints: 1,
        resultResidualPoints: -0.5,
        expectationModelVersion: "v",
        strengthEvidenceQuality: "catalogue_catalogue",
        lowInformationFallbackUsed: false,
      },
      {
        fixtureId: "3",
        competitionId: "39",
        season: "2023",
        kickoffUtc: "2023-09-15T12:00:00.000Z",
        teamId: "T",
        opponentTeamId: "O3",
        venueRole: "HOME",
        strengthDifferentialTarget: 0,
        expectedTargetWinProbability: 0.4,
        expectedTargetDrawProbability: 0.3,
        expectedTargetLossProbability: 0.3,
        expectedTargetPoints: 1.5,
        realizedTargetPoints: 0,
        resultResidualPoints: -1.5,
        expectationModelVersion: "v",
        strengthEvidenceQuality: "catalogue_catalogue",
        lowInformationFallbackUsed: false,
      },
    ];
    const target = obs[2]!;
    const priors = priorObservationsForTarget(target, obs);
    expect(priors.map((p) => p.fixtureId)).toEqual(["1", "2"]);
    expect(priors.some((p) => p.fixtureId === "3")).toBe(false);

    const summaries = computeHistorySummaries(target, obs);
    const last3 = summaries.find((s) => s.windowId === "last_3");
    expect(last3?.sufficient).toBe(false);
    const last2ish = summaries.find((s) => s.windowId === "days_28");
    expect(last2ish?.sufficient).toBe(true);

    expect(residualAtHorizon(obs[0]!, obs, 1)).toBeCloseTo(-0.5, 10);
    expect(residualAtHorizon(obs[0]!, obs, 2)).toBeCloseTo(-1.5, 10);
    expect(residualAtHorizon(obs[0]!, obs, 3)).toBeNull();
    expect(groupObservationsByTeam(obs).get("T")).toHaveLength(3);
  });
});

describe("PE-4H.1 diagnostics / shuffle", () => {
  it("computes known pearson/spearman/sign", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
    expect(signAgreement([1, -1, 2], [2, -3, 1])).toBeCloseTo(1, 10);
  });

  it("shuffle destroys temporal association in synthetic example", () => {
    const pairs: SignalPair[] = [];
    for (let i = 0; i < 40; i += 1) {
      const hist = i % 2 === 0 ? 1 : -1;
      pairs.push({
        fixtureId: `f${i}`,
        teamId: `team${i % 5}`,
        venueRole: "HOME",
        historical: hist,
        next: hist * 0.8 + (i % 3) * 0.01,
        realizedPoints: 1,
        expectedPoints: 1,
        strengthEvidenceQuality: "catalogue_catalogue",
        lowInformationFallbackUsed: false,
        expectedTargetPoints: 1,
      });
    }
    const sh = teamShufflePearson(pairs, 99, 50);
    expect(sh.observedPearson).not.toBeNull();
    expect(Math.abs(sh.observedPearson!)).toBeGreaterThan(0.5);
    expect(Math.abs(sh.shuffleMeanPearson!)).toBeLessThan(
      Math.abs(sh.observedPearson!) * 0.5,
    );
  });
});
