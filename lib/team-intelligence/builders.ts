/**
 * Adapters into TeamIntelligenceInput. No HTTP. Missing fields stay null.
 */

import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";
import type {
  MatchCenterAbsence,
  MatchCenterFormSide,
  MatchCenterLineup,
  MatchCenterMeta,
  MatchCenterPreviewDashboard,
  MatchCenterStanding,
  MatchCenterTeam,
  MatchCenterTeamTrends,
} from "@/lib/match-center/types";
import type { PlayingStyleAxes } from "@/lib/football-graph/types";
import type { MatchOutcome } from "@/lib/intelligence/types";
import { evaluateMatchClubTwins } from "@/lib/team-intelligence/engine";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import type {
  StyleAxes,
  TeamIntelligenceInput,
  TransferFeed,
  VenueRecord,
} from "@/lib/team-intelligence/types";

const SILENT_TRANSFERS: TransferFeed = {
  published: false,
  incoming: null,
  outgoing: null,
  estimatedImpact: null,
  managerChanged: null,
  youthPromotions: null,
};

const SILENT_ABSENCES = { published: false, items: [] as never[] };

export const EMPTY_TEAM_INTELLIGENCE_TRANSFERS = SILENT_TRANSFERS;

export function emptyTeamIntelligenceInput(
  over: Partial<TeamIntelligenceInput> & {
    identity: TeamIntelligenceInput["identity"];
    asOf: string;
  },
): TeamIntelligenceInput {
  return {
    asOf: over.asOf,
    identity: over.identity,
    table: over.table ?? {
      rank: null,
      points: null,
      played: null,
      teamsInTable: null,
      description: null,
    },
    season: over.season ?? {
      played: null,
      wins: null,
      draws: null,
      losses: null,
      goalsFor: null,
      goalsAgainst: null,
      goalsForAverage: null,
      goalsAgainstAverage: null,
      cleanSheets: null,
      failedToScore: null,
      home: null,
      away: null,
      form: null,
    },
    recent: over.recent ?? [],
    absences: over.absences ?? {
      injuries: { ...SILENT_ABSENCES, items: [] },
      suspensions: { ...SILENT_ABSENCES, items: [] },
    },
    squad: over.squad ?? { listed: null, starters: null, bench: null },
    schedule: over.schedule ?? {
      nextKickoffAt: null,
      nextIsDerby: null,
      rivalry: null,
      travelKm: null,
    },
    environment: over.environment ?? {
      weather: null,
      altitudeMeters: null,
      refereeName: null,
    },
    transfers: over.transfers ?? SILENT_TRANSFERS,
    styleAxes: over.styleAxes ?? null,
    expectedGoalsSeason: over.expectedGoalsSeason ?? { for: null, against: null },
  };
}

function venueFromSnapshot(
  split: MatchAnalysisTeamStatSnapshot["homeSplit"],
): VenueRecord | null {
  if (!split || split.played <= 0) return null;
  return {
    played: split.played,
    wins: split.wins,
    draws: split.draws,
    losses: split.losses,
    goalsFor: split.goalsFor,
    goalsAgainst: split.goalsAgainst,
  };
}

function absencesFrom(
  published: boolean,
  items: MatchCenterAbsence[],
  teamId: string,
): TeamIntelligenceInput["absences"]["injuries"] {
  if (!published) return { published: false, items: [] };
  return {
    published: true,
    items: items
      .filter((item) => item.teamId == null || item.teamId === teamId)
      .map((item) => ({ playerName: item.playerName, detail: item.detail })),
  };
}

function styleFromGraph(axes: PlayingStyleAxes | null | undefined): StyleAxes | null {
  if (!axes) return null;
  return {
    possession: axes.possession,
    pressing: axes.pressing,
    directness: axes.directness,
    width: axes.width,
    tempo: axes.tempo,
  };
}

export type MatchCenterTeamIntelligenceSource = {
  asOf: string;
  team: Pick<MatchCenterTeam, "id" | "name" | "shortName" | "logoUrl">;
  country: string | null;
  leagueName: string | null;
  season: string | null;
  form: MatchCenterFormSide | null;
  standing: MatchCenterStanding | null;
  teamsInTable?: number | null;
  standingDescription?: string | null;
  trends?: MatchCenterTeamTrends | null;
  stats?: MatchAnalysisTeamStatSnapshot | null;
  lineup?: MatchCenterLineup | null;
  managerName?: string | null;
  injuries?: MatchCenterAbsence[];
  suspensions?: MatchCenterAbsence[];
  absencesPublished?: boolean;
  nextKickoffAt?: string | null;
  weather?: string | null;
  venueCapacity?: number | null;
  venueSurface?: string | null;
  refereeName?: string | null;
  playingStyle?: PlayingStyleAxes | null;
  expectedGoalsSeason?: { for: number | null; against: number | null };
  budgetTier?: TeamIntelligenceInput["identity"]["budgetTier"];
  marketValue?: number | null;
  averageSquadAge?: number | null;
  transfers?: TransferFeed;
};

/**
 * Map Match Center / Match Analysis team context into the engine snapshot.
 * Does not invent xG, travel, derbies, or transfer windows.
 */
