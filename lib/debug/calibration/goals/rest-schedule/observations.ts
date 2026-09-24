/**
 * GOALS-1I.1 — Team/fixture observations with league rest/load features.
 */

import type { GoalsG1Prediction } from "@/lib/debug/calibration/goals/g1/predict";
import {
  GOALS_REST_HOLDOUT_SEASON,
  restBinFromDays,
  seasonStageFromLeaguePlayed,
  type GoalsRestBin,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

export type GoalsRestVenueRole = "HOME" | "AWAY";

export type GoalsRestTeamObservation = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  teamId: string;
  opponentId: string;
  venueRole: GoalsRestVenueRole;
  actualGoalsFor: number;
  actualGoalsAgainst: number;
  expectedGoalsFor: number;
  expectedGoalsAgainst: number;
  attackResidual: number;
  defenseResidual: number;
  /** Fixture total residual (same on both perspectives). */
  fixtureTotalResidual: number;
  leagueMatchesPlayedBefore: number;
  seasonStage: "EARLY" | "MID" | "LATE";
  evidenceSupportBucket: string;
  /** League-only rest days since previous PL match; null if UNAVAILABLE. */
  leagueRestDays: number | null;
  restFeatureStatus: "AVAILABLE" | "UNAVAILABLE";
  restBin: GoalsRestBin | null;
  leagueMatchesLast7d: number;
  leagueMatchesLast14d: number;
  leagueMatchesLast28d: number;
  shortRestLe3d: boolean | null;
  veryShortRestLe2d: boolean | null;
  matchesPer14Days: number;
  matchesPer28Days: number;
};

export type GoalsRestFixtureObservation = {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  leagueMatchesPlayedBefore: number;
  seasonStage: "EARLY" | "MID" | "LATE";
  muHome: number;
  muAway: number;
  labelHome: number;
  labelAway: number;
  homeAttackResidual: number;
  awayAttackResidual: number;
  fixtureTotalResidual: number;
  homeLeagueRestDays: number | null;
  awayLeagueRestDays: number | null;
  /** homeRest - awayRest; null if either UNAVAILABLE. */
  restDifferenceDays: number | null;
  matchesLast7dDifference: number | null;
  matchesLast14dDifference: number | null;
  matchesLast28dDifference: number | null;
  markets: {
    over05: number;
    over15: number;
    over25: number;
    bttsYes: number;
  } | null;
  actualOver05: 0 | 1;
  actualOver15: 0 | 1;
  actualOver25: 0 | 1;
  actualBttsYes: 0 | 1;
};

export function sortTeamObs(
  obs: readonly GoalsRestTeamObservation[],
): GoalsRestTeamObservation[] {
  return [...obs].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId) ||
      a.venueRole.localeCompare(b.venueRole),
  );
}

export function daysBetweenKickoffs(earlier: string, later: string): number {
  return (Date.parse(later) - Date.parse(earlier)) / (24 * 60 * 60 * 1000);
}

/**
 * Strict priors: same team, same season, kickoff < T, not T.
 */
export function priorTeamMatches(
  target: { teamId: string; season: string; kickoffUtc: string; fixtureId: string },
  teamSeasonObs: readonly GoalsRestTeamObservation[],
): GoalsRestTeamObservation[] {
  return sortTeamObs(teamSeasonObs).filter(
    (p) =>
      p.teamId === target.teamId &&
      p.season === target.season &&
      p.kickoffUtc < target.kickoffUtc &&
      p.fixtureId !== target.fixtureId,
  );
}

export function computeLeagueRestFeatures(
  targetKickoffUtc: string,
  priors: readonly GoalsRestTeamObservation[],
): {
  leagueRestDays: number | null;
  restFeatureStatus: "AVAILABLE" | "UNAVAILABLE";
  restBin: GoalsRestBin | null;
  leagueMatchesLast7d: number;
  leagueMatchesLast14d: number;
  leagueMatchesLast28d: number;
  shortRestLe3d: boolean | null;
  veryShortRestLe2d: boolean | null;
  matchesPer14Days: number;
  matchesPer28Days: number;
} {
  const t = Date.parse(targetKickoffUtc);
  const countInDays = (days: number) => {
    const lo = t - days * 24 * 60 * 60 * 1000;
    return priors.filter((p) => {
      const pk = Date.parse(p.kickoffUtc);
      return pk >= lo && pk < t;
    }).length;
  };
  const m7 = countInDays(7);
  const m14 = countInDays(14);
  const m28 = countInDays(28);

  if (priors.length === 0) {
    return {
      leagueRestDays: null,
      restFeatureStatus: "UNAVAILABLE",
      restBin: null,
      leagueMatchesLast7d: m7,
      leagueMatchesLast14d: m14,
      leagueMatchesLast28d: m28,
      shortRestLe3d: null,
      veryShortRestLe2d: null,
      matchesPer14Days: m14 / 14,
      matchesPer28Days: m28 / 28,
    };
  }

  const prev = priors[priors.length - 1]!;
  const days = daysBetweenKickoffs(prev.kickoffUtc, targetKickoffUtc);
  return {
    leagueRestDays: days,
    restFeatureStatus: "AVAILABLE",
    restBin: restBinFromDays(days),
    leagueMatchesLast7d: m7,
    leagueMatchesLast14d: m14,
    leagueMatchesLast28d: m28,
    shortRestLe3d: days <= 3,
    veryShortRestLe2d: days <= 2,
    matchesPer14Days: m14 / 14,
    matchesPer28Days: m28 / 28,
  };
}

