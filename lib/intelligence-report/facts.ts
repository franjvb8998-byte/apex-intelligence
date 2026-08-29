/**
 * Fact extractors for the Intelligence Report. Null when the catalogue is silent.
 */

import type { MatchAnalysisVenueSplit } from "@/lib/match-analysis/analysis-types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterH2HMeeting,
  MatchCenterOddsRow,
  MatchCenterRecentMatch,
} from "@/lib/match-center/types";
import type { MatchOutcome } from "@/lib/intelligence/types";

export type ReportSideFacts = {
  name: string;
  formLetters: Array<"W" | "D" | "L">;
  formQuality: number | null;
  restDays: number | null;
  matchesLast7: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
  played: number | null;
  awayWinPct: number | null;
  injuryCount: number;
};

export type ReportFacts = {
  predicted: MatchOutcome;
  pickName: string;
  otherName: string;
  homeName: string;
  awayName: string;
  kickoffAt: string;
  home: ReportSideFacts;
  away: ReportSideFacts;
  pick: ReportSideFacts;
  other: ReportSideFacts;
  xgHome: number;
  xgAway: number;
  xgDiff: number;
  pickXg: number;
  otherXg: number;
  h2h: { pickWins: number; otherWins: number; draws: number; meetings: number } | null;
  weather: string | null;
  bestOdds: { decimal: number; bookmaker: string | null } | null;
};

function formLettersFrom(
  form: string | null | undefined,
  recent: MatchCenterRecentMatch[],
): Array<"W" | "D" | "L"> {
  const fromRecent = recent
    .map((row) => row.result)
    .filter((result): result is "W" | "D" | "L" => result === "W" || result === "D" || result === "L");
  if (fromRecent.length > 0) return fromRecent;
  const raw = form?.toUpperCase().replace(/[^WDL]/g, "") ?? "";
  return [...raw].filter((ch): ch is "W" | "D" | "L" => ch === "W" || ch === "D" || ch === "L");
}

export function formQuality(letters: Array<"W" | "D" | "L">): number | null {
  if (letters.length === 0) return null;
  let weighted = 0;
  let denom = 0;
  letters.forEach((letter, index) => {
    const w = 1 + index * 0.25;
    const pts = letter === "W" ? 1 : letter === "D" ? 0.45 : 0;
    weighted += pts * w;
    denom += w;
  });
  return denom > 0 ? weighted / denom : null;
}

function restDays(
  recent: MatchCenterRecentMatch[],
  kickoffAt: string,
): number | null {
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoff)) return null;
  const prior = recent
    .map((row) => Date.parse(row.kickoffAt))
    .filter((ts) => Number.isFinite(ts) && ts < kickoff)
    .sort((a, b) => b - a);
  const last = prior[0];
  if (last == null) return null;
  return (kickoff - last) / 86_400_000;
}

function matchesLast7(
  recent: MatchCenterRecentMatch[],
  kickoffAt: string,
): number {
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoff)) return 0;
  const windowStart = kickoff - 7 * 86_400_000;
  return recent.filter((row) => {
    const ts = Date.parse(row.kickoffAt);
    return Number.isFinite(ts) && ts < kickoff && ts >= windowStart;
  }).length;
}

function venueWinPct(split: MatchAnalysisVenueSplit | null): number | null {
  if (!split || split.played <= 0) return null;
  return split.wins / split.played;
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function h2hRecord(
  meetings: MatchCenterH2HMeeting[],
  homeName: string,
  awayName: string,
  predicted: MatchOutcome,
): ReportFacts["h2h"] {
  if (meetings.length === 0) return null;
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const row of meetings) {
    if (row.homeGoals == null || row.awayGoals == null) continue;
    if (row.homeGoals === row.awayGoals) {
      draws += 1;
      continue;
    }
    const homeWon = row.homeGoals > row.awayGoals;
    const rowHomeIsHome = namesMatch(row.homeTeamName, homeName);
    if (homeWon) {
      if (rowHomeIsHome) homeWins += 1;
      else awayWins += 1;
    } else if (rowHomeIsHome) {
      awayWins += 1;
    } else {
      homeWins += 1;
    }
  }
  const scored = homeWins + awayWins + draws;
  if (scored === 0) return null;
  const pickWins = predicted === "away" ? awayWins : homeWins;
  const otherWins = predicted === "away" ? homeWins : awayWins;
  return {
    pickWins: predicted === "draw" ? draws : pickWins,
    otherWins: predicted === "draw" ? homeWins + awayWins : otherWins,
    draws,
    meetings: scored,
  };
}

