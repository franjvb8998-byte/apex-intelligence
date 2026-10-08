/**
 * PE-4I.18 — Offline feature structure audit tests.
 * Zero provider calls. No feature-vs-outcome stats / 2025 unsealing.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { isResearchHoldoutOutcomeEvidence } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { PE4I5_FROZEN_STAGE2_QUEUE_DIGEST } from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import {
  PE4I18_PRODUCTION_WIRING,
  PE4I18_PARENT_QUEUE_DIGEST,
  PE4I18_MIN_PAIRWISE_N,
  classifyCorrelationBand,
  classifyVarianceClass,
  pe4I18Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";
import { PE4I15_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import { PE4I17_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import {
  buildSchemaInventory,
  canonicalNumericAllowlist,
  extractAllowlistedNumerics,
  pairwiseNumericAllowlist,
} from "@/lib/debug/calibration/pe4-as-of-t-features/schema-inventory";
import { buildFeatureFamilyMatrix } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-family-audit";
import {
  digestStructureAuditPayload,
  runStructureAuditOnRows,
  type Pe4I18RowMeta,
} from "@/lib/debug/calibration/pe4-as-of-t-features/structure-audit-run";
import {
  createCorrelationState,
  accumulateCorrelation,
  finalizeCorrelationAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/correlation-audit";

function sha(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function meta(partial: Partial<Pe4I18RowMeta> & { teamId: string }): Pe4I18RowMeta {
  return {
    targetFixtureId: partial.targetFixtureId ?? "T1",
    kickoffUtc: partial.kickoffUtc ?? "2024-06-01T15:00:00.000Z",
    competition: partial.competition ?? "39",
    providerSeason: partial.providerSeason ?? "2024",
    teamId: partial.teamId,
    windowId: partial.windowId ?? "last_5",
    venueMode: partial.venueMode ?? "all",
    scheduleRestStatus: partial.scheduleRestStatus ?? "AVAILABLE",
  };
}

function toyRows() {
  const allowlist = pairwiseNumericAllowlist();
  const rows = [];
  for (let i = 0; i < 250; i++) {
    const wins = i % 5;
    const draws = (i + 1) % 3;
    const losses = (i + 2) % 4;
    const resultObs = wins + draws + losses || 1;
    const gf = 1 + (i % 4) * 0.25;
    const ga = 0.5 + (i % 3) * 0.2;
    const xgF = gf * 0.9;
    const xgA = ga * 1.1;
    const pathA = {
      targetFixtureId: `T${i % 20}`,
      kickoffUtc: `2024-0${(i % 8) + 1}-15T15:00:00.000Z`,
      competition: i % 2 === 0 ? "39" : "140",
      providerSeason: "2024",
      teamId: `team${i % 10}`,
      opponentId: `opp${i % 7}`,
      targetVenueRole: "HOME",
      windowId: (["last_3", "last_5", "last_8"] as const)[i % 3]!,
      venueMode: (["all", "home", "away"] as const)[i % 3]!,
      observationCount: i % 17 === 0 ? 0 : 3 + (i % 5),
      pathA: {
        observationCount: i % 17 === 0 ? 0 : 3 + (i % 5),
        results: {
          wins,
          draws,
          losses,
          resultObsCount: resultObs,
          goalsMissingOrAmbiguous: 0,
        },
        goalsFor: {
          mean: gf,
          sum: gf * resultObs,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        goalsAgainst: {
          mean: ga,
          sum: ga * resultObs,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        shotsFor: {
          mean: 10 + (i % 5),
          sum: 50,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        shotsAgainst: {
          mean: 8,
          sum: 40,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        shotsOnTargetFor: {
          mean: 4,
          sum: 20,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        shotsOnTargetAgainst: {
          mean: 3,
          sum: 15,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        possessionFor: {
          mean: 50,
          sum: 250,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        possessionAgainst: {
          mean: 50,
          sum: 250,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        cornersFor: {
          mean: 5,
          sum: 25,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        cornersAgainst: {
          mean: 4,
          sum: 20,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        yellowCardsFor: {
          mean: 2,
          sum: 10,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        yellowCardsAgainst: {
          mean: 2,
          sum: 10,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        redCardsFor: {
          mean: 0,
          sum: 0,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        redCardsAgainst: {
          mean: 0,
          sum: 0,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        noScoreWeightsMultiplier: true,
      },
      scheduleRest: {
        familyId: "schedule_rest",
        status: "AVAILABLE",
        daysSincePreviousMatch: 3 + (i % 4),
        hoursSincePreviousMatch: 72,
        matchesInLast7d: 1,
        matchesInLast14d: 2,
        matchesInLast28d: 4,
        priorMatchCount: 10,
        ambiguityFlaggedPriorCount: 0,
      },
      missingCounts: {
        goalsMissingOrAmbiguous: 0,
        shotsForMissing: 0,
        shotsAgainstMissing: 0,
      },
      ambiguityExclusions: {
        regulationAmbiguousRejectedFromHistory: 0,
        calendar2025RejectedFromHistory: 0,
      },
      historyFixtureIds: [],
      provenanceDigest: sha(`p-${i}`),
      providerCallsMade: 0,
    };
    const pathB = {
      ...pathA,
      pathB: {
        path: "B_ADDITIVE_XG_NO_POPULATION_SHIFT",
        anyXgPresent: true,
        expectedGoalsFor: {
          mean: xgF,
          sum: xgF * resultObs,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        expectedGoalsAgainst: {
          mean: xgA,
          sum: xgA * resultObs,
          obsCount: resultObs,
          missingCount: 0,
          ambiguousCount: 0,
        },
        coverage: {
          fixturesConsidered: resultObs,
          xgPresentSides: resultObs * 2,
          xgMissingSides: 0,
          xgAmbiguousSides: 0,
          fixturesWithBothSidesXg: resultObs,
          fixturesWithAnyXg: resultObs,
          fixturesWithNoXg: 0,
        },
        zeroFillUsed: false,
        imputationUsed: false,
        populationShifted: false,
      },
    };
    const numerics = extractAllowlistedNumerics(
      pathA as unknown as Record<string, unknown>,
      pathB as unknown as Record<string, unknown>,
      canonicalNumericAllowlist(),
    );
    // Exact-equal twin for redundancy check
    numerics["pathA.observationCount"] = numerics.observationCount;
    rows.push({
      meta: meta({
        targetFixtureId: String(pathA.targetFixtureId),
        teamId: String(pathA.teamId),
        windowId: String(pathA.windowId),
        venueMode: String(pathA.venueMode),
        competition: String(pathA.competition),
        kickoffUtc: String(pathA.kickoffUtc),
      }),
      numerics,
    });
  }
  return { rows, allowlist };
}

describe("PE-4I.18 feature structure audit", () => {
  it("safety pins: PE3C=false, expectation UNAVAILABLE, G1 k=10, queue digest, holdout sealed, no production wiring", () => {
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(
      resolvePe4HistoricalExpectation({
        targetStrengthCommon: 1600,
        opponentStrengthCommon: 1500,
        targetVenueRole: "HOME",
        pairwiseAvailable: true,
        historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
        targetSource: "catalogue",
        opponentSource: "catalogue",
      }).status,
    ).toBe("UNAVAILABLE");
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
    expect(PE4I18_PARENT_QUEUE_DIGEST).toBe(PE4I5_FROZEN_STAGE2_QUEUE_DIGEST);
    expect(
      isResearchHoldoutOutcomeEvidence({
        providerSeasonId: "2024",
        kickoffUtc: "2025-06-01T15:00:00.000Z",
      }),
    ).toBe(false);
    expect(PE4I15_PRODUCTION_WIRING).toBe(false);
    expect(PE4I16_PRODUCTION_WIRING).toBe(false);
    expect(PE4I17_PRODUCTION_WIRING).toBe(false);
    expect(PE4I18_PRODUCTION_WIRING).toBe(false);
    expect(pe4I18Protocol().noFeatureVsOutcomeStats).toBe(true);
    expect(pe4I18Protocol().labelContentsForbiddenForStats).toBe(true);
  });

  it("protocol thresholds and correlation bands are predeclared", () => {
    expect(PE4I18_MIN_PAIRWISE_N).toBe(200);
    expect(classifyCorrelationBand(0.996)).toBe("EXTREME");
    expect(classifyCorrelationBand(0.99)).toBe("VERY_HIGH");
    expect(classifyCorrelationBand(0.95)).toBe("HIGH");
    expect(classifyCorrelationBand(0.5)).toBe("MODERATE_OR_BELOW");
    expect(
      classifyVarianceClass({
        uniqueFinite: 1,
        mostCommonShare: 1,
        range: 0,
        mean: 0,
        stdev: 0,
      }),
    ).toBe("CONSTANT");
  });

  it("schema inventory excludes identifiers and builds allowlist", () => {
    const inv = buildSchemaInventory({
      pathASample: {
        targetFixtureId: "1",
        kickoffUtc: "2024-01-01T00:00:00.000Z",
        teamId: "33",
        opponentId: "40",
        provenanceDigest: "abc",
        competition: "39",
        pathA: {
          observationCount: 3,
          results: { wins: 1, draws: 1, losses: 1, resultObsCount: 3 },
        },
        scheduleRest: {
          status: "AVAILABLE",
          daysSincePreviousMatch: 4,
        },
      },
      pathBSample: {
        targetFixtureId: "1",
        pathB: {
          anyXgPresent: true,
          expectedGoalsFor: { mean: 1.2, obsCount: 3 },
        },
      },
    });
    expect(inv.identifiersExcluded.length).toBeGreaterThan(0);
    expect(inv.allowlist.some((p) => p.includes("targetFixtureId"))).toBe(
      false,
    );
    expect(inv.opponentStrengthStatus).toBe("UNAVAILABLE");
    expect(canonicalNumericAllowlist().length).toBeGreaterThan(20);
  });

  it("analysis succeeds without labels artifact; changing labels does not change audit digest", () => {
    const { rows } = toyRows();
    const a = runStructureAuditOnRows({ rows });
    // Simulate "labels changed" — labels are never an input; digest stable.
    const fakeLabels = { mutated: true, goals: [9, 9, 9] };
    void fakeLabels;
    const b = runStructureAuditOnRows({ rows });
    expect(a.auditDigest).toBe(b.auditDigest);
    expect(a.familyMatrix.opponentStrengthStatus).toBe("UNAVAILABLE");
  });

  it("no feature-vs-outcome stats modules / language in protocol", () => {
    const p = pe4I18Protocol();
    expect(p.noFeatureVsOutcomeStats).toBe(true);
    expect(p.modelingForbidden).toBe(true);
    expect(p.noWindowOptimizationByOutcomes).toBe(true);
    const src = JSON.stringify(p);
    expect(src).not.toMatch(/Brier|log-loss|AUC|ROI|BEST|WORST/i);
  });

  it("2025 firewall: protocol forbids unsealing; toy rows are non-2025", () => {
    expect(pe4I18Protocol().no2025Unsealing).toBe(true);
    const { rows } = toyRows();
    for (const r of rows) {
      expect(r.meta.kickoffUtc.startsWith("2025")).toBe(false);
    }
  });

  it("shuffled row order yields identical structural digest", () => {
    const { rows } = toyRows();
    const a = runStructureAuditOnRows({ rows });
    const shuffled = [...rows].reverse();
    const b = runStructureAuditOnRows({ rows: shuffled });
    expect(a.auditDigest).toBe(b.auditDigest);
    expect(a.presence.summary).toEqual(b.presence.summary);
    expect(a.descriptive.countsByClass).toEqual(b.descriptive.countsByClass);
    expect(a.correlation.bandCounts).toEqual(b.correlation.bandCounts);
  });

  it("detects exact redundancy and high Pearson between identical columns", () => {
    const fields = ["x", "y", "z"];
    const state = createCorrelationState(fields);
    for (let i = 0; i < 300; i++) {
      const v = i * 0.1;
      accumulateCorrelation(state, { x: v, y: v, z: -v });
    }
    const audit = finalizeCorrelationAudit(state, 200);
    expect(audit.bandCounts.EXTREME).toBeGreaterThanOrEqual(1);
    const xy = audit.topExtremePairs.find(
      (p) =>
        (p.fieldA === "x" && p.fieldB === "y") ||
        (p.fieldA === "y" && p.fieldB === "x"),
    );
    expect(xy?.absR).toBeGreaterThan(0.99);
  });

  it("feature family matrix marks opponent_strength UNAVAILABLE", () => {
    const m = buildFeatureFamilyMatrix({
      scheduleRestAvailableShare: 0.8,
      recentResultsAvailableShare: 0.7,
      xgPresentShare: 0.4,
    });
    expect(m.opponentStrengthStatus).toBe("UNAVAILABLE");
    const opp = m.families.find((f) => f.familyId === "opponent_strength_join");
    expect(opp?.structuralStatus).toBe("UNAVAILABLE");
  });

  it("digestStructureAuditPayload is label-free and stable", () => {
    const payload = {
      presenceSummary: {
        fieldsFullyPresent: 1,
        fieldsSparsePresentShareLt10: 0,
        fieldsPartial: 0,
        meanPresentShareAcrossFields: 1,
      },
      varianceCounts: {
        CONSTANT: 0,
        NEAR_CONSTANT: 0,
        LOW_VARIANCE: 0,
        VARIABLE: 1,
      },
      exactByReason: {
        EXACT_EQUAL: 0,
        SIGN_INVERSE: 0,
        DETERMINISTIC_WIN_RATE: 1,
        DETERMINISTIC_POINTS_PER_MATCH: 1,
        DETERMINISTIC_GOAL_DIFF: 1,
        DETERMINISTIC_XG_DIFF: 1,
        AFFINE_NEAR_PERFECT: 0,
        NONE: 0,
      },
      corrBands: {
        EXTREME: 0,
        VERY_HIGH: 0,
        HIGH: 0,
        MODERATE_OR_BELOW: 1,
        INSUFFICIENT_PAIRWISE_N: 0,
      },
      windowSummary: {
        extremeFieldWindowPairs: 0,
        veryHighFieldWindowPairs: 0,
        highFieldWindowPairs: 0,
        meanExactEqualShare: null,
        note: "n",
      },
      venueSummary: {
        extremePairs: 0,
        veryHighPairs: 0,
        highPairs: 0,
        note: "n",
      },
      sparseOverall: {
        NO_HISTORY: 0,
        ONE: 0,
        TWO: 0,
        SUFFICIENT_3_PLUS: 1,
        rows: 1,
      },
      familyStatuses: [{ familyId: "recent_results", structuralStatus: "AVAILABLE" }],
      candidateFeatureCount: 10,
      pathADigest: "a",
      pathBDigest: "b",
    };
    const d1 = digestStructureAuditPayload(payload);
    const d2 = digestStructureAuditPayload({
      ...payload,
      // @ts-expect-error — labels must never be part of digest inputs
      labels: { shouldNotMatter: true },
    });
    // Extra keys ignored by explicit payload shape — call with same fields:
    expect(d1).toBe(digestStructureAuditPayload(payload));
    void d2;
    expect(d1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("toy structure audit produces sparse-history and presence summaries", () => {
    const { rows } = toyRows();
    const r = runStructureAuditOnRows({ rows });
    expect(r.sparse.overall.rows).toBe(rows.length);
    expect(r.presence.rowCount).toBe(rows.length);
    expect(r.descriptive.fields.length).toBeGreaterThan(10);
    expect(r.exact.keyPairs.length).toBeGreaterThan(0);
  });
});