export function teamIntelligenceInputFromMatchCenter(
  source: MatchCenterTeamIntelligenceSource,
): TeamIntelligenceInput {
  const stats = source.stats ?? null;
  const form = source.form;
  const standing = source.standing;
  const lineup = source.lineup ?? null;
  const starters = lineup?.startXI.length ?? null;
  const bench = lineup?.substitutes.length ?? null;
  const listed =
    starters != null && bench != null ? starters + bench : null;
  const absencesPublished = source.absencesPublished ?? true;

  return emptyTeamIntelligenceInput({
    asOf: source.asOf,
    identity: {
      teamId: source.team.id,
      name: source.team.name,
      shortName: source.team.shortName ?? null,
      country: source.country,
      leagueName: source.leagueName,
      season: source.season,
      managerName: source.managerName ?? null,
      formation: lineup?.formation ?? null,
      venueCapacity: source.venueCapacity ?? null,
      venueSurface: source.venueSurface ?? null,
      logoUrl: source.team.logoUrl ?? null,
      budgetTier: source.budgetTier ?? null,
      marketValue: source.marketValue ?? null,
      averageSquadAge: source.averageSquadAge ?? null,
    },
    table: {
      rank: standing?.rank ?? null,
      points: standing?.points ?? null,
      played: standing?.played ?? null,
      teamsInTable: source.teamsInTable ?? null,
      description: source.standingDescription ?? null,
    },
    season: {
      played: stats?.played ?? form?.played ?? standing?.played ?? null,
      wins: stats?.wins ?? form?.wins ?? standing?.wins ?? null,
      draws: stats?.draws ?? form?.draws ?? standing?.draws ?? null,
      losses: stats?.losses ?? form?.losses ?? standing?.losses ?? null,
      goalsFor: stats?.goalsFor ?? form?.goalsFor ?? standing?.goalsFor ?? null,
      goalsAgainst:
        stats?.goalsAgainst ?? form?.goalsAgainst ?? standing?.goalsAgainst ?? null,
      goalsForAverage:
        stats?.goalsForAverage ?? source.trends?.seasonGoalsScoredAvg ?? null,
      goalsAgainstAverage:
        stats?.goalsAgainstAverage ?? source.trends?.seasonGoalsConcededAvg ?? null,
      cleanSheets: stats?.cleanSheets ?? source.trends?.seasonCleanSheets ?? null,
      failedToScore: stats?.failedToScore ?? null,
      home: venueFromSnapshot(stats?.homeSplit),
      away: venueFromSnapshot(stats?.awaySplit),
      form: form?.form ?? stats?.form ?? standing?.form ?? null,
    },
    recent: (form?.recentMatches ?? []).map((row) => ({
      kickoffAt: row.kickoffAt,
      home: row.home,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      result: row.result,
      expectedGoalsFor: null,
      expectedGoalsAgainst: null,
      possession: null,
      shots: null,
      corners: null,
      cards: null,
      opponentName: row.opponentName,
    })),
    absences: {
      injuries: absencesFrom(
        absencesPublished,
        source.injuries ?? [],
        source.team.id,
      ),
      suspensions: absencesFrom(
        absencesPublished,
        source.suspensions ?? [],
        source.team.id,
      ),
    },
    squad: {
      listed,
      starters,
      bench,
    },
    schedule: {
      nextKickoffAt: source.nextKickoffAt ?? null,
      nextIsDerby: null,
      rivalry: null,
      travelKm: null,
    },
    environment: {
      weather: source.weather ?? null,
      altitudeMeters: null,
      refereeName: source.refereeName ?? null,
    },
    transfers: source.transfers ?? SILENT_TRANSFERS,
    styleAxes: styleFromGraph(source.playingStyle),
    expectedGoalsSeason: source.expectedGoalsSeason ?? { for: null, against: null },
  });
}

function twinSource(
  match: MatchCenterMeta,
  dash: MatchCenterPreviewDashboard,
  side: "home" | "away",
): MatchCenterTeamIntelligenceSource {
  const team = side === "home" ? match.homeTeam : match.awayTeam;
  return {
    asOf: match.kickoffAt,
    team,
    country: match.venue?.country ?? null,
    leagueName: match.leagueName,
    season: null,
    form: dash.form[side],
    standing: dash.standings[side],
    trends: dash.trends[side],
    lineup: dash.lineups[side],
    injuries: dash.injuries,
    suspensions: dash.suspensions,
    nextKickoffAt: match.kickoffAt,
    weather: match.weather,
    refereeName: match.referee,
  };
}

export function clubTwinsFromPreview(
  match: MatchCenterMeta,
  dash: MatchCenterPreviewDashboard,
): { home: TeamIntelligence; away: TeamIntelligence } {
  return evaluateMatchClubTwins(
    teamIntelligenceInputFromMatchCenter(twinSource(match, dash, "home")),
    teamIntelligenceInputFromMatchCenter(twinSource(match, dash, "away")),
  );
}

/**
 * Twin for the predicted 1X2 side. Draw uses the home twin (no invented blend).
 */
export function selectionTwinFromPreview(
  match: MatchCenterMeta,
  dash: MatchCenterPreviewDashboard,
  predicted: MatchOutcome,
): TeamIntelligence {
  const twins = clubTwinsFromPreview(match, dash);
  return predicted === "away" ? twins.away : twins.home;
}
