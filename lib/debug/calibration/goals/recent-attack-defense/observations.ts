/**
 * GOALS-1H.1 — Team-perspective G1 residual observations.
 */

import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";
import { GOALS_RAD_HOLDOUT_SEASON } from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";

export type GoalsRadVenueRole = "HOME" | "AWAY";

export type GoalsRadTeamObservation = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  teamId: string;
  opponentId: string;
  venueRole: GoalsRadVenueRole;
  actualGoalsFor: number;
  actualGoalsAgainst: number;
  expectedGoalsFor: number;
  expectedGoalsAgainst: number;
  /** actualGoalsFor - expectedGoalsFor (>0 scored more than G1 expected). */
  attackResidual: number;
  /** actualGoalsAgainst - expectedGoalsAgainst (>0 conceded more than G1 expected). */
  defenseResidual: number;
  evidenceSupportBucket: string;
  regulationLabelSource: string;
};

export function sortTeamObservations(
  obs: readonly GoalsRadTeamObservation[],
): GoalsRadTeamObservation[] {
  return [...obs].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId) ||
      a.venueRole.localeCompare(b.venueRole),
  );
}

/** One G1 prediction → exactly two team-perspective observations. */
export function buildTeamObservationsFromPrediction(
  pred: GoalsG1Prediction,
  competitionId = "39",
): [GoalsRadTeamObservation, GoalsRadTeamObservation] | null {
  if (pred.season === GOALS_RAD_HOLDOUT_SEASON) {
    throw new Error(`Holdout season fixture ${pred.fixtureId} forbidden`);
  }
  if (pred.predictionStatus !== "AVAILABLE") return null;
  if (
    pred.muHome == null ||
    pred.muAway == null ||
    pred.labelHomeGoals90 == null ||
    pred.labelAwayGoals90 == null
  ) {
    return null;
  }

  const home: GoalsRadTeamObservation = {
    fixtureId: pred.fixtureId,
    competitionId,
    season: pred.season,
    kickoffUtc: pred.kickoffUtc,
    teamId: pred.homeTeamId,
    opponentId: pred.awayTeamId,
    venueRole: "HOME",
    actualGoalsFor: pred.labelHomeGoals90,
    actualGoalsAgainst: pred.labelAwayGoals90,
    expectedGoalsFor: pred.muHome,
    expectedGoalsAgainst: pred.muAway,
    attackResidual: pred.labelHomeGoals90 - pred.muHome,
    defenseResidual: pred.labelAwayGoals90 - pred.muAway,
    evidenceSupportBucket: pred.evidenceSupportBucket,
    regulationLabelSource: pred.regulationLabelSource,
  };

  const away: GoalsRadTeamObservation = {
    fixtureId: pred.fixtureId,
    competitionId,
    season: pred.season,
    kickoffUtc: pred.kickoffUtc,
    teamId: pred.awayTeamId,
    opponentId: pred.homeTeamId,
    venueRole: "AWAY",
    actualGoalsFor: pred.labelAwayGoals90,
    actualGoalsAgainst: pred.labelHomeGoals90,
    expectedGoalsFor: pred.muAway,
    expectedGoalsAgainst: pred.muHome,
    attackResidual: pred.labelAwayGoals90 - pred.muAway,
    defenseResidual: pred.labelHomeGoals90 - pred.muHome,
    evidenceSupportBucket: pred.evidenceSupportBucket,
    regulationLabelSource: pred.regulationLabelSource,
  };

  return [home, away];
}

export function buildAllTeamObservations(
  predictions: readonly GoalsG1Prediction[],
): GoalsRadTeamObservation[] {
  const out: GoalsRadTeamObservation[] = [];
  for (const p of predictions) {
    const pair = buildTeamObservationsFromPrediction(p);
    if (!pair) continue;
    out.push(pair[0], pair[1]);
  }
  return sortTeamObservations(out);
}
