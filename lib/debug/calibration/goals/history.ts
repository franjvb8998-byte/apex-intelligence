/**
 * GOALS-1B — Temporal priors and rate / recent evidence builders.
 */

import {
  GOALS_CALENDAR_DAY_WINDOWS,
  GOALS_LAST_N_WINDOWS,
  type GoalsHistoricalFixture,
  type GoalsLeagueHistoricalEnvironment,
  type GoalsRateBlock,
  type GoalsRecentWindowEvidence,
  type GoalsTeamHistoricalEvidence,
} from "@/lib/debug/calibration/goals/types";
import { isCompletedRegulationEvidence } from "@/lib/debug/calibration/goals/regulation";
import { compareGoalsFixtures } from "@/lib/debug/calibration/goals/normalize";

export function priorFixturesForTarget(
  target: GoalsHistoricalFixture,
  universe: readonly GoalsHistoricalFixture[],
): GoalsHistoricalFixture[] {
  const t = Date.parse(target.kickoffUtc);
  return [...universe]
    .filter((f) => {
      if (f.fixtureId === target.fixtureId) return false;
      if (f.competitionId !== target.competitionId) return false;
      if (f.season !== target.season) return false;
      const pk = Date.parse(f.kickoffUtc);
      // Strict < — same kickoff excluded
      return pk < t;
    })
    .filter(isCompletedRegulationEvidence)
    .sort(compareGoalsFixtures);
}

function emptyRates(reason: GoalsRateBlock["reason"]): GoalsRateBlock {
  return {
    played: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    goalsForPerMatch: null,
    goalsAgainstPerMatch: null,
    status: "UNAVAILABLE",
    reason,
  };
}

function ratesFromMatches(
  matches: readonly {
    goalsFor: number;
    goalsAgainst: number;
  }[],
  zeroReason: GoalsRateBlock["reason"],
): GoalsRateBlock {
  if (matches.length === 0) return emptyRates(zeroReason);
  let gf = 0;
  let ga = 0;
  for (const m of matches) {
    gf += m.goalsFor;
    ga += m.goalsAgainst;
  }
  const played = matches.length;
  return {
    played,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gf - ga,
    goalsForPerMatch: gf / played,
    goalsAgainstPerMatch: ga / played,
    status: "USED",
    reason: null,
  };
}

function teamPerspectiveGoals(
  fixture: GoalsHistoricalFixture,
  teamId: string,
): { goalsFor: number; goalsAgainst: number; venue: "HOME" | "AWAY" } | null {
  if (!fixture.regulationGoalsAvailable) return null;
  if (fixture.homeTeamId === teamId) {
    return {
      goalsFor: fixture.regulationHomeGoals!,
      goalsAgainst: fixture.regulationAwayGoals!,
      venue: "HOME",
    };
  }
  if (fixture.awayTeamId === teamId) {
    return {
      goalsFor: fixture.regulationAwayGoals!,
      goalsAgainst: fixture.regulationHomeGoals!,
      venue: "AWAY",
    };
  }
  return null;
}

function summarizeRecent(
  windowId: string,
  selected: readonly { goalsFor: number; goalsAgainst: number }[],
  requestedN: number | null,
  minRequired: number,
): GoalsRecentWindowEvidence {
  if (selected.length < minRequired) {
    return {
      windowId,
      requestedN,
      actualN: selected.length,
      played: selected.length,
      goalsFor: selected.reduce((s, m) => s + m.goalsFor, 0),
      goalsAgainst: selected.reduce((s, m) => s + m.goalsAgainst, 0),
      goalDifference: 0,
      goalsForPerMatch: null,
      goalsAgainstPerMatch: null,
      status: selected.length === 0 ? "UNAVAILABLE" : "PARTIAL",
      reason: "insufficient_recent_history",
    };
  }
  const gf = selected.reduce((s, m) => s + m.goalsFor, 0);
  const ga = selected.reduce((s, m) => s + m.goalsAgainst, 0);
  const played = selected.length;
  return {
    windowId,
    requestedN,
    actualN: played,
    played,
    goalsFor: gf,
    goalsAgainst: ga,
    goalDifference: gf - ga,
    goalsForPerMatch: gf / played,
    goalsAgainstPerMatch: ga / played,
    status: "USED",
    reason: null,
  };
}