function sideFacts(input: {
  name: string;
  form: MatchCenterFormSide | null;
  recent: MatchCenterRecentMatch[];
  injuries: MatchCenterAbsence[];
  teamId: string;
  awaySplit: MatchAnalysisVenueSplit | null;
  kickoffAt: string;
}): ReportSideFacts {
  const recent =
    input.form?.recentMatches && input.form.recentMatches.length > 0
      ? input.form.recentMatches
      : input.recent;
  const letters = formLettersFrom(input.form?.form, recent);
  return {
    name: input.name,
    formLetters: letters,
    formQuality: formQuality(letters),
    restDays: restDays(recent, input.kickoffAt),
    matchesLast7: matchesLast7(recent, input.kickoffAt),
    goalsFor: input.form?.goalsFor ?? null,
    goalsAgainst: input.form?.goalsAgainst ?? null,
    played: input.form?.played ?? (recent.length > 0 ? recent.length : null),
    awayWinPct: venueWinPct(input.awaySplit),
    injuryCount: input.injuries.filter(
      (row) => row.teamId === input.teamId || namesMatch(row.teamName ?? "", input.name),
    ).length,
  };
}

export type BuildFactsInput = {
  data: Omit<MatchAnalysisData, "report" | "decision">;
  injuries: MatchCenterAbsence[];
  homeForm: MatchCenterFormSide | null;
  awayForm: MatchCenterFormSide | null;
  weather: string | null;
  odds: MatchCenterOddsRow[];
};

export function buildReportFacts(input: BuildFactsInput): ReportFacts {
  const { data } = input;
  const predicted = data.predictedOutcome;
  const home = sideFacts({
    name: data.homeTeam.name,
    form: input.homeForm,
    recent: data.recentMatches.home,
    injuries: input.injuries,
    teamId: data.homeTeam.id,
    awaySplit: data.venueSplit.home.away,
    kickoffAt: data.kickoffAt,
  });
  const away = sideFacts({
    name: data.awayTeam.name,
    form: input.awayForm,
    recent: data.recentMatches.away,
    injuries: input.injuries,
    teamId: data.awayTeam.id,
    awaySplit: data.venueSplit.away.away,
    kickoffAt: data.kickoffAt,
  });
  const pick = predicted === "away" ? away : home;
  const other = predicted === "away" ? home : away;
  const pickName =
    predicted === "home"
      ? data.homeTeam.name
      : predicted === "away"
        ? data.awayTeam.name
        : "Draw";
  const otherName = predicted === "away" ? data.homeTeam.name : data.awayTeam.name;
  const pickXg = predicted === "away" ? data.expectedGoals.away : data.expectedGoals.home;
  const otherXg = predicted === "away" ? data.expectedGoals.home : data.expectedGoals.away;

  return {
    predicted,
    pickName,
    otherName,
    homeName: data.homeTeam.name,
    awayName: data.awayTeam.name,
    kickoffAt: data.kickoffAt,
    home,
    away,
    pick,
    other,
    xgHome: data.expectedGoals.home,
    xgAway: data.expectedGoals.away,
    xgDiff: data.expectedGoals.home - data.expectedGoals.away,
    pickXg,
    otherXg,
    h2h: h2hRecord(data.h2h, data.homeTeam.name, data.awayTeam.name, predicted),
    weather: input.weather,
    bestOdds: resolveBestOdds(predicted, input.odds, data),
  };
}

function resolveBestOdds(
  predicted: MatchOutcome,
  dashboardOdds: MatchCenterOddsRow[],
  data: Omit<MatchAnalysisData, "report" | "decision">,
): { decimal: number; bookmaker: string | null } | null {
  const priced = dashboardOdds.filter(
    (row) =>
      row.market === "1x2" &&
      row.selection.toLowerCase() === predicted &&
      row.decimalOdds != null,
  );
  const best =
    priced.find((row) => row.isBest) ??
    priced.reduce<(typeof priced)[number] | null>((acc, row) => {
      if (row.decimalOdds == null) return acc;
      if (!acc || (acc.decimalOdds ?? 0) < row.decimalOdds) return row;
      return acc;
    }, null);
  if (best?.decimalOdds != null) {
    return { decimal: best.decimalOdds, bookmaker: best.bookmaker };
  }

  const marketOdds = data.markets
    .find((market) => market.type === "1x2")
    ?.selections.find((row) => row.key === predicted)?.decimalOdds;
  if (marketOdds != null && Number.isFinite(marketOdds) && marketOdds > 1) {
    return { decimal: marketOdds, bookmaker: null };
  }

  const ev = data.rating.expectedValue;
  const probability = data.oneXTwo[predicted];
  if (ev != null && probability > 0) {
    const decimal = (1 + ev) / probability;
    if (Number.isFinite(decimal) && decimal > 1) {
      return { decimal, bookmaker: null };
    }
  }
  return null;
}
