/**
 * GOALS-1C — G0 baseline tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestGoalsG0Protocol,
  GOALS_G0_REQUIRED_EVIDENCE_DIGEST,
  goalsG0Protocol,
} from "@/lib/debug/calibration/goals/g0/protocol";
import {
  bttsYesIndependent,
  deriveAnalyticMarkets,
  diagnosticScoreGrid,
  jointScoreLogLoss,
  totalOverProb,
} from "@/lib/debug/calibration/goals/g0/poisson-markets";
import {
  assertG0Coherence,
  predictG0FromEvidence,
} from "@/lib/debug/calibration/goals/g0/predict";
import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { poissonPmf } from "@/lib/intelligence/modules/probability/math/poisson";

function fx(
  partial: Partial<GoalsHistoricalFixture> &
    Pick<GoalsHistoricalFixture, "fixtureId" | "kickoffUtc" | "homeTeamId" | "awayTeamId">,
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

describe("GOALS-1C protocol", () => {
  it("has deterministic digest and pins evidence digest", () => {
    expect(digestGoalsG0Protocol()).toBe(digestGoalsG0Protocol(goalsG0Protocol()));
    expect(GOALS_G0_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("GOALS-1C poisson markets", () => {
  it("analytic O/U 0.5 and BTTS and coherence", () => {
    const muH = 1.4;
    const muA = 1.1;
    const m = deriveAnalyticMarkets(muH, muA);
    expect(m.matchTotals.under05).toBeCloseTo(Math.exp(-(muH + muA)), 12);
    expect(m.matchTotals.over05 + m.matchTotals.under05).toBeCloseTo(1, 12);
    expect(m.btts.yes).toBeCloseTo(bttsYesIndependent(muH, muA), 12);
    expect(m.matchTotals.over05).toBeGreaterThanOrEqual(m.matchTotals.over15);
    expect(m.matchTotals.over15).toBeGreaterThanOrEqual(m.matchTotals.over25);
    expect(totalOverProb(2.5, muH + muA)).toBeCloseTo(m.matchTotals.over25, 12);
    const d = diagnosticScoreGrid(muH, muA);
    expect(d.oneXTwo.home + d.oneXTwo.draw + d.oneXTwo.away).toBeCloseTo(1, 10);
    expect(d.omittedMass).toBeLessThan(1e-6);
    let pmfSum = 0;
    for (let k = 0; k <= 30; k += 1) pmfSum += poissonPmf(k, muH);
    expect(pmfSum).toBeGreaterThan(0.999);
  });

  it("metrics helpers", () => {
    expect(binaryLogLoss(0.5, 1)).toBeCloseTo(-Math.log(0.5), 10);
    expect(binaryBrier(0.25, 0)).toBeCloseTo(0.0625, 10);
    expect(jointScoreLogLoss(0, 0, 1, 1)).toBeCloseTo(
      -Math.log(Math.exp(-2)),
      10,
    );
  });
});

describe("GOALS-1C predict eligibility", () => {
  it("marks opening fixture UNAVAILABLE and later AVAILABLE", () => {
    const opening = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const later = fx({
      fixtureId: "2",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "B",
      awayTeamId: "C",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 1,
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
    });
    const eOpen = buildGoalsTargetEvidence({
      target: opening,
      universe: [opening, later],
    });
    const pOpen = predictG0FromEvidence(eOpen);
    expect(pOpen.predictionStatus).toBe("UNAVAILABLE");

    const eLater = buildGoalsTargetEvidence({
      target: later,
      universe: [opening, later],
    });
    const pLater = predictG0FromEvidence(eLater);
    expect(pLater.predictionStatus).toBe("AVAILABLE");
    expect(pLater.muHome).toBeCloseTo(1, 10); // opening was 1-1? wait opening is 1-1 from defaults
    // opening goals 1-1 => muHome=1, muAway=1
    expect(pLater.muAway).toBeCloseTo(1, 10);
    assertG0Coherence(pLater);

    // future mutation invariance of mu
    const future = fx({
      fixtureId: "3",
      kickoffUtc: "2023-08-25T15:00:00.000Z",
      homeTeamId: "D",
      awayTeamId: "E",
      sourceFulltimeHome: 5,
      sourceFulltimeAway: 5,
      sourceGoalsHome: 5,
      sourceGoalsAway: 5,
    });
    const eLater2 = buildGoalsTargetEvidence({
      target: later,
      universe: [opening, later, future],
    });
    expect(predictG0FromEvidence(eLater2).muHome).toBe(pLater.muHome);
  });
});
