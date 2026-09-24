/**
 * GOALS-1E — G3 opponent-adjusted attack/defense tests.
 */

import { describe, expect, it } from "vitest";
import {
  digestGoalsG3Protocol,
  GOALS_G3_FROZEN_SHRINKAGE_K,
  GOALS_G3_PARENT_G0_PROTOCOL_DIGEST,
  GOALS_G3_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_G3_REQUIRED_EVIDENCE_DIGEST,
  goalsG3Protocol,
} from "@/lib/debug/calibration/goals/g3/protocol";
import {
  attackAdjustmentFactor,
  defenseAdjustmentFactor,
  normalizeOpponentQuality,
} from "@/lib/debug/calibration/goals/g3/adjustment";
import {
  goalsFixtureToStrengthUniverse,
  listVenueRolePriorsWithOpponents,
} from "@/lib/debug/calibration/goals/g3/opponent-attach";
import { predictG3FromEvidence } from "@/lib/debug/calibration/goals/g3/predict";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { digestGoalsG0Protocol, goalsG0Protocol } from "@/lib/debug/calibration/goals/g0/protocol";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { makeAdjustmentFns } from "@/lib/debug/calibration/goals/g3/adjustment";

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

describe("GOALS-1E protocol", () => {
  it("pins parents and freezes k=10", () => {
    expect(GOALS_G3_REQUIRED_EVIDENCE_DIGEST).toBe(
      "e06c44a6697960eeddd9b20d33cedddda53847285f828971145793f1b7505b95",
    );
    expect(GOALS_G3_PARENT_G0_PROTOCOL_DIGEST).toBe(
      digestGoalsG0Protocol(goalsG0Protocol()),
    );
    expect(GOALS_G3_PARENT_G1_PROTOCOL_DIGEST).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_G3_FROZEN_SHRINKAGE_K).toBe(10);
    expect(digestGoalsG3Protocol(goalsG3Protocol(null))).toBe(
      digestGoalsG3Protocol(goalsG3Protocol(null)),
    );
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});

describe("GOALS-1E adjustment orientation", () => {
  it("neutral point is 1 and beta=0 is identity", () => {
    expect(
      attackAdjustmentFactor({
        strength: 1700,
        source: "catalogue",
        beta: 0,
        center: 1600,
      }),
    ).toBe(1);
    expect(
      defenseAdjustmentFactor({
        strength: 1400,
        source: "catalogue",
        beta: 0,
        center: 1600,
      }),
    ).toBe(1);
    expect(
      attackAdjustmentFactor({
        strength: 1600,
        source: "catalogue",
        beta: 0.1,
        center: 1600,
      }),
    ).toBeCloseTo(1, 12);
  });

  it("attack inflates vs stronger; defense deflates vs stronger", () => {
    const atkStrong = attackAdjustmentFactor({
      strength: 1700,
      source: "catalogue",
      beta: 0.1,
      center: 1600,
    });
    const atkWeak = attackAdjustmentFactor({
      strength: 1500,
      source: "catalogue",
      beta: 0.1,
      center: 1600,
    });
    expect(atkStrong).toBeGreaterThan(1);
    expect(atkWeak).toBeLessThan(1);
    // Scoring 2 vs strong counts more than scoring 2 vs weak
    expect(2 * atkStrong).toBeGreaterThan(2 * atkWeak);

    const defStrong = defenseAdjustmentFactor({
      strength: 1700,
      source: "catalogue",
      beta: 0.1,
      center: 1600,
    });
    const defWeak = defenseAdjustmentFactor({
      strength: 1500,
      source: "catalogue",
      beta: 0.1,
      center: 1600,
    });
    expect(defStrong).toBeLessThan(1);
    expect(defWeak).toBeGreaterThan(1);
    // Conceding 2 vs strong counts less against you than vs weak
    expect(2 * defStrong).toBeLessThan(2 * defWeak);
  });

  it("base_prior and unavailable are neutral", () => {
    expect(
      attackAdjustmentFactor({
        strength: 1800,
        source: "base_prior",
        beta: 0.2,
        center: 1600,
      }),
    ).toBe(1);
    expect(
      defenseAdjustmentFactor({
        strength: null,
        source: "unavailable",
        beta: 0.2,
        center: 1600,
      }),
    ).toBe(1);
  });

  it("normalize is finite", () => {
    expect(normalizeOpponentQuality(1680, 1580, 100)).toBeCloseTo(1, 12);
  });
});

describe("GOALS-1E temporal opponent strength", () => {
  it("excludes M and post-M; includes pre-M; same-kickoff excluded", () => {
    const oppPre = fx({
      fixtureId: "opp-pre",
      kickoffUtc: "2023-08-01T15:00:00.000Z",
      homeTeamId: "OPP",
      awayTeamId: "OTHER",
      sourceFulltimeHome: 3,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 3,
      sourceGoalsAway: 0,
    });
    const matchM = fx({
      fixtureId: "M",
      kickoffUtc: "2023-08-10T15:00:00.000Z",
      homeTeamId: "TEAM",
      awayTeamId: "OPP",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 1,
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
    });
    const sameKo = fx({
      fixtureId: "same-ko",
      kickoffUtc: "2023-08-10T15:00:00.000Z",
      homeTeamId: "OPP",
      awayTeamId: "Z",
      sourceFulltimeHome: 5,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 5,
      sourceGoalsAway: 0,
    });
    const postM = fx({
      fixtureId: "post-M",
      kickoffUtc: "2023-08-15T15:00:00.000Z",
      homeTeamId: "OPP",
      awayTeamId: "Z",
      sourceFulltimeHome: 4,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 4,
      sourceGoalsAway: 0,
    });
    const target = fx({
      fixtureId: "T",
      kickoffUtc: "2023-08-20T15:00:00.000Z",
      homeTeamId: "TEAM",
      awayTeamId: "AWAY",
    });
    const universe = [oppPre, matchM, sameKo, postM, target];
    const strengthU = goalsFixtureToStrengthUniverse(universe);
    const fns = makeAdjustmentFns({ beta: 0, center: 1580 });

    const contrib = listVenueRolePriorsWithOpponents({
      teamId: "TEAM",
      venue: "HOME",
      target,
      goalsUniverse: universe,
      strengthUniverse: strengthU,
      ...fns,
    });
    expect(contrib).toHaveLength(1);
    expect(contrib[0]!.fixtureId).toBe("M");
    expect(contrib[0]!.opponentStrengthCutoffUtc).toBe(matchM.kickoffUtc);
    expect(contrib[0]!.opponentStrengthSource).toBe("catalogue");
    expect(contrib[0]!.opponentStrengthPlayed).toBe(1);

    const strengthAtM = contrib[0]!.opponentCommonStrengthAsOfM!;

    // Post-M mutation must not change strength as-of M
    const postMut = fx({
      fixtureId: "post-M2",
      kickoffUtc: "2023-08-16T15:00:00.000Z",
      homeTeamId: "OPP",
      awayTeamId: "Z",
      sourceFulltimeHome: 8,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 8,
      sourceGoalsAway: 0,
    });
    const universe2 = [...universe, postMut];
    const contrib2 = listVenueRolePriorsWithOpponents({
      teamId: "TEAM",
      venue: "HOME",
      target,
      goalsUniverse: universe2,
      strengthUniverse: goalsFixtureToStrengthUniverse(universe2),
      ...fns,
    });
    expect(contrib2[0]!.opponentCommonStrengthAsOfM).toBe(strengthAtM);

    // Pre-M extra result may change strength
    const preExtra = fx({
      fixtureId: "opp-pre2",
      kickoffUtc: "2023-08-05T15:00:00.000Z",
      homeTeamId: "OPP",
      awayTeamId: "Z",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 2,
      sourceGoalsAway: 0,
    });
    const universe3 = [oppPre, preExtra, matchM, sameKo, postM, target];
    const contrib3 = listVenueRolePriorsWithOpponents({
      teamId: "TEAM",
      venue: "HOME",
      target,
      goalsUniverse: universe3,
      strengthUniverse: goalsFixtureToStrengthUniverse(universe3),
      ...fns,
    });
    expect(contrib3[0]!.opponentStrengthPlayed).toBe(2);
    expect(contrib3[0]!.opponentCommonStrengthAsOfM).not.toBe(strengthAtM);
  });
});

describe("GOALS-1E beta=0 reproduces G1", () => {
  it("mu and markets match G1 within tolerance", () => {
    const f1 = fx({
      fixtureId: "1",
      kickoffUtc: "2023-08-11T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      sourceFulltimeHome: 2,
      sourceFulltimeAway: 1,
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
    });
    const f2 = fx({
      fixtureId: "2",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "B",
      sourceFulltimeHome: 1,
      sourceFulltimeAway: 0,
      sourceGoalsHome: 1,
      sourceGoalsAway: 0,
    });
    const f3 = fx({
      fixtureId: "3",
      kickoffUtc: "2023-08-18T15:00:00.000Z",
      homeTeamId: "C",
      awayTeamId: "A",
      sourceFulltimeHome: 0,
      sourceFulltimeAway: 2,
      sourceGoalsHome: 0,
      sourceGoalsAway: 2,
    });
    const target = fx({
      fixtureId: "4",
      kickoffUtc: "2023-08-25T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const universe = [f1, f2, f3, target];
    const evidence = buildGoalsTargetEvidence({ target, universe });
    const g1 = predictG1FromEvidence(evidence, 10);
    const g3 = predictG3FromEvidence({
      evidence,
      targetFixture: target,
      goalsUniverse: universe,
      strengthUniverse: goalsFixtureToStrengthUniverse(universe),
      beta: 0,
      empiricalOpponentCenter: 1580,
    });
    expect(g3.predictionStatus).toBe(g1.predictionStatus);
    expect(g3.muHome).toBeCloseTo(g1.muHome!, 10);
    expect(g3.muAway).toBeCloseTo(g1.muAway!, 10);
    expect(g3.markets!.matchTotals.over25).toBeCloseTo(
      g1.markets!.matchTotals.over25,
      10,
    );
    expect(g3.shrinkageK).toBe(10);
    expect(g3.noExplicitHfa).toBe(true);

    // Future fixture must not alter prediction
    const future = fx({
      fixtureId: "99",
      kickoffUtc: "2023-09-01T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
      sourceFulltimeHome: 7,
      sourceFulltimeAway: 7,
      sourceGoalsHome: 7,
      sourceGoalsAway: 7,
    });
    const g3b = predictG3FromEvidence({
      evidence: buildGoalsTargetEvidence({
        target,
        universe: [...universe, future],
      }),
      targetFixture: target,
      goalsUniverse: [...universe, future],
      strengthUniverse: goalsFixtureToStrengthUniverse([...universe, future]),
      beta: 0,
      empiricalOpponentCenter: 1580,
    });
    expect(g3b.muHome).toBe(g3.muHome);
  });

  it("rejects holdout season in protocol constants", () => {
    expect(goalsG3Protocol(0.1).holdoutSeason).toBe("2025");
  });
});