export function buildTeamHistoricalEvidence(input: {
  teamId: string;
  target: GoalsHistoricalFixture;
  universe: readonly GoalsHistoricalFixture[];
}): GoalsTeamHistoricalEvidence {
  const priors = priorFixturesForTarget(input.target, input.universe);
  const all: { goalsFor: number; goalsAgainst: number; venue: "HOME" | "AWAY"; kickoffUtc: string }[] = [];
  for (const f of priors) {
    const p = teamPerspectiveGoals(f, input.teamId);
    if (!p) continue;
    all.push({ ...p, kickoffUtc: f.kickoffUtc });
  }

  const home = all.filter((m) => m.venue === "HOME");
  const away = all.filter((m) => m.venue === "AWAY");

  const recentLastN = GOALS_LAST_N_WINDOWS.map((n) => {
    const selected = all.slice(-n);
    return summarizeRecent(`last_${n}`, selected, n, n);
  });

  const t = Date.parse(input.target.kickoffUtc);
  const recentCalendar = GOALS_CALENDAR_DAY_WINDOWS.map((days) => {
    const lo = t - days * 24 * 60 * 60 * 1000;
    const selected = all.filter((m) => {
      const pk = Date.parse(m.kickoffUtc);
      return pk >= lo && pk < t;
    });
    return summarizeRecent(`days_${days}`, selected, null, 1);
  });

  const venueRole = input.target.homeTeamId === input.teamId ? "HOME" : "AWAY";
  const venuePool = venueRole === "HOME" ? home : away;
  const recentVenueRoleLastN = GOALS_LAST_N_WINDOWS.map((n) => {
    const selected = venuePool.slice(-n);
    // Do not require full N — record actualN; PARTIAL if short
    if (selected.length === 0) {
      return summarizeRecent(`venue_${venueRole}_last_${n}`, selected, n, 1);
    }
    if (selected.length < n) {
      const s = summarizeRecent(`venue_${venueRole}_last_${n}`, selected, n, 1);
      return { ...s, status: "PARTIAL" as const, reason: "insufficient_recent_history" as const };
    }
    return summarizeRecent(`venue_${venueRole}_last_${n}`, selected, n, n);
  });

  return {
    teamId: input.teamId,
    historicalCutoffUtc: input.target.kickoffUtc,
    competitionId: input.target.competitionId,
    season: input.target.season,
    allVenues: ratesFromMatches(all, "no_prior_team_matches"),
    homeRole: ratesFromMatches(home, "no_prior_home_matches"),
    awayRole: ratesFromMatches(away, "no_prior_away_matches"),
    recentLastN,
    recentCalendar,
    recentVenueRoleLastN,
  };
}

export function buildLeagueEnvironment(input: {
  target: GoalsHistoricalFixture;
  universe: readonly GoalsHistoricalFixture[];
}): GoalsLeagueHistoricalEnvironment {
  const priors = priorFixturesForTarget(input.target, input.universe);
  let homeGoals = 0;
  let awayGoals = 0;
  for (const f of priors) {
    homeGoals += f.regulationHomeGoals!;
    awayGoals += f.regulationAwayGoals!;
  }
  const n = priors.length;
  if (n === 0) {
    return {
      competitionId: input.target.competitionId,
      season: input.target.season,
      historicalCutoffUtc: input.target.kickoffUtc,
      leagueMatchesPlayedBefore: 0,
      leagueHomeGoalsBefore: 0,
      leagueAwayGoalsBefore: 0,
      leagueTotalGoalsBefore: 0,
      leagueHomeGoalsPerMatch: null,
      leagueAwayGoalsPerMatch: null,
      leagueTotalGoalsPerMatch: null,
      status: "UNAVAILABLE",
      reason: "no_prior_league_matches",
    };
  }
  return {
    competitionId: input.target.competitionId,
    season: input.target.season,
    historicalCutoffUtc: input.target.kickoffUtc,
    leagueMatchesPlayedBefore: n,
    leagueHomeGoalsBefore: homeGoals,
    leagueAwayGoalsBefore: awayGoals,
    leagueTotalGoalsBefore: homeGoals + awayGoals,
    leagueHomeGoalsPerMatch: homeGoals / n,
    leagueAwayGoalsPerMatch: awayGoals / n,
    leagueTotalGoalsPerMatch: (homeGoals + awayGoals) / n,
    status: "USED",
    reason: null,
  };
}
