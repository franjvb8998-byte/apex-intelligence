/**
 * GOALS-1G.2 — Constrained market calibration POC tests.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { digestGoalsMcalProtocol } from "@/lib/debug/calibration/goals/market-calibration/protocol";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import { buildCanonicalObservations } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  calibrateGoalsMarketProbabilities,
  GOALS_MCAL_POC_PRODUCTION_WIRED,
} from "@/lib/debug/calibration/goals/market-calibration-poc/adapter";
import {
  buildGroupArtifact,
  digestArtifact,
} from "@/lib/debug/calibration/goals/market-calibration-poc/artifact";
import {
  assertSharedLogisticPreservesOrder,
  applySelectionsToObservations,
} from "@/lib/debug/calibration/goals/market-calibration-poc/apply";
import { bootstrapDeltaMetrics } from "@/lib/debug/calibration/goals/market-calibration-poc/bootstrap";
import { runGoalsMarketCalibrationPoc } from "@/lib/debug/calibration/goals/market-calibration-poc/evaluate";
import { buildDevelopmentFolds } from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import {
  applyLogisticCal,
  clipLogitP,
  fitLogisticRecalibration,
  logit,
} from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import {
  digestGoalsMcalPocProtocol,
  GOALS_MCAL_POC_GROUP_MATCH_TOTAL,
  GOALS_MCAL_POC_HOLDOUT_SEASON,
  GOALS_MCAL_POC_LOGIT_EPSILON,
  GOALS_MCAL_POC_O05_POLICY,
  GOALS_MCAL_POC_PARENT_G1_1_PROTOCOL_DIGEST,
  GOALS_MCAL_POC_PARENT_G1_K,
  GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
  goalsMcalPocProtocol,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import { selectGroupCalibrator } from "@/lib/debug/calibration/goals/market-calibration-poc/select";
import type { GroupSelectionResult } from "@/lib/debug/calibration/goals/market-calibration-poc/select";

function fx(
  partial: Partial<GoalsHistoricalFixture> &
    Pick<
      GoalsHistoricalFixture,
      "fixtureId" | "kickoffUtc" | "homeTeamId" | "awayTeamId"
    >,
): GoalsHistoricalFixture {
  return applyRegulationToFixture({
    status: "FT",
    competitionId: "39",
    season: "2023",
    sourceGoalsHome: 1,
    sourceGoalsAway: 1,
    sourceFulltimeHome: 1,
    sourceFulltimeAway: 1,
    ...partial,
  });
}

function miniUniverse(): GoalsHistoricalFixture[] {
  const teams = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const out: GoalsHistoricalFixture[] = [];
  let n = 0;
  // ~120 fixtures spanning Aug 2023–May 2024 calendar days (valid UTC dates)
  const start = Date.parse("2023-08-12T15:00:00.000Z");
  for (let week = 0; week < 40; week += 1) {
    for (let g = 0; g < 3; g += 1) {
      const home = teams[(week + g) % teams.length]!;
      const away = teams[(week + g + 1) % teams.length]!;
      const gh = (week + g) % 4;
      const ga = (week + g * 2) % 3;
      n += 1;
      const kickoffUtc = new Date(
        start + (week * 7 + g) * 24 * 60 * 60 * 1000,
      ).toISOString();
      out.push(
        fx({
          fixtureId: `f${n}`,
          kickoffUtc,
          homeTeamId: home,
          awayTeamId: away,
          sourceGoalsHome: gh,
          sourceGoalsAway: ga,
          sourceFulltimeHome: gh,
          sourceFulltimeAway: ga,
        }),
      );
    }
  }
  return out;
}

describe("GOALS-1G.2 protocol", () => {
  it("deterministic digest and G1 k=10 pin", () => {
    expect(digestGoalsMcalPocProtocol()).toBe(
      digestGoalsMcalPocProtocol(goalsMcalPocProtocol()),
    );
    expect(GOALS_MCAL_POC_PARENT_G1_K).toBe(10);
    expect(GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_MCAL_POC_PARENT_G1_1_PROTOCOL_DIGEST).toBe(
      digestGoalsMcalProtocol(),
    );
    expect(GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(goalsMcalPocProtocol().noIsotonic).toBe(true);
    expect(goalsMcalPocProtocol().noProductionWiring).toBe(true);
    expect(GOALS_MCAL_POC_O05_POLICY).toContain("NO_DEDICATED");
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(GOALS_MCAL_POC_PRODUCTION_WIRED).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: null,
        opponentStrengthCommon: null,
        targetVenueRole: "HOME",
        pairwiseAvailable: false,
        historicalCutoffUtc: "2023-08-01T00:00:00.000Z",
        targetSource: null,
        opponentSource: null,
      }).status,
    ).toBe("UNAVAILABLE");
  });
});

describe("GOALS-1G.2 logistic", () => {
  it("identity behavior, safe clipping, deterministic fit", () => {
    expect(clipLogitP(0)).toBe(GOALS_MCAL_POC_LOGIT_EPSILON);
    expect(clipLogitP(1)).toBe(1 - GOALS_MCAL_POC_LOGIT_EPSILON);
    expect(applyLogisticCal(0.7, 0, 1)).toBeCloseTo(0.7, 5);

    const probs = [0.2, 0.4, 0.6, 0.8, 0.3, 0.5, 0.7, 0.9, 0.1, 0.55, 0.45, 0.65];
    const ys = [0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1] as (0 | 1)[];
    const f1 = fitLogisticRecalibration(probs, ys);
    const f2 = fitLogisticRecalibration(probs, ys);
    expect(f1.converged).toBe(true);
    expect(f1.parameterDigest).toBe(f2.parameterDigest);
    expect(f1.intercept).toBe(f2.intercept);
    expect(f1.slope).toBe(f2.slope);
    expect(Number.isFinite(logit(0.5))).toBe(true);
  });

  it("positive slope preserves ordering; b<=0 fails closed", () => {
    const raw = [0.9, 0.7, 0.5, 0.3, 0.1];
    assertSharedLogisticPreservesOrder(raw, 0.1, 1.2);
    expect(() => assertSharedLogisticPreservesOrder(raw, 0, 0)).toThrow(/b<=0/);
    expect(() => assertSharedLogisticPreservesOrder(raw, 0, -0.5)).toThrow(/b<=0/);
  });
});

describe("GOALS-1G.2 folds and selection", () => {
  it("temporal folds chronological; selection uses 2023 only", () => {
    const universe = miniUniverse();
    const evidence = universe.map((t) =>
      buildGoalsTargetEvidence({ target: t, universe }),
    );
    // Mark as 2023
    const preds = evidence.map((e) => predictG1FromEvidence(e, 10));
    const obs = buildCanonicalObservations(preds).filter(
      (o) => o.season === "2023",
    );
    const folds = buildDevelopmentFolds(obs);
    expect(folds.length).toBeGreaterThanOrEqual(1);
    for (const f of folds) {
      expect(f.trainLastKickoffUtc <= f.evalFirstKickoffUtc).toBe(true);
    }
    const sel = selectGroupCalibrator("GROUP_MATCH_TOTAL", obs, folds);
    expect(["CAL_0", "CAL_1"]).toContain(sel.selectedFamily);
    expect(sel.folds.every((x) => x.foldId.startsWith("fold_"))).toBe(true);
    // No O0.5-dedicated: shared markets include O0.5 among five
    expect(sel.markets).toEqual([...GOALS_MCAL_POC_GROUP_MATCH_TOTAL]);
  });
});

describe("GOALS-1G.2 coherence and O0.5", () => {
  it("complement coherence, U0.5==0-0, no dedicated O0.5 calibrator", () => {
    const universe = miniUniverse().slice(0, 30);
    const evidence = universe.map((t) =>
      buildGoalsTargetEvidence({ target: t, universe }),
    );
    const preds = evidence.map((e) => predictG1FromEvidence(e, 10));
    const obs = buildCanonicalObservations(preds);
    const fakeSel: GroupSelectionResult = {
      groupId: "GROUP_MATCH_TOTAL",
      markets: GOALS_MCAL_POC_GROUP_MATCH_TOTAL,
      selectedFamily: "CAL_1",
      reason: "test",
      folds: [],
      meanFoldLlCal0: 0,
      meanFoldLlCal1: 0,
      meanFoldBrierCal0: 0,
      meanFoldBrierCal1: 0,
      meanFoldLlImprovement: 0.01,
      meanFoldBrierDelta: 0,
      meanFoldO05LlWorsen: 0,
      fullDevFit: {
        intercept: 0.05,
        slope: 1.1,
        converged: true,
        iterations: 5,
        fitN: 100,
        positiveN: 50,
        negativeN: 50,
        clippingEpsilon: GOALS_MCAL_POC_LOGIT_EPSILON,
        ridgeLambda: 1e-4,
        parameterDigest: "test",
        finite: true,
      },
      foldFits: [],
      parameterStability: "STABLE",
    };
    const selections = {
      GROUP_MATCH_TOTAL: fakeSel,
      GROUP_HOME_TOTAL: { ...fakeSel, groupId: "GROUP_HOME_TOTAL" as const, selectedFamily: "CAL_0" as const, fullDevFit: null },
      GROUP_AWAY_TOTAL: { ...fakeSel, groupId: "GROUP_AWAY_TOTAL" as const, selectedFamily: "CAL_0" as const, fullDevFit: null },
      BTTS: { ...fakeSel, groupId: "BTTS" as const, selectedFamily: "CAL_0" as const, fullDevFit: null },
    };
    // Fix home/away markets lists
    selections.GROUP_HOME_TOTAL.markets = [
      "HOME_TOTAL_OVER_0_5",
      "HOME_TOTAL_OVER_1_5",
      "HOME_TOTAL_OVER_2_5",
    ];
    selections.GROUP_AWAY_TOTAL.markets = [
      "AWAY_TOTAL_OVER_0_5",
      "AWAY_TOTAL_OVER_1_5",
      "AWAY_TOTAL_OVER_2_5",
    ];
    selections.BTTS.markets = ["BTTS_YES"];

    const cal = applySelectionsToObservations(obs, selections);
    for (const o of cal) {
      expect(Math.abs(o.calibratedProbability + o.complementCalibrated - 1)).toBeLessThan(
        1e-12,
      );
    }
    const o05 = cal.find((o) => o.market === "MATCH_TOTAL_OVER_0_5")!;
    const underActual = 1 - o05.actualBinaryOutcome;
    const is00 =
      o05.actualBinaryOutcome === 0; // Over failed ⇒ total goals < 1 ⇒ 0-0
    expect(underActual === 1).toBe(is00);
  });
});

describe("GOALS-1G.2 adapter and artifacts", () => {
  it("CAL_0 fallback, invalid artifact fallback, parameter digest", () => {
    const protocolDigest = digestGoalsMcalPocProtocol();
    const sel: GroupSelectionResult = {
      groupId: "BTTS",
      markets: ["BTTS_YES"],
      selectedFamily: "CAL_0",
      reason: "test",
      folds: [],
      meanFoldLlCal0: 0.5,
      meanFoldLlCal1: 0.5,
      meanFoldBrierCal0: 0.2,
      meanFoldBrierCal1: 0.2,
      meanFoldLlImprovement: 0,
      meanFoldBrierDelta: 0,
      meanFoldO05LlWorsen: null,
      fullDevFit: {
        intercept: 0,
        slope: 1,
        converged: true,
        iterations: 1,
        fitN: 10,
        positiveN: 5,
        negativeN: 5,
        clippingEpsilon: GOALS_MCAL_POC_LOGIT_EPSILON,
        ridgeLambda: 1e-4,
        parameterDigest: "x",
        finite: true,
      },
      foldFits: [],
      parameterStability: "STABLE",
    };
    const art = buildGroupArtifact({ protocolDigest, selection: sel });
    expect(digestArtifact(art)).toMatch(/^[a-f0-9]{64}$/);

    const id = calibrateGoalsMarketProbabilities({
      market: "BTTS_YES",
      rawProbability: 0.55,
      artifact: art,
      expectedProtocolDigest: protocolDigest,
    });
    expect(id.calibrationApplied).toBe(false);
    expect(id.calibratedProbability).toBe(0.55);

    const bad = calibrateGoalsMarketProbabilities({
      market: "BTTS_YES",
      rawProbability: 0.55,
      artifact: { ...art, protocolDigest: "wrong" },
      expectedProtocolDigest: protocolDigest,
    });
    expect(bad.fallbackReason).toBe("digest_mismatch");
    expect(bad.calibrationApplied).toBe(false);

    const negSlope = calibrateGoalsMarketProbabilities({
      market: "MATCH_TOTAL_OVER_1_5",
      rawProbability: 0.7,
      artifact: {
        ...art,
        group: "GROUP_MATCH_TOTAL",
        calibratorFamily: "CAL_1",
        intercept: 0,
        slope: -1,
      },
      expectedProtocolDigest: protocolDigest,
    });
    expect(negSlope.fallbackReason).toBe("non_positive_slope");
  });
});

describe("GOALS-1G.2 bootstrap and holdout", () => {
  it("bootstrap determinism and holdout rejection", () => {
    const universe = miniUniverse().slice(0, 20);
    const evidence = universe.map((t) =>
      buildGoalsTargetEvidence({ target: t, universe }),
    );
    const preds = evidence.map((e) => predictG1FromEvidence(e, 10));
    const obs = buildCanonicalObservations(preds).map((o) => ({
      ...o,
      calibratedProbability: o.rawProbability,
      complementCalibrated: 1 - o.rawProbability,
      calibratorFamily: "CAL_0" as const,
      groupId: "BTTS" as const,
      calibrationApplied: false,
    }));
    const b1 = bootstrapDeltaMetrics(obs, [
      { key: "BTTS_YES", markets: ["BTTS_YES"] },
    ]);
    const b2 = bootstrapDeltaMetrics(obs, [
      { key: "BTTS_YES", markets: ["BTTS_YES"] },
    ]);
    expect(b1.results[0]!.meanDeltaLl).toBe(b2.results[0]!.meanDeltaLl);

    expect(() =>
      runGoalsMarketCalibrationPoc({
        evidenceRows: [
          {
            ...buildGoalsTargetEvidence({
              target: fx({
                fixtureId: "hold",
                kickoffUtc: "2025-08-01T15:00:00.000Z",
                homeTeamId: "H",
                awayTeamId: "A",
                season: "2025",
              }),
              universe: [
                fx({
                  fixtureId: "h0",
                  kickoffUtc: "2025-07-01T15:00:00.000Z",
                  homeTeamId: "H",
                  awayTeamId: "A",
                  season: "2025",
                }),
              ],
            }),
            season: GOALS_MCAL_POC_HOLDOUT_SEASON,
          },
        ],
        evidenceDatasetDigest: GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);
  });
});

describe("GOALS-1G.2 activation / production", () => {
  it("activation remains false; no production wiring", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(GOALS_MCAL_POC_PRODUCTION_WIRED).toBe(false);
    expect(goalsMcalPocProtocol().researchPocOnly).toBe(true);
  });
});
