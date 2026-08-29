/**
 * Assemble the Match Center Preview dashboard from PE + analysis + catalogue extras.
 */

import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { BothTeamsToScoreProbability } from "@/lib/intelligence/modules/probability";
import type {
  MatchAnalysis,
  MatchAnalysisInjury,
  MatchAnalysisTeamStatSnapshot,
  MatchAnalysisTeamStats,
} from "@/lib/match-analysis/analysis-types";
import { buildOddsEvRows } from "@/lib/match-center/markets";
import { formLettersFromRecent } from "@/lib/match-center/team-context";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterH2HMeeting,
  MatchCenterLineup,
  MatchCenterPreviewDashboard,
  MatchCenterRecentMatch,
  MatchCenterStanding,
  MatchCenterTeam,
  MatchCenterTeamTrends,
} from "@/lib/match-center/types";

export type PreviewDashboardInput = {
  btts: BothTeamsToScoreProbability;
  oneXTwo: { home: number; draw: number; away: number };
  overUnder25: { over: number; under: number };
  odds: ApexOddsQuote[];
  analysis: MatchAnalysis;
  teamStats?: MatchAnalysisTeamStats;
  h2h?: MatchCenterH2HMeeting[];
  injuries?: MatchCenterAbsence[] | MatchAnalysisInjury[];
  suspensions?: MatchCenterAbsence[];
  recent?: {
    home?: MatchCenterRecentMatch[];
    away?: MatchCenterRecentMatch[];
  };
  lineups?: {
    home: MatchCenterLineup | null;
    away: MatchCenterLineup | null;
  };
  standings?: {
    home: MatchCenterStanding | null;
    away: MatchCenterStanding | null;
  };
  trends?: {
    home: MatchCenterTeamTrends | null;
    away: MatchCenterTeamTrends | null;
  };
  homeTeam: MatchCenterTeam;
  awayTeam: MatchCenterTeam;
};

export function placeholderPreviewDashboard(
  btts: BothTeamsToScoreProbability,
): MatchCenterPreviewDashboard {
  return {
    btts,
    odds: [],
    form: { home: null, away: null },
    h2h: [],
    standings: { home: null, away: null },
    trends: { home: null, away: null },
    injuries: [],
    suspensions: [],
    lineups: { home: null, away: null },
    recommendation: {
      id: "rec-pending",
      title: "pending",
      action: "watch",
      priority: "low",
      rationale: "",
      confidence: { value: 0, band: "low" },
    },
    valueBet: null,
  };
}

function toAbsences(
  items: Array<MatchCenterAbsence | MatchAnalysisInjury> | undefined,
): MatchCenterAbsence[] {
  return (items ?? []).map((item) => ({
    id: item.id,
    playerName: item.playerName,
    teamId: item.teamId,
    teamName: "teamName" in item ? (item.teamName ?? null) : null,
    detail: item.detail,
  }));
}

function toFormSide(
  team: MatchCenterTeam,
  snapshot: MatchAnalysisTeamStatSnapshot | null | undefined,
  recentMatches: MatchCenterRecentMatch[] = [],
): MatchCenterFormSide | null {
  if (!snapshot && recentMatches.length === 0) return null;
  return {
    teamId: team.id,
    teamName: snapshot?.teamName ?? team.name,
    form: formLettersFromRecent(recentMatches) ?? snapshot?.form ?? null,
    played: snapshot?.played ?? null,
    wins: snapshot?.wins ?? null,
    draws: snapshot?.draws ?? null,
    losses: snapshot?.losses ?? null,
    goalsFor: snapshot?.goalsFor ?? null,
    goalsAgainst: snapshot?.goalsAgainst ?? null,
    recentMatches,
  };
}

export function buildPreviewDashboard(
  input: PreviewDashboardInput,
): MatchCenterPreviewDashboard {
  return {
    btts: input.btts,
    odds: buildOddsEvRows({
      quotes: input.odds,
      oneXTwo: input.oneXTwo,
      overUnder25: input.overUnder25,
      btts: input.btts,
    }),
    form: {
      home: toFormSide(
        input.homeTeam,
        input.teamStats?.home,
        input.recent?.home ?? [],
      ),
      away: toFormSide(
        input.awayTeam,
        input.teamStats?.away,
        input.recent?.away ?? [],
      ),
    },
    h2h: input.h2h ?? [],
    standings: input.standings ?? { home: null, away: null },
    trends: input.trends ?? { home: null, away: null },
    injuries: toAbsences(input.injuries ?? input.analysis.injuries),
    suspensions: input.suspensions ?? [],
    lineups: input.lineups ?? { home: null, away: null },
    recommendation: input.analysis.recommendation,
    valueBet: input.analysis.valueBet,
  };
}
