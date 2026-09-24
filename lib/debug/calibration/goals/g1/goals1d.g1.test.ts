/**
 * GOALS-1D — G1 attack/defense Poisson tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestGoalsG1Protocol,
  GOALS_G1_PARENT_G0_PROTOCOL_DIGEST,
  GOALS_G1_REQUIRED_EVIDENCE_DIGEST,
  GOALS_G1_SHRINKAGE_CANDIDATES,
  goalsG1Protocol,
} from "@/lib/debug/calibration/goals/g1/protocol";
import {
  computeAttackDefenseMus,
  shrunkRate,
  shrunkStrength,
} from "@/lib/debug/calibration/goals/g1/strengths";
import {
  assertG1Coherence,
  predictG1FromEvidence,
} from "@/lib/debug/calibration/goals/g1/predict";
import { selectShrinkageKOnDevelopment } from "@/lib/debug/calibration/goals/g1/evaluate";
import { compareCommonCoverage } from "@/lib/debug/calibration/goals/g1/metrics";
import { predictG0FromEvidence } from "@/lib/debug/calibration/goals/g0/predict";
import { digestGoalsG0Protocol, goalsG0Protocol } from "@/lib/debug/calibration/goals/g0/protocol";
import { deriveAnalyticMarkets } from "@/lib/debug/calibration/goals/g0/poisson-markets";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

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

describe("GOALS-1D protocol", () => {
  it("pins parent digests and freezes candidate family", () => {
    expect(GOALS_G1_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(GOALS_G1_PARENT_G0_PROTOCOL_DIGEST).toBe(
      digestGoalsG0Protocol(goalsG0Protocol()),
    );
    expect([...GOALS_G1_SHRINKAGE_CANDIDATES]).toEqual([2, 5, 10]);
    expect(digestGoalsG1Protocol(goalsG1Protocol(null))).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(null)),
    );
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("GOALS-1D strengths", () => {
  it("shrinkage exact values and n=0 BASE_PRIOR", () => {
    expect(shrunkRate(4, 2, 2, 1.5)).toBeCloseTo((8 + 3) / 6, 12);
    const z = shrunkStrength(0, null, 5, 1.4);
    expect(z.strength).toBe(1);
    expect(z.usedBasePrior).toBe(true);
  });

  it("defense orientation: >1 concedes more than average", () => {
    const comps = computeAttackDefenseMus({
      leagueHomeRate: 1.5,
      leagueAwayRate: 1.2,
      homeAttackPlayed: 10,
      homeAttackObserved: 1.5,
      homeDefensePlayed: 10,
      homeDefenseObserved: 2.4, // concedes 2x league away rate
      awayAttackPlayed: 10,
      awayAttackObserved: 1.2,
      awayDefensePlayed: 10,
      awayDefenseObserved: 1.5,
      shrinkageK: 0,
    });
    expect(comps.homeDefenseStrength).toBeCloseTo(2, 10);
    expect(comps.homeDefenseStrength).toBeGreaterThan(1);
    // muAway = La * aa * hd = 1.2 * 1 * 2 = 2.4
    expect(comps.muAway).toBeCloseTo(2.4, 10);
  });

  it("expected goals multiplicative formula", () => {
    const comps = computeAttackDefenseMus({
      leagueHomeRate: 1.6,
      leagueAwayRate: 1.2,
      homeAttackPlayed: 8,
      homeAttackObserved: 2.0,
      homeDefensePlayed: 8,
      homeDefenseObserved: 0.9,
      awayAttackPlayed: 8,
      awayAttackObserved: 1.5,
      awayDefensePlayed: 8,
      awayDefenseObserved: 1.2,
      shrinkageK: 0,
    });
    expect(comps.homeAttackStrength).toBeCloseTo(2.0 / 1.6, 10);
    expect(comps.awayDefenseStrength).toBeCloseTo(1.2 / 1.6, 10);
    expect(comps.muHome).toBeCloseTo(
      1.6 * (2.0 / 1.6) * (1.2 / 1.6),
      10,
    );
    expect(comps.muAway).toBeCloseTo(
      1.2 * (1.5 / 1.2) * (0.9 / 1.2),
      10,
    );
  });
});

describe("GOALS-1D predict", () => {
  it("opening fixture uses BASE_PRIOR strengths when league exists", () => {
    const opening = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const mid = fx({
      fixtureId: "2",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "B",
      awayTeamId: "C",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 2,
      sourceGoalsAway: 0,
    });
    const eOpen = buildGoalsTargetEvidence({
      target: opening,
      universe: [opening, mid],
    });
    const pOpen = predictG1FromEvidence(eOpen, 5);
    expect(pOpen.predictionStatus).toBe("UNAVAILABLE");

    const eMid = buildGoalsTargetEvidence({
      target: mid,
      universe: [opening, mid],
    });
    const pMid = predictG1FromEvidence(eMid, 5);
    expect(pMid.predictionStatus).toBe("AVAILABLE");
    // Teams B and C have n=0 venue history at mid; league rates from opening 1-1
    expect(pMid.lowInformationFallbackUsed).toBe(true);
    expect(pMid.homeAttackStrength).toBe(1);
    expect(pMid.awayAttackStrength).toBe(1);
    expect(pMid.muHome).toBeCloseTo(1, 10); // opening was 1-1
    expect(pMid.muAway).toBeCloseTo(1, 10);
    expect(pMid.noExplicitHfa).toBe(true);
    expect(pMid.noOpponentAdjustment).toBe(true);
    assertG1Coherence(pMid);
  });

  it("team-specific discrimination and temporal invariance", () => {
    const f1 = fx({
      fixtureId: "10",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "STRONG",
      awayTeamId: "WEAK",
      sourceFulltimeHome: 3,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 3,
      sourceGoalsAway: 0,
    });
    const f2 = fx({
      fixtureId: "11",
      kickoffUtc: "2023-08-12T15:00:00.000Z",
      homeTeamId: "WEAK",
      awayTeamId: "STRONG",
      sourceFulltimeHome: 0,
      sourceFulltimeAway: 2,
      sourceGoalsHome: 0,
      sourceGoalsAway: 2,
    });
    const target = fx({
      fixtureId: "12",
      kickoffUtc: "2023-08-19T15:00:00.000Z",
      homeTeamId: "STRONG",
      awayTeamId: "WEAK",
    });
    const other = fx({
      fixtureId: "13",
      kickoffUtc: "2023-08-19T15:00:00.000Z",
      homeTeamId: "WEAK",
      awayTeamId: "STRONG",
    });
    const universe = [f1, f2, target, other];
    const eStrongHome = buildGoalsTargetEvidence({ target, universe });
    const eWeakHome = buildGoalsTargetEvidence({ target: other, universe });
    const pStrong = predictG1FromEvidence(eStrongHome, 2);
    const pWeak = predictG1FromEvidence(eWeakHome, 2);
    expect(pStrong.predictionStatus).toBe("AVAILABLE");
    expect(pWeak.predictionStatus).toBe("AVAILABLE");
    expect(pStrong.muHome).not.toBeCloseTo(pWeak.muHome!, 5);
    expect(pStrong.expectedTotalGoals).not.toBeCloseTo(
      pWeak.expectedTotalGoals!,
      5,
    );

    const future = fx({
      fixtureId: "99",
      kickoffUtc: "2023-09-01T15:00:00.000Z",
      homeTeamId: "STRONG",
      awayTeamId: "WEAK",
      sourceFulltimeHome: 8,
      sourceFulltimeAway: 8,
      sourceGoalsHome: 8,
      sourceGoalsAway: 8,
    });
    const e2 = buildGoalsTargetEvidence({
      target,
      universe: [...universe, future],
    });
    expect(predictG1FromEvidence(e2, 2).muHome).toBe(pStrong.muHome);
  });

  it("reuses G0 poisson market contract", () => {
    const m = deriveAnalyticMarkets(1.7, 1.1);
    expect(m.matchTotals.under05).toBeCloseTo(Math.exp(-(1.7 + 1.1)), 12);
    expect(m.btts.yes + m.btts.no).toBeCloseTo(1, 12);
  });
});

describe("GOALS-1D selection and comparison", () => {
  it("selects k from 2023 only and rejects holdout", () => {
    const rows: GoalsHistoricalFixture[] = [];
    // Build a tiny 2023 universe with enough labeled targets
    for (let i = 0; i < 6; i += 1) {
      rows.push(
        fx({
          fixtureId: `s${i}`,
          kickoffUtc: `2023-08-${String(11 + i).padStart(2, "0")}T15:00:00.000Z`,
          homeTeamId: i % 2 === 0 ? "H1" : "H2",
          awayTeamId: i % 2 === 0 ? "A1" : "A2",
          sourceFulltimeHome: 1 + (i % 3),
          sourceFulltimeAway: i % 2,
          sourceGoalsHome: 1 + (i % 3),
          sourceGoalsAway: i % 2,
        }),
      );
    }
    const evidence = rows.map((target) =>
      buildGoalsTargetEvidence({ target, universe: rows }),
    );
    const sel = selectShrinkageKOnDevelopment(evidence);
    expect(GOALS_G1_SHRINKAGE_CANDIDATES).toContain(sel.selectedK);
    expect(sel.candidates).toHaveLength(3);

    const holdout = fx({
      fixtureId: "hold",
      kickoffUtc: "2025-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      season: "2025",
    });
    expect(() =>
      selectShrinkageKOnDevelopment([
        ...evidence,
        buildGoalsTargetEvidence({
          target: holdout,
          universe: [holdout],
        }),
      ]),
    ).toThrow(/Holdout/);
  });

  it("common-coverage comparison is deterministic", () => {
    const f1 = fx({
      fixtureId: "a",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const f2 = fx({
      fixtureId: "b",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 1,
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
    });
    const e = buildGoalsTargetEvidence({
      target: f2,
      universe: [f1, f2],
    });
    const g0 = [predictG0FromEvidence(e)];
    const g1 = [predictG1FromEvidence(e, 5)];
    const c1 = compareCommonCoverage({ g0, g1 });
    const c2 = compareCommonCoverage({ g0, g1 });
    expect(c1.commonN).toBe(1);
    expect(c1.delta.jointScoreLogLoss).toBe(c2.delta.jointScoreLogLoss);
  });
});
