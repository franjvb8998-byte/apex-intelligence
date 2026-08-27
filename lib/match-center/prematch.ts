/**
 * Pre-match context derived from catalogue data already on the Match Center
 * pipeline (last-5, H2H, standings, team statistics). No extra vendor calls.
 */

import type { ApiFootballStandingLeague } from "@/lib/data-platform/providers/api-football/types";
import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";
import type {
  MatchCenterH2HMeeting,
  MatchCenterRecentMatch,
  MatchCenterStanding,
  MatchCenterTeamTrends,
} from "@/lib/match-center/types";

export function parseStatAverage(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function roundAvg(value: number): number {
  return Math.round(value * 100) / 100;
}

function rate(hits: number, sample: number): number | null {
  if (sample <= 0) return null;
  return Math.round((hits / sample) * 1000) / 1000;
}

export function trendsFromRecent(
  matches: MatchCenterRecentMatch[],
): Pick<
  MatchCenterTeamTrends,
  | "recentSample"
  | "goalsScoredAvg"
  | "goalsConcededAvg"
  | "cleanSheets"
  | "cleanSheetPct"
  | "bttsPct"
  | "over25Pct"
> {
  const scored = matches.filter(
    (match) => match.goalsFor != null && match.goalsAgainst != null,
  );
  const sample = scored.length;
  if (sample === 0) {
    return {
      recentSample: 0,
      goalsScoredAvg: null,
      goalsConcededAvg: null,
      cleanSheets: null,
      cleanSheetPct: null,
      bttsPct: null,
      over25Pct: null,
    };
  }

  const goalsFor = scored.reduce((sum, match) => sum + (match.goalsFor ?? 0), 0);
  const goalsAgainst = scored.reduce(
    (sum, match) => sum + (match.goalsAgainst ?? 0),
    0,
  );
  const cleanSheets = scored.filter((match) => match.goalsAgainst === 0).length;
  const btts = scored.filter(
    (match) => (match.goalsFor ?? 0) > 0 && (match.goalsAgainst ?? 0) > 0,
  ).length;
  const over25 = scored.filter(
    (match) => (match.goalsFor ?? 0) + (match.goalsAgainst ?? 0) > 2.5,
  ).length;

  return {
    recentSample: sample,
    goalsScoredAvg: roundAvg(goalsFor / sample),
    goalsConcededAvg: roundAvg(goalsAgainst / sample),
    cleanSheets,
    cleanSheetPct: rate(cleanSheets, sample),
    bttsPct: rate(btts, sample),
    over25Pct: rate(over25, sample),
  };
}

export function mergeTeamTrends(
  recent: MatchCenterRecentMatch[],
  snapshot?: MatchAnalysisTeamStatSnapshot | null,
): MatchCenterTeamTrends | null {
  const lastFive = trendsFromRecent(recent);
  const seasonClean = snapshot?.cleanSheets ?? null;
  const seasonFor = snapshot?.goalsForAverage ?? null;
  const seasonAgainst = snapshot?.goalsAgainstAverage ?? null;
  const emptyRecent = lastFive.recentSample === 0;
  const emptySeason =
    seasonClean == null && seasonFor == null && seasonAgainst == null;
  if (emptyRecent && emptySeason) return null;

  return {
    recentSample: lastFive.recentSample,
    goalsScoredAvg: lastFive.goalsScoredAvg ?? seasonFor,
    goalsConcededAvg: lastFive.goalsConcededAvg ?? seasonAgainst,
    seasonGoalsScoredAvg: seasonFor,
    seasonGoalsConcededAvg: seasonAgainst,
    cleanSheets: lastFive.cleanSheets,
    seasonCleanSheets: seasonClean,
    cleanSheetPct: lastFive.cleanSheetPct,
    bttsPct: lastFive.bttsPct,
    over25Pct: lastFive.over25Pct,
  };
}

export function standingFromTable(
  payload: ApiFootballStandingLeague[] | undefined,
  teamExternalId: string,
): MatchCenterStanding | null {
  if (!payload?.length) return null;
  const teamId = Number(teamExternalId);
  if (!Number.isFinite(teamId)) return null;
  for (const row of payload) {
    const table = row.league?.standings?.flat() ?? [];
    const hit = table.find((entry) => entry.team?.id === teamId);
    if (!hit) continue;
    return {
      teamId: String(hit.team.id),
      teamName: hit.team.name,
      rank: hit.rank,
      points: hit.points,
      played: hit.all?.played ?? null,
      wins: hit.all?.win ?? null,
      draws: hit.all?.draw ?? null,
      losses: hit.all?.lose ?? null,
      goalsFor: hit.all?.goals?.for ?? null,
      goalsAgainst: hit.all?.goals?.against ?? null,
      goalsDiff: hit.goalsDiff ?? null,
      form: hit.form ?? null,
    };
  }
  return null;
}

export type HeadToHeadSummary = {
  meetings: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  bttsPct: number | null;
  over25Pct: number | null;
};

export function summarizeHeadToHead(
  meetings: MatchCenterH2HMeeting[],
): HeadToHeadSummary | null {
  const scored = meetings.filter(
    (meeting) => meeting.homeGoals != null && meeting.awayGoals != null,
  );
  if (scored.length === 0) return null;
  const homeWins = scored.filter(
    (meeting) => (meeting.homeGoals ?? 0) > (meeting.awayGoals ?? 0),
  ).length;
  const awayWins = scored.filter(
    (meeting) => (meeting.awayGoals ?? 0) > (meeting.homeGoals ?? 0),
  ).length;
  const draws = scored.length - homeWins - awayWins;
  const btts = scored.filter(
    (meeting) => (meeting.homeGoals ?? 0) > 0 && (meeting.awayGoals ?? 0) > 0,
  ).length;
  const over25 = scored.filter(
    (meeting) => (meeting.homeGoals ?? 0) + (meeting.awayGoals ?? 0) > 2.5,
  ).length;
  return {
    meetings: scored.length,
    homeWins,
    draws,
    awayWins,
    bttsPct: rate(btts, scored.length),
    over25Pct: rate(over25, scored.length),
  };
}
