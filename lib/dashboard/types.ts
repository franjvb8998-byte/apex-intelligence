/**
 * Dashboard view-model — provider-agnostic DTOs.
 * Same shape for mock and API-Football.
 */

export type DashboardProviderKind = "mock" | "api-football";

export type DashboardDataMode = "mock" | "live" | "recorded";

export type DashboardMatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export type DashboardMatchSummary = {
  id: string;
  externalId: string | null;
  kickoffAt: string;
  status: DashboardMatchStatus;
  leagueName: string | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  score: { home: number | null; away: number | null };
};

export type DashboardLeagueSummary = {
  id: string;
  externalId: string | null;
  name: string;
  country: string | null;
  season: string | null;
};

export type DashboardTeamSummary = {
  id: string;
  externalId: string | null;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  leagueName: string | null;
};

export type DashboardSystemStatus = {
  provider: DashboardProviderKind;
  dataMode: DashboardDataMode;
  hasApiKey: boolean;
  displayName: string;
  todayCount: number;
  upcomingCount: number;
  leagueCount: number;
  teamCount: number;
  message: string;
  checkedAt: string;
};

export type DashboardData = {
  system: DashboardSystemStatus;
  todayMatches: DashboardMatchSummary[];
  upcomingMatches: DashboardMatchSummary[];
  leagues: DashboardLeagueSummary[];
  featuredTeams: DashboardTeamSummary[];
  /** External id used for the featured Match Center panel. */
  featuredMatchId: string;
};
