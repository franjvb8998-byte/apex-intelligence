/**
 * GOALS-1I.1 — Rest/schedule congestion signal audit tests.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { digestGoalsRadProtocol } from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import {
  buildRestTeamObservations,
  computeLeagueRestFeatures,
  daysBetweenKickoffs,
  priorTeamMatches,
} from "@/lib/debug/calibration/goals/rest-schedule/observations";
import { winsorize } from "@/lib/debug/calibration/goals/rest-schedule/diagnostics";
import { shuffleRestWithinTeam } from "@/lib/debug/calibration/goals/rest-schedule/shuffle";
import { runGoalsRestScheduleAudit } from "@/lib/debug/calibration/goals/rest-schedule/evaluate";
import {
  digestGoalsRestProtocol,
  GOALS_REST_HOLDOUT_SEASON,
  GOALS_REST_PARENT_G1_K,
  GOALS_REST_PARENT_H1_PROTOCOL_DIGEST,
  GOALS_REST_PARENT_H1_VERDICT,
  GOALS_REST_REQUIRED_EVIDENCE_DIGEST,
  GOALS_REST_SCHEDULE_COVERAGE,
  goalsRestProtocol,
  restBinFromDays,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

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
  for (let week = 0; week < 25; week += 1) {
    for (let g = 0; g < 3; g += 1) {
      n += 1;
      out.push(
        fx({
          fixtureId: `f${n}`,
          kickoffUtc: new Date(
            start + (week * 7 + g) * 24 * 60 * 60 * 1000,
          ).toISOString(),
          homeTeamId: teams[(week + g) % teams.length]!,
          awayTeamId: teams[(week + g + 1) % teams.length]!,
          sourceGoalsHome: (week + g) % 4,
          sourceGoalsAway: (week + g * 2) % 3,
          sourceFulltimeHome: (week + g) % 4,
          sourceFulltimeAway: (week + g * 2) % 3,
        }),
      );
    }
  }
  return out;
}

describe("GOALS-1I.1 protocol", () => {
  it("parent digests, PL-only coverage, no modeling flags", () => {
    expect(digestGoalsRestProtocol()).toBe(
      digestGoalsRestProtocol(goalsRestProtocol()),
    );
    expect(GOALS_REST_PARENT_G1_K).toBe(10);
    expect(goalsRestProtocol().parentG1ProtocolDigest).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_REST_PARENT_H1_PROTOCOL_DIGEST).toBe(
      digestGoalsRadProtocol(),
    );
    expect(GOALS_REST_PARENT_H1_VERDICT).toBe(
      "NO_INCREMENTAL_RECENT_GOAL_SIGNAL",
    );
    expect(GOALS_REST_SCHEDULE_COVERAGE).toContain("PREMIER_LEAGUE_ONLY");
    expect(goalsRestProtocol().noFatigueMultiplier).toBe(true);
    expect(goalsRestProtocol().noCoefficientFit).toBe(true);
    expect(goalsRestProtocol().noProductionWiring).toBe(true);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
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

describe("GOALS-1I.1 rest features and temporal", () => {
  it("rest-day calc, bins, UNAVAILABLE, 7/14/28 counts, invariants", () => {
    expect(restBinFromDays(1.5)).toBe("REST_LE_2");
    expect(restBinFromDays(3)).toBe("REST_3");
    expect(restBinFromDays(7)).toBe("REST_7_PLUS");
    expect(
      daysBetweenKickoffs(
        "2023-08-12T15:00:00.000Z",
        "2023-08-19T15:00:00.000Z",
      ),
    ).toBe(7);

    const empty = computeLeagueRestFeatures("2023-08-20T15:00:00.000Z", []);
    expect(empty.restFeatureStatus).toBe("UNAVAILABLE");
    expect(empty.leagueRestDays).toBeNull();

    const universe = miniUniverse();
    const preds = universe.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildRestTeamObservations(preds);
    const target = obs.find(
      (o) => o.teamId === "T1" && o.restFeatureStatus === "AVAILABLE",
    )!;
    expect(target.leagueRestDays).toBeGreaterThan(0);
    expect(target.leagueMatchesLast7d).toBeGreaterThanOrEqual(0);
    expect(target.leagueMatchesLast14d).toBeGreaterThanOrEqual(
      target.leagueMatchesLast7d,
    );
    expect(target.leagueMatchesLast28d).toBeGreaterThanOrEqual(
      target.leagueMatchesLast14d,
    );

    const teamObs = obs.filter(
      (o) => o.teamId === target.teamId && o.season === target.season,
    );
    const priors1 = priorTeamMatches(target, teamObs);
    const mutatedPost = [
      ...teamObs,
      {
        ...target,
        fixtureId: "post",
        kickoffUtc: "2099-01-01T00:00:00.000Z",
      },
    ];
    expect(
      priorTeamMatches(target, mutatedPost)
        .map((p) => p.fixtureId)
        .join(","),
    ).toBe(priors1.map((p) => p.fixtureId).join(","));

    const mutatedPre = [
      {
        ...target,
        fixtureId: "pre",
        kickoffUtc: "2020-01-01T00:00:00.000Z",
      },
      ...teamObs,
    ];
    expect(
      priorTeamMatches(target, mutatedPre).some((p) => p.fixtureId === "pre"),
    ).toBe(true);

    expect(priors1.every((p) => p.kickoffUtc < target.kickoffUtc)).toBe(true);
    expect(priors1.every((p) => p.fixtureId !== target.fixtureId)).toBe(true);
    expect(winsorize(5)).toBe(2);
  });

  it("relative rest orientation home - away", () => {
    expect(goalsRestProtocol().relativeRestSignConvention).toBe(
      "homeRestDays_minus_awayRestDays",
    );
  });
});

describe("GOALS-1I.1 shuffle / holdout / wiring", () => {
  it("deterministic shuffle, holdout rejection, activation false", () => {
    const universe = miniUniverse().slice(0, 40);
    const preds = universe.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildRestTeamObservations(preds);
    const s1 = shuffleRestWithinTeam(obs, 7);
    const s2 = shuffleRestWithinTeam(obs, 7);
    expect(s1.map((o) => o.leagueRestDays)).toEqual(
      s2.map((o) => o.leagueRestDays),
    );

    expect(() =>
      runGoalsRestScheduleAudit({
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
            season: GOALS_REST_HOLDOUT_SEASON,
          },
        ],
        evidenceDatasetDigest: GOALS_REST_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);

    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(goalsRestProtocol().signalAuditOnly).toBe(true);
  });
});
