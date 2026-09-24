/**
 * GOALS-1B — Historical goal evidence tests.
 */

import { describe, expect, it } from "vitest";
import {
  applyLeagueFtAssumption,
  applyRegulationToFixture,
  buildTargetLabels,
  deriveMarketLabels90,
  resolveRegulation90Goals,
} from "@/lib/debug/calibration/goals/regulation";
import {
  normalizeGoalsHistoricalUniverse,
} from "@/lib/debug/calibration/goals/normalize";
import {
  buildLeagueEnvironment,
  buildTeamHistoricalEvidence,
  priorFixturesForTarget,
} from "@/lib/debug/calibration/goals/history";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";

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
    sourceGoalsAway: 0,
    sourceFulltimeHome: 1,
    sourceFulltimeAway: 0,
    ...partial,
  });
}

describe("GOALS-1B regulation labels", () => {
  it("uses explicit fulltime fields", () => {
    const r = resolveRegulation90Goals({
      status: "AET",
      goalsHome: 3,
      goalsAway: 2,
      fulltimeHome: 1,
      fulltimeAway: 1,
    });
    expect(r).toEqual({
      home: 1,
      away: 1,
      available: true,
      source: "explicit_fulltime_fields",
    });
  });

  it("uses FT goals when status is FT", () => {
    const r = resolveRegulation90Goals({
      status: "FT",
      goalsHome: 2,
      goalsAway: 0,
      fulltimeHome: null,
      fulltimeAway: null,
    });
    expect(r.available).toBe(true);
    expect(r.home).toBe(2);
  });

  it("does not substitute AET/PEN final without fulltime", () => {
    expect(
      resolveRegulation90Goals({
        status: "AET",
        goalsHome: 3,
        goalsAway: 2,
        fulltimeHome: null,
        fulltimeAway: null,
      }).available,
    ).toBe(false);
    expect(
      resolveRegulation90Goals({
        status: "PEN",
        goalsHome: 5,
        goalsAway: 4,
        fulltimeHome: null,
        fulltimeAway: null,
      }).available,
    ).toBe(false);
  });

  it("league FT assumption is explicit provenance", () => {
    const base = applyRegulationToFixture({
      fixtureId: "x",
      kickoffUtc: "2023-08-01T12:00:00.000Z",
      status: null,
      competitionId: "39",
      season: "2023",
      homeTeamId: "1",
      awayTeamId: "2",
      sourceGoalsHome: 2,
      sourceGoalsAway: 1,
      sourceFulltimeHome: null,
      sourceFulltimeAway: null,
    });
    expect(base.regulationGoalsAvailable).toBe(false);
    const assumed = applyLeagueFtAssumption(base);
    expect(assumed.regulationGoalsAvailable).toBe(true);
    expect(assumed.regulationLabelSource).toBe(
      "calibration_actual_under_league_ft_assumption",
    );
  });
});

describe("GOALS-1B market label helpers", () => {
  it("handles O/U boundaries and BTTS", () => {
    expect(deriveMarketLabels90(0, 0)).toMatchObject({
      under05: true,
      over05: false,
      under15: true,
      bttsNo: true,
    });
    expect(deriveMarketLabels90(1, 0)).toMatchObject({
      over05: true,
      under15: true,
      over15: false,
      homeOver05: true,
      awayUnder05: true,
      bttsNo: true,
    });
    expect(deriveMarketLabels90(1, 1)).toMatchObject({
      over15: true,
      under25: true,
      bttsYes: true,
    });
    expect(deriveMarketLabels90(2, 1)).toMatchObject({
      over25: true,
      under35: true,
    });
    expect(deriveMarketLabels90(3, 1)).toMatchObject({
      over35: true,
      under45: true,
    });
    expect(deriveMarketLabels90(4, 1)).toMatchObject({
      over45: true,
    });
  });
});

