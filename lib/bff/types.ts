/**
 * BFF — uniform API envelope and catalog DTOs.
 * Frontend-facing shapes; independent of vendor payloads.
 */

import type { DataProviderKind } from "@/lib/data-platform/types";

export type BffMeta = {
  requestId: string;
  provider: DataProviderKind | string;
  timestamp: string;
};

export type BffErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export type BffSuccessResponse<T> = {
  ok: true;
  data: T;
  meta: BffMeta;
};

export type BffErrorResponse = {
  ok: false;
  error: BffErrorBody;
  meta: BffMeta;
};

export type BffResponse<T> = BffSuccessResponse<T> | BffErrorResponse;

export type BffFixtureSummary = {
  id: string;
  externalId: string | null;
  leagueName: string | null;
  kickoffAt: string;
  status: string;
  homeTeam: { id: string; name: string; shortName: string | null };
  awayTeam: { id: string; name: string; shortName: string | null };
  score: { home: number | null; away: number | null };
  minute: number | null;
};

export type BffTeam = {
  id: string;
  externalId: string | null;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  country: string | null;
};

export type BffStandingRow = {
  rank: number;
  team: { id: string; name: string };
  points: number;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDiff: number | null;
};

export type BffStandings = {
  leagueId: string;
  leagueName: string;
  season: string;
  table: BffStandingRow[];
};

export type BffEvent = {
  id: string;
  fixtureId: string;
  minute: number | null;
  type: string;
  teamId: string | null;
  playerName: string | null;
  detail: string | null;
};

export type BffLineupPlayer = {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
};

export type BffLineup = {
  teamId: string;
  teamName: string;
  formation: string | null;
  startXI: BffLineupPlayer[];
  substitutes: BffLineupPlayer[];
};

export type BffPlayer = {
  id: string;
  externalId: string | null;
  name: string;
  nationality: string | null;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  position: string | null;
  shirtNumber: number | null;
  age: number | null;
};

export type BffLeague = {
  id: string;
  externalId: string | null;
  name: string;
  country: string | null;
  logoUrl: string | null;
  type: string | null;
  currentSeason: string | null;
};

export type BffTeamStatistics = {
  teamId: string;
  teamName: string;
  leagueId: string;
  leagueName: string;
  season: string;
  form: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
};
