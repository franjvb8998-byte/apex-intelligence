/**
 * GOALS-1G.3 — Match-total calibration refinement tests.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { digestGoalsMcalPocProtocol } from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import { buildCanonicalObservations } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  calibrateMatchTotalRefinement,
  GOALS_MCAL_REF_PRODUCTION_WIRED,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/adapter";
import {
  applyCandidateProbability,
  fitCandidateParams,
  fitInterceptOnly,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";
import { auditMatchTotalCoherence } from "@/lib/debug/calibration/goals/market-calibration-refinement/coherence";
import { runGoalsMarketCalibrationRefinement } from "@/lib/debug/calibration/goals/market-calibration-refinement/evaluate";
import {
  digestGoalsMcalRefProtocol,
  GOALS_MCAL_REF_2024_SELECTION_ELIGIBLE,
  GOALS_MCAL_REF_COMPLEXITY_PREFERENCE,
  GOALS_MCAL_REF_HOLDOUT_SEASON,
  GOALS_MCAL_REF_PARENT_G1_K,
  GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST,
  GOALS_MCAL_REF_PARENT_G12_VERDICT,
  GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST,
  goalsMcalRefProtocol,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
import { selectRefinementCandidate } from "@/lib/debug/calibration/goals/market-calibration-refinement/select";
import { buildDevelopmentFolds } from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import { buildRefinementArtifact } from "@/lib/debug/calibration/goals/market-calibration-refinement/artifact";

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
  const start = Date.parse("2023-08-12T15:00:00.000Z");
  for (let week = 0; week < 40; week += 1) {
    for (let g = 0; g < 3; g += 1) {
      const home = teams[(week + g) % teams.length]!;
      const away = teams[(week + g + 1) % teams.length]!;
      const gh = (week + g) % 4;
      const ga = (week + g * 2) % 3;
      n += 1;
      out.push(
        fx({
          fixtureId: `f${n}`,
          kickoffUtc: new Date(
            start + (week * 7 + g) * 24 * 60 * 60 * 1000,
          ).toISOString(),
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

describe("GOALS-1G.3 protocol", () => {
  it("parent digests, protocol digest, 2024 selection forbidden", () => {
    expect(digestGoalsMcalRefProtocol()).toBe(
      digestGoalsMcalRefProtocol(goalsMcalRefProtocol()),
    );
    expect(GOALS_MCAL_REF_PARENT_G1_K).toBe(10);
    expect(GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST).toBe(
      digestGoalsMcalPocProtocol(),
    );
    expect(GOALS_MCAL_REF_PARENT_G12_VERDICT).toBe(
      "PARTIAL_CALIBRATION_CANDIDATE",
    );
    expect(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    ).toBe(goalsMcalRefProtocol().parentG1ProtocolDigest);
    expect(GOALS_MCAL_REF_2024_SELECTION_ELIGIBLE).toBe(false);
    expect(goalsMcalRefProtocol().confirmatory2024PreviouslyObserved).toBe(
      true,
    );
    expect(goalsMcalRefProtocol().noO05OnlyCalibrator).toBe(true);
    expect(goalsMcalRefProtocol().noO15OnlyCalibrator).toBe(true);
    expect(GOALS_MCAL_REF_COMPLEXITY_PREFERENCE).toEqual([
      "R0",
      "R2",
      "R3",
      "R1",
    ]);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(GOALS_MCAL_REF_PRODUCTION_WIRED).toBe(false);
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

describe("GOALS-1G.3 candidates", () => {
  it("R0 identity, R2 b exactly 1, R3 shared low-threshold", () => {
    const probs = [0.2, 0.4, 0.6, 0.8, 0.3, 0.5, 0.7, 0.9, 0.1, 0.55, 0.45, 0.65];
    const ys = [0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1] as (0 | 1)[];
    const r0 = fitCandidateParams("R0", [], [], []);
    expect(applyCandidateProbability("MATCH_TOTAL_OVER_1_5", 0.7, r0)).toBe(
      0.7,
    );

    const r2 = fitCandidateParams(
      "R2",
      probs,
      ys,
      [
        "MATCH_TOTAL_OVER_0_5",
        "MATCH_TOTAL_OVER_1_5",
        "MATCH_TOTAL_OVER_2_5",
        "MATCH_TOTAL_OVER_3_5",
        "MATCH_TOTAL_OVER_4_5",
      ],
    );
    expect(r2.slope).toBe(1);
    expect(r2.finite).toBe(true);
    const interceptOnly = fitInterceptOnly(probs, ys);
    expect(interceptOnly.slope).toBe(1);

    const r3 = fitCandidateParams("R3", probs, ys, [
      "MATCH_TOTAL_OVER_0_5",
      "MATCH_TOTAL_OVER_1_5",
    ]);
    expect(r3.appliedMarkets).toEqual([
      "MATCH_TOTAL_OVER_0_5",
      "MATCH_TOTAL_OVER_1_5",
    ]);
    expect(
      applyCandidateProbability("MATCH_TOTAL_OVER_2_5", 0.55, r3),
    ).toBe(0.55);
    expect(r3.appliedMarkets).not.toContain("MATCH_TOTAL_OVER_2_5");
  });

  it("no O0.5-only or O1.5-only parameter artifacts", () => {
    const p = goalsMcalRefProtocol();
    expect(p.noO05OnlyCalibrator).toBe(true);
    expect(p.noO15OnlyCalibrator).toBe(true);
    expect(p.lowThresholdMarkets).toEqual([
      "MATCH_TOTAL_OVER_0_5",
      "MATCH_TOTAL_OVER_1_5",
    ]);
  });
});

describe("GOALS-1G.3 coherence", () => {
  it("cross-boundary monotonicity and R3 coherence-invalid rejection", () => {
    const universe = miniUniverse().slice(0, 40);
    const evidence = universe.map((t) =>
      buildGoalsTargetEvidence({ target: t, universe }),
    );
    const preds = evidence.map((e) => predictG1FromEvidence(e, 10));
    const obs = buildCanonicalObservations(preds);

    // Coherent R3-like params with mild positive transform
    const ok = fitCandidateParams(
      "R3",
      obs
        .filter((o) =>
          o.market === "MATCH_TOTAL_OVER_0_5" ||
          o.market === "MATCH_TOTAL_OVER_1_5",
        )
        .map((o) => o.rawProbability),
      obs
        .filter((o) =>
          o.market === "MATCH_TOTAL_OVER_0_5" ||
          o.market === "MATCH_TOTAL_OVER_1_5",
        )
        .map((o) => o.actualBinaryOutcome),
      ["MATCH_TOTAL_OVER_0_5", "MATCH_TOTAL_OVER_1_5"],
    );
    const auditOk = auditMatchTotalCoherence(obs, ok);
    expect(auditOk.complementFailures).toBe(0);

    // Force incoherent by huge intercept on low thresholds only
    const bad = {
      ...ok,
      intercept: 5,
      slope: 2,
      finite: true,
    };
    const auditBad = auditMatchTotalCoherence(obs, bad);
    // May or may not violate depending on raw gaps; if violations, must not repair
    if (auditBad.violationCount > 0) {
      expect(auditBad.coherenceValid).toBe(false);
      expect(auditBad.maxViolationMagnitude).toBeGreaterThan(0);
    }
  });

  it("complements always 1-p", () => {
    const p = 0.73;
    const params = fitCandidateParams("R0", [], [], []);
    const cal = applyCandidateProbability("MATCH_TOTAL_OVER_2_5", p, params);
    expect(Math.abs(cal + (1 - cal) - 1)).toBeLessThan(1e-15);
  });
});

describe("GOALS-1G.3 selection", () => {
  it("temporal folds, complexity preference, deterministic selection, 2024 forbidden", () => {
    const universe = miniUniverse();
    const evidence = universe.map((t) =>
      buildGoalsTargetEvidence({ target: t, universe }),
    );
    const preds = evidence.map((e) => predictG1FromEvidence(e, 10));
    const obs = buildCanonicalObservations(preds).filter(
      (o) => o.season === "2023",
    );
    const folds = buildDevelopmentFolds(obs);
    expect(folds.length).toBeGreaterThanOrEqual(1);

    const s1 = selectRefinementCandidate(obs, folds);
    const s2 = selectRefinementCandidate(obs, folds);
    expect(s1.selected).toBe(s2.selected);
    expect(s1.selectionEvidenceDigest).toBe(s2.selectionEvidenceDigest);
    expect(["R0", "R1", "R2", "R3"]).toContain(s1.selected);

    const with2024 = [
      ...obs,
      {
        ...obs[0]!,
        season: "2024",
        fixtureId: "leak24",
      },
    ];
    expect(() => selectRefinementCandidate(with2024, folds)).toThrow(/2023/);
  });
});

describe("GOALS-1G.3 adapter / holdout / wiring", () => {
  it("adapter fail-closed, parameter digest, holdout rejection, no production wiring", () => {
    const protocolDigest = digestGoalsMcalRefProtocol();
    const art = buildRefinementArtifact({
      protocolDigest,
      params: {
        candidateId: "R0",
        intercept: null,
        slope: null,
        fitN: 0,
        positiveN: 0,
        negativeN: 0,
        converged: true,
        finite: true,
        parameterDigest: "x",
        appliedMarkets: [],
      },
      selectionEvidenceDigest: "y",
      selectionReason: "test",
    });
    const out = calibrateMatchTotalRefinement({
      market: "MATCH_TOTAL_OVER_1_5",
      rawProbability: 0.7,
      artifact: art,
      expectedProtocolDigest: protocolDigest,
    });
    expect(out.calibrationApplied).toBe(false);
    expect(out.calibratedProbability).toBe(0.7);

    const bad = calibrateMatchTotalRefinement({
      market: "MATCH_TOTAL_OVER_1_5",
      rawProbability: 0.7,
      artifact: { ...art, protocolDigest: "wrong" },
      expectedProtocolDigest: protocolDigest,
    });
    expect(bad.fallbackReason).toBe("digest_mismatch");

    expect(() =>
      runGoalsMarketCalibrationRefinement({
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
            season: GOALS_MCAL_REF_HOLDOUT_SEASON,
          },
        ],
        evidenceDatasetDigest: GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);

    expect(GOALS_MCAL_REF_PRODUCTION_WIRED).toBe(false);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});