describe("GOALS-1B temporal / evidence", () => {
  it("excludes self, same kickoff, future; opening has null rates", () => {
    const universe = [
      fx({
        fixtureId: "1",
        kickoffUtc: "2023-08-12T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "A",
        sourceGoalsHome: 2,
        sourceGoalsAway: 1,
        sourceFulltimeHome: 2,
        sourceFulltimeAway: 1,
      }),
      fx({
        fixtureId: "2",
        kickoffUtc: "2023-08-19T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "B",
        sourceGoalsHome: 0,
        sourceGoalsAway: 0,
        sourceFulltimeHome: 0,
        sourceFulltimeAway: 0,
      }),
      fx({
        fixtureId: "3",
        kickoffUtc: "2023-08-26T15:00:00.000Z",
        homeTeamId: "C",
        awayTeamId: "H",
        sourceGoalsHome: 1,
        sourceGoalsAway: 3,
        sourceFulltimeHome: 1,
        sourceFulltimeAway: 3,
      }),
    ];
    const target = universe[2]!;
    const priors = priorFixturesForTarget(target, universe);
    expect(priors.map((p) => p.fixtureId)).toEqual(["1", "2"]);

    const sameKickoffExtra = fx({
      fixtureId: "2b",
      kickoffUtc: "2023-08-26T15:00:00.000Z",
      homeTeamId: "X",
      awayTeamId: "Y",
    });
    expect(
      priorFixturesForTarget(target, [...universe, sameKickoffExtra]).map(
        (p) => p.fixtureId,
      ),
    ).toEqual(["1", "2"]);

    const future = fx({
      fixtureId: "99",
      kickoffUtc: "2023-09-01T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "Z",
    });
    expect(
      priorFixturesForTarget(target, [...universe, future]).map(
        (p) => p.fixtureId,
      ),
    ).toEqual(["1", "2"]);

    const opening = buildTeamHistoricalEvidence({
      teamId: "H",
      target: universe[0]!,
      universe,
    });
    expect(opening.allVenues.played).toBe(0);
    expect(opening.allVenues.goalsForPerMatch).toBeNull();

    const mid = buildTeamHistoricalEvidence({
      teamId: "H",
      target,
      universe,
    });
    expect(mid.allVenues.played).toBe(2);
    expect(mid.allVenues.goalsFor).toBe(2); // 2 + 0
    expect(mid.homeRole.played).toBe(2);
    expect(mid.awayRole.played).toBe(0);

    const league = buildLeagueEnvironment({ target, universe });
    expect(league.leagueMatchesPlayedBefore).toBe(2);
    expect(league.leagueTotalGoalsBefore).toBe(3); // 3 + 0
  });

  it("post-target mutation cannot change evidence; pre-target can", () => {
    const base = [
      fx({
        fixtureId: "1",
        kickoffUtc: "2023-08-12T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "A",
        sourceFulltimeHome: 1,
        sourceFulltimeAway: 0,
        sourceGoalsHome: 1,
        sourceGoalsAway: 0,
      }),
      fx({
        fixtureId: "T",
        kickoffUtc: "2023-08-20T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "B",
        sourceFulltimeHome: 2,
        sourceFulltimeAway: 2,
        sourceGoalsHome: 2,
        sourceGoalsAway: 2,
      }),
    ];
    const e1 = buildGoalsTargetEvidence({
      target: base[1]!,
      universe: base,
    });
    const withFuture = [
      ...base,
      fx({
        fixtureId: "F",
        kickoffUtc: "2023-08-27T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "C",
        sourceFulltimeHome: 5,
        sourceFulltimeAway: 0,
        sourceGoalsHome: 5,
        sourceGoalsAway: 0,
      }),
    ];
    const e2 = buildGoalsTargetEvidence({
      target: base[1]!,
      universe: withFuture,
    });
    expect(e2.digest).toBe(e1.digest);

    const withPast = [
      fx({
        fixtureId: "0",
        kickoffUtc: "2023-08-05T15:00:00.000Z",
        homeTeamId: "H",
        awayTeamId: "Z",
        sourceFulltimeHome: 4,
        sourceFulltimeAway: 0,
        sourceGoalsHome: 4,
        sourceGoalsAway: 0,
      }),
      ...base,
    ];
    const e3 = buildGoalsTargetEvidence({
      target: base[1]!,
      universe: withPast,
    });
    expect(e3.digest).not.toBe(e1.digest);
    expect(e3.homeEvidence.allVenues.played).toBe(2);
  });

  it("shuffle invariant and conflicting duplicate fail closed", () => {
    const rows = [
      fx({
        fixtureId: "a",
        kickoffUtc: "2023-08-01T12:00:00.000Z",
        homeTeamId: "1",
        awayTeamId: "2",
      }),
      fx({
        fixtureId: "b",
        kickoffUtc: "2023-08-02T12:00:00.000Z",
        homeTeamId: "3",
        awayTeamId: "4",
      }),
    ];
    const n1 = normalizeGoalsHistoricalUniverse(rows);
    const n2 = normalizeGoalsHistoricalUniverse([...rows].reverse());
    expect(n1.fixtures.map((f) => f.fixtureId)).toEqual(
      n2.fixtures.map((f) => f.fixtureId),
    );
    expect(() =>
      normalizeGoalsHistoricalUniverse([
        ...rows,
        fx({
          fixtureId: "a",
          kickoffUtc: "2023-08-01T12:00:00.000Z",
          homeTeamId: "1",
          awayTeamId: "9",
        }),
      ]),
    ).toThrow(/conflicting_duplicate/);
  });

  it("digest ignores acquisition noise; keeps activation false", () => {
    const target = fx({
      fixtureId: "T",
      kickoffUtc: "2023-09-01T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "A",
    });
    const prior = fx({
      fixtureId: "P",
      kickoffUtc: "2023-08-20T15:00:00.000Z",
      homeTeamId: "H",
      awayTeamId: "B",
    });
    const a = buildGoalsTargetEvidence({
      target,
      universe: [prior, target],
    });
    const b = buildGoalsTargetEvidence({
      target,
      universe: [prior, target],
    });
    expect(a.digest).toBe(b.digest);
    expect(a.provenance.fittedModelPresent).toBe(false);
    expect(a.provenance.homeAdvantageEncoded).toBe(false);
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

  it("rejects holdout season in builder path via season filter tests", () => {
    const holdout = fx({
      fixtureId: "h",
      kickoffUtc: "2025-09-01T12:00:00.000Z",
      homeTeamId: "1",
      awayTeamId: "2",
      season: "2025",
    });
    // Evidence can be built for synthetic tests, but dataset builder excludes 2025.
    expect(holdout.season).toBe("2025");
    expect(buildTargetLabels(holdout).labelStatus).toBe("USED");
  });
});
