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
import type {
  MatchCenterFormSide,
  MatchCenterH2HMeeting,
  MatchCenterPreviewDashboard,
  MatchCenterTeam,
} from "@/lib/match-center/types";

export type PreviewDashboardInput = {
  btts: BothTeamsToScoreProbability;
  oneXTwo: { home: number; draw: number; away: number };
  overUnder25: { over: number; under: number };
  odds: ApexOddsQuote[];
  analysis: MatchAnalysis;
  teamStats?: MatchAnalysisTeamStats;
  h2h?: MatchCenterH2HMeeting[];
  injuries?: MatchAnalysisInjury[];
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
    injuries: [],
    recommendation: {
      id: "rec-pending",
      title: "Pendiente",
      action: "watch",
      priority: "low",
      rationale: "",
      confidence: { value: 0, band: "low" },
    },
    valueBet: null,
  };
}

function toFormSide(
  team: MatchCenterTeam,
  snapshot: MatchAnalysisTeamStatSnapshot | null | undefined,
): MatchCenterFormSide | null {
  if (!snapshot) return null;
  return {
    teamId: team.id,
    teamName: snapshot.teamName ?? team.name,
    form: snapshot.form ?? null,
    played: snapshot.played ?? null,
    wins: snapshot.wins ?? null,
    draws: snapshot.draws ?? null,
    losses: snapshot.losses ?? null,
    goalsFor: snapshot.goalsFor ?? null,
    goalsAgainst: snapshot.goalsAgainst ?? null,
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
      home: toFormSide(input.homeTeam, input.teamStats?.home),
      away: toFormSide(input.awayTeam, input.teamStats?.away),
    },
    h2h: input.h2h ?? [],
    injuries: input.injuries ?? input.analysis.injuries,
    recommendation: input.analysis.recommendation,
    valueBet: input.analysis.valueBet,
  };
}
