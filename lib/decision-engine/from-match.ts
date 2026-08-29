/**
 * Adapter: Match Analysis + Match Center extras → Decision Engine input.
 * The engine itself stays free of UI / Next types.
 */

import { buildReportFacts } from "@/lib/intelligence-report/facts";
import { evaluateDecision } from "@/lib/decision-engine/evaluate";
import type { ApexDecision, ApexDecisionInput, ApexDecisionSide } from "@/lib/decision-engine/types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterOddsRow,
  MatchCenterRecentMatch,
} from "@/lib/match-center/types";

export type MatchAnalysisCore = Omit<MatchAnalysisData, "report" | "decision">;

export type DecisionMatchExtras = {
  injuries?: MatchCenterAbsence[];
  homeForm?: MatchCenterFormSide | null;
  awayForm?: MatchCenterFormSide | null;
  weather?: string | null;
  odds?: MatchCenterOddsRow[];
};

function consecutiveAway(
  recent: MatchCenterRecentMatch[],
  kickoffAt: string,
): number {
  const kickoff = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoff)) return 0;
  const prior = recent
    .filter((row) => {
      const ts = Date.parse(row.kickoffAt);
      return Number.isFinite(ts) && ts < kickoff;
    })
    .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt));
  let count = 0;
  for (const row of prior) {
    if (row.home) break;
    count += 1;
  }
  return count;
}

function toSide(
  side: ReturnType<typeof buildReportFacts>["home"],
  recent: MatchCenterRecentMatch[],
  kickoffAt: string,
  rank: number | null,
): ApexDecisionSide {
  return {
    name: side.name,
    formLetters: side.formLetters,
    formQuality: side.formQuality,
    restDays: side.restDays,
    matchesLast7: side.matchesLast7,
    goalsFor: side.goalsFor,
    goalsAgainst: side.goalsAgainst,
    played: side.played,
    awayWinPct: side.awayWinPct,
    injuryCount: side.injuryCount,
    consecutiveAway: consecutiveAway(recent, kickoffAt),
    rank,
  };
}

export function decisionInputFromMatch(
  data: MatchAnalysisCore,
  extras: DecisionMatchExtras = {},
): ApexDecisionInput {
  const facts = buildReportFacts({
    data,
    injuries: extras.injuries ?? [],
    homeForm: extras.homeForm ?? null,
    awayForm: extras.awayForm ?? null,
    weather: extras.weather ?? null,
    odds: extras.odds ?? [],
  });
  const predictedLabel =
    data.predictedOutcome === "home"
      ? `Victoria ${data.homeTeam.name}`
      : data.predictedOutcome === "away"
        ? `Victoria ${data.awayTeam.name}`
        : "Empate";

  return {
    matchId: data.matchId,
    kickoffAt: data.kickoffAt,
    predicted: data.predictedOutcome,
    predictedLabel,
    homeName: data.homeTeam.name,
    awayName: data.awayTeam.name,
    oneXTwo: data.oneXTwo,
    expectedGoals: data.expectedGoals,
    decimalOdds: facts.bestOdds?.decimal ?? null,
    bookmaker: facts.bestOdds?.bookmaker ?? null,
    bookmakerCount: extras.odds?.length
      ? new Set(
          extras.odds
            .filter((row) => row.market === "1x2" && row.bookmaker)
            .map((row) => row.bookmaker),
        ).size || 1
      : facts.bestOdds
        ? 1
        : 0,
    home: toSide(
      facts.home,
      extras.homeForm?.recentMatches?.length
        ? extras.homeForm.recentMatches
        : data.recentMatches.home,
      data.kickoffAt,
      data.leaguePosition.home?.rank ?? null,
    ),
    away: toSide(
      facts.away,
      extras.awayForm?.recentMatches?.length
        ? extras.awayForm.recentMatches
        : data.recentMatches.away,
      data.kickoffAt,
      data.leaguePosition.away?.rank ?? null,
    ),
    h2h: facts.h2h,
    weather: extras.weather ?? null,
  };
}

export function evaluateMatchDecision(
  data: MatchAnalysisCore,
  extras: DecisionMatchExtras = {},
): ApexDecision {
  return evaluateDecision(decisionInputFromMatch(data, extras));
}
