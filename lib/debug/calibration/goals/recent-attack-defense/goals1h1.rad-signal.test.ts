/**
 * GOALS-1H.1 — Recent attack/defense signal audit tests.
 */

import { describe, expect, it } from "vitest";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import { digestGoalsG1Protocol, goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { digestGoalsMcalRefProtocol } from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { predictG1FromEvidence } from "@/lib/debug/calibration/goals/g1/predict";
import {
  buildAllTeamObservations,
  buildTeamObservationsFromPrediction,
} from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import {
  computeHistorySummaries,
  priorObservationsForTarget,
} from "@/lib/debug/calibration/goals/recent-attack-defense/history";
import { winsorize } from "@/lib/debug/calibration/goals/recent-attack-defense/diagnostics";
import { shuffleResidualsWithinTeam } from "@/lib/debug/calibration/goals/recent-attack-defense/shuffle";
import { runGoalsRecentAttackDefenseAudit } from "@/lib/debug/calibration/goals/recent-attack-defense/evaluate";
import {
  digestGoalsRadProtocol,
  GOALS_RAD_HOLDOUT_SEASON,
  GOALS_RAD_PARENT_G1_K,
  GOALS_RAD_PARENT_G13_PROTOCOL_DIGEST,
  GOALS_RAD_PARENT_G13_VERDICT,
  GOALS_RAD_REQUIRED_EVIDENCE_DIGEST,
  goalsRadProtocol,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";

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
  for (let week = 0; week < 30; week += 1) {
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

describe("GOALS-1H.1 protocol", () => {
  it("parent digest pins and no modeling flags", () => {
    expect(digestGoalsRadProtocol()).toBe(
      digestGoalsRadProtocol(goalsRadProtocol()),
    );
    expect(GOALS_RAD_PARENT_G1_K).toBe(10);
    expect(goalsRadProtocol().parentG1ProtocolDigest).toBe(
      digestGoalsG1Protocol(goalsG1Protocol(10)),
    );
    expect(GOALS_RAD_PARENT_G13_PROTOCOL_DIGEST).toBe(
      digestGoalsMcalRefProtocol(),
    );
    expect(GOALS_RAD_PARENT_G13_VERDICT).toBe(
      "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE",
    );
    expect(goalsRadProtocol().noBlendCoefficient).toBe(true);
    expect(goalsRadProtocol().noRegressionFit).toBe(true);
    expect(goalsRadProtocol().noCalibration).toBe(true);
    expect(goalsRadProtocol().noProductionWiring).toBe(true);
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

describe("GOALS-1H.1 observations and residuals", () => {
  it("team-perspective orientation and residual signs", () => {
    const universe = miniUniverse().slice(0, 20);
    const target = universe[universe.length - 1]!;
    const evidence = buildGoalsTargetEvidence({ target, universe });
    const pred = predictG1FromEvidence(evidence, 10);
    const pair = buildTeamObservationsFromPrediction(pred)!;
    const [home, away] = pair;
    expect(home.venueRole).toBe("HOME");
    expect(away.venueRole).toBe("AWAY");
    expect(home.teamId).toBe(pred.homeTeamId);
    expect(away.teamId).toBe(pred.awayTeamId);
    expect(home.attackResidual).toBeCloseTo(
      home.actualGoalsFor - home.expectedGoalsFor,
      12,
    );
    expect(home.defenseResidual).toBeCloseTo(
      home.actualGoalsAgainst - home.expectedGoalsAgainst,
      12,
    );
    // Positive defense residual = conceded more than expected
    expect(home.expectedGoalsAgainst).toBe(pred.muAway);
    expect(away.expectedGoalsFor).toBe(pred.muAway);
  });
});

describe("GOALS-1H.1 temporal history", () => {
  it("strict kickoff<, self/same-kickoff exclusion, windows, no padding", () => {
    const universe = miniUniverse();
    const preds = universe.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildAllTeamObservations(preds);
    const target = obs.find((o) => o.teamId === "T1" && o.venueRole === "HOME")!;
    const teamObs = obs.filter(
      (o) => o.teamId === target.teamId && o.season === target.season,
    );
    const priors = priorObservationsForTarget(target, teamObs);
    expect(priors.every((p) => p.kickoffUtc < target.kickoffUtc)).toBe(true);
    expect(priors.every((p) => p.fixtureId !== target.fixtureId)).toBe(true);

    const summaries = computeHistorySummaries(target, teamObs);
    expect(summaries.map((s) => s.windowId)).toEqual(
      expect.arrayContaining([
        "last_3",
        "last_5",
        "last_8",
        "days_28",
        "days_56",
        "halfLife_28",
      ]),
    );
    const l5 = summaries.find((s) => s.windowId === "last_5")!;
    if (l5.status === "AVAILABLE") {
      expect(l5.historyCount).toBe(5);
    } else if (l5.status === "PARTIAL") {
      expect(l5.historyCount).toBeLessThan(5);
      expect(l5.recentAttackResidualMean).toBeNull();
    }

    // post-T mutation cannot change T history
    const priors1 = priorObservationsForTarget(target, teamObs);
    const mutatedPost = [
      ...teamObs,
      {
        ...target,
        fixtureId: "post",
        kickoffUtc: "2099-01-01T00:00:00.000Z",
        attackResidual: 99,
      },
    ];
    const priors2 = priorObservationsForTarget(target, mutatedPost);
    expect(priors2.map((p) => p.fixtureId).join(",")).toBe(
      priors1.map((p) => p.fixtureId).join(","),
    );

    // pre-T mutation can change T history
    const mutatedPre = [
      {
        ...target,
        fixtureId: "pre",
        kickoffUtc: "2020-01-01T00:00:00.000Z",
        attackResidual: 42,
      },
      ...teamObs,
    ];
    const priors3 = priorObservationsForTarget(target, mutatedPre);
    expect(priors3.some((p) => p.fixtureId === "pre")).toBe(true);
  });

  it("venue-role filtering and winsor diagnostic", () => {
    const universe = miniUniverse();
    const preds = universe.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildAllTeamObservations(preds);
    const target = obs.find((o) => o.venueRole === "HOME")!;
    const teamObs = obs.filter(
      (o) => o.teamId === target.teamId && o.season === target.season,
    );
    const same = priorObservationsForTarget(target, teamObs, {
      sameVenueRoleOnly: true,
    });
    expect(same.every((p) => p.venueRole === "HOME")).toBe(true);
    expect(winsorize(5)).toBe(2);
    expect(winsorize(-5)).toBe(-2);
  });
});

describe("GOALS-1H.1 shuffle / holdout / wiring", () => {
  it("deterministic shuffle, holdout rejection, activation false", () => {
    const universe = miniUniverse().slice(0, 40);
    const preds = universe.map((t) =>
      predictG1FromEvidence(
        buildGoalsTargetEvidence({ target: t, universe }),
        10,
      ),
    );
    const obs = buildAllTeamObservations(preds);
    const s1 = shuffleResidualsWithinTeam(obs, 99);
    const s2 = shuffleResidualsWithinTeam(obs, 99);
    expect(s1.map((o) => o.attackResidual)).toEqual(
      s2.map((o) => o.attackResidual),
    );
    expect(s1.length).toBe(obs.length);

    expect(() =>
      runGoalsRecentAttackDefenseAudit({
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
            season: GOALS_RAD_HOLDOUT_SEASON,
          },
        ],
        evidenceDatasetDigest: GOALS_RAD_REQUIRED_EVIDENCE_DIGEST,
      }),
    ).toThrow(/Holdout/);

    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(goalsRadProtocol().signalAuditOnly).toBe(true);
  });
});