type BareTeam = Omit<
  GoalsRestTeamObservation,
  | "leagueRestDays"
  | "restFeatureStatus"
  | "restBin"
  | "leagueMatchesLast7d"
  | "leagueMatchesLast14d"
  | "leagueMatchesLast28d"
  | "shortRestLe3d"
  | "veryShortRestLe2d"
  | "matchesPer14Days"
  | "matchesPer28Days"
>;

function bareFromPrediction(
  pred: GoalsG1Prediction,
  competitionId: string,
): [BareTeam, BareTeam] | null {
  if (pred.season === GOALS_REST_HOLDOUT_SEASON) {
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
  const totalRes =
    pred.labelHomeGoals90 +
    pred.labelAwayGoals90 -
    (pred.muHome + pred.muAway);
  const stage = seasonStageFromLeaguePlayed(pred.leagueMatchesPlayedBefore);
  const home: BareTeam = {
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
    fixtureTotalResidual: totalRes,
    leagueMatchesPlayedBefore: pred.leagueMatchesPlayedBefore,
    seasonStage: stage,
    evidenceSupportBucket: pred.evidenceSupportBucket,
  };
  const away: BareTeam = {
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
    fixtureTotalResidual: totalRes,
    leagueMatchesPlayedBefore: pred.leagueMatchesPlayedBefore,
    seasonStage: stage,
    evidenceSupportBucket: pred.evidenceSupportBucket,
  };
  return [home, away];
}

/**
 * Build team observations with league rest/load features.
 * Two-pass: bare residuals first, then features from priors.
 */
export function buildRestTeamObservations(
  predictions: readonly GoalsG1Prediction[],
  competitionId = "39",
): GoalsRestTeamObservation[] {
  const bare: BareTeam[] = [];
  for (const p of predictions) {
    const pair = bareFromPrediction(p, competitionId);
    if (!pair) continue;
    bare.push(pair[0], pair[1]);
  }
  bare.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId) ||
      a.venueRole.localeCompare(b.venueRole),
  );

  const byTeam = new Map<string, BareTeam[]>();
  for (const o of bare) {
    const key = `${o.season}|${o.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(o);
    byTeam.set(key, list);
  }

  const out: GoalsRestTeamObservation[] = [];
  for (const o of bare) {
    const teamList = byTeam.get(`${o.season}|${o.teamId}`) ?? [];
    // Convert bare list to stub observations for prior filtering
    const stubs = teamList as unknown as GoalsRestTeamObservation[];
    const priors = priorTeamMatches(o, stubs);
    const feat = computeLeagueRestFeatures(o.kickoffUtc, priors);
    out.push({ ...o, ...feat });
  }
  return out;
}

export function buildRestFixtureObservations(
  predictions: readonly GoalsG1Prediction[],
  teamObs: readonly GoalsRestTeamObservation[],
): GoalsRestFixtureObservation[] {
  const byFixTeam = new Map<string, GoalsRestTeamObservation>();
  for (const o of teamObs) {
    byFixTeam.set(`${o.fixtureId}|${o.venueRole}`, o);
  }
  const out: GoalsRestFixtureObservation[] = [];
  for (const p of predictions) {
    if (p.predictionStatus !== "AVAILABLE") continue;
    if (
      p.muHome == null ||
      p.muAway == null ||
      p.labelHomeGoals90 == null ||
      p.labelAwayGoals90 == null
    ) {
      continue;
    }
    const home = byFixTeam.get(`${p.fixtureId}|HOME`);
    const away = byFixTeam.get(`${p.fixtureId}|AWAY`);
    if (!home || !away) continue;
    const total = p.labelHomeGoals90 + p.labelAwayGoals90;
    out.push({
      fixtureId: p.fixtureId,
      season: p.season,
      kickoffUtc: p.kickoffUtc,
      leagueMatchesPlayedBefore: p.leagueMatchesPlayedBefore,
      seasonStage: seasonStageFromLeaguePlayed(p.leagueMatchesPlayedBefore),
      muHome: p.muHome,
      muAway: p.muAway,
      labelHome: p.labelHomeGoals90,
      labelAway: p.labelAwayGoals90,
      homeAttackResidual: p.labelHomeGoals90 - p.muHome,
      awayAttackResidual: p.labelAwayGoals90 - p.muAway,
      fixtureTotalResidual: total - (p.muHome + p.muAway),
      homeLeagueRestDays: home.leagueRestDays,
      awayLeagueRestDays: away.leagueRestDays,
      restDifferenceDays:
        home.leagueRestDays != null && away.leagueRestDays != null
          ? home.leagueRestDays - away.leagueRestDays
          : null,
      matchesLast7dDifference:
        home.leagueMatchesLast7d - away.leagueMatchesLast7d,
      matchesLast14dDifference:
        home.leagueMatchesLast14d - away.leagueMatchesLast14d,
      matchesLast28dDifference:
        home.leagueMatchesLast28d - away.leagueMatchesLast28d,
      markets: p.markets
        ? {
            over05: p.markets.matchTotals.over05,
            over15: p.markets.matchTotals.over15,
            over25: p.markets.matchTotals.over25,
            bttsYes: p.markets.btts.yes,
          }
        : null,
      actualOver05: total >= 1 ? 1 : 0,
      actualOver15: total >= 2 ? 1 : 0,
      actualOver25: total >= 3 ? 1 : 0,
      actualBttsYes:
        p.labelHomeGoals90 >= 1 && p.labelAwayGoals90 >= 1 ? 1 : 0,
    });
  }
  return out.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
}
