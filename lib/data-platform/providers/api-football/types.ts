/**
 * Vendor DTOs for API-Football fixtures responses (subset we care about).
 * Opaque to the rest of APEX — only the mapper should import these.
 */

export type ApiFootballStatusShort =
  | "TBD"
  | "NS"
  | "1H"
  | "HT"
  | "2H"
  | "ET"
  | "BT"
  | "P"
  | "SUSP"
  | "INT"
  | "FT"
  | "AET"
  | "PEN"
  | "PST"
  | "CANC"
  | "ABD"
  | "AWD"
  | "WO"
  | "LIVE"
  | string;

export type ApiFootballTeam = {
  id: number;
  name: string;
  logo?: string | null;
  winner?: boolean | null;
};

export type ApiFootballFixtureItem = {
  fixture: {
    id: number;
    referee?: string | null;
    timezone?: string;
    date: string;
    timestamp?: number;
    venue?: {
      id?: number | null;
      name?: string | null;
      city?: string | null;
    } | null;
    status: {
      long?: string;
      short: ApiFootballStatusShort;
      elapsed?: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country?: string | null;
    logo?: string | null;
    flag?: string | null;
    season?: number | null;
    round?: string | null;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: {
    halftime?: { home: number | null; away: number | null };
    fulltime?: { home: number | null; away: number | null };
    extratime?: { home: number | null; away: number | null } | null;
    penalty?: { home: number | null; away: number | null } | null;
  };
  events?: ApiFootballEvent[] | null;
  lineups?: ApiFootballLineup[] | null;
};

export type ApiFootballEvent = {
  time: { elapsed: number | null; extra?: number | null };
  team: { id: number | null; name?: string | null; logo?: string | null };
  player: { id: number | null; name?: string | null };
  assist?: { id: number | null; name?: string | null } | null;
  type: string;
  detail: string;
  comments?: string | null;
};

export type ApiFootballLineupPlayer = {
  player: {
    id: number;
    name: string;
    number?: number | null;
    pos?: string | null;
    grid?: string | null;
  };
};

export type ApiFootballLineup = {
  team: { id: number; name: string; logo?: string | null };
  formation?: string | null;
  startXI?: ApiFootballLineupPlayer[];
  substitutes?: ApiFootballLineupPlayer[];
};

export type ApiFootballOddsBetValue = {
  value: string;
  odd: string;
};

export type ApiFootballOddsBet = {
  id: number;
  name: string;
  values: ApiFootballOddsBetValue[];
};

export type ApiFootballOddsBookmaker = {
  id: number;
  name: string;
  bets: ApiFootballOddsBet[];
};

export type ApiFootballOddsItem = {
  league?: { id: number; name?: string };
  fixture?: { id: number };
  bookmakers?: ApiFootballOddsBookmaker[];
};

/** Top-level list response from API-Football. */
export type ApiFootballListResponse<T> = {
  get?: string;
  parameters?: Record<string, string>;
  errors?: unknown;
  results?: number;
  paging?: { current: number; total: number };
  response: T[];
};

export type ApiFootballFixturesResponse =
  ApiFootballListResponse<ApiFootballFixtureItem>;

export type ApiFootballEventsResponse =
  ApiFootballListResponse<ApiFootballEvent>;

export type ApiFootballOddsResponse =
  ApiFootballListResponse<ApiFootballOddsItem>;

export type ApiFootballTeamDetails = {
  team: {
    id: number;
    name: string;
    code?: string | null;
    country?: string | null;
    founded?: number | null;
    national?: boolean;
    logo?: string | null;
  };
  venue?: {
    id?: number | null;
    name?: string | null;
    address?: string | null;
    city?: string | null;
    capacity?: number | null;
    surface?: string | null;
    image?: string | null;
  } | null;
};

export type ApiFootballStandingTeam = {
  rank: number;
  team: { id: number; name: string; logo?: string | null };
  points: number;
  goalsDiff: number;
  group?: string;
  form?: string | null;
  status?: string | null;
  description?: string | null;
  all?: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

export type ApiFootballStandingLeague = {
  league: {
    id: number;
    name: string;
    country?: string;
    logo?: string | null;
    flag?: string | null;
    season: number;
    standings: ApiFootballStandingTeam[][];
  };
};

export type ApiFootballTeamsResponse =
  ApiFootballListResponse<ApiFootballTeamDetails>;

export type ApiFootballStandingsResponse =
  ApiFootballListResponse<ApiFootballStandingLeague>;

export type ApiFootballLineupsResponse =
  ApiFootballListResponse<ApiFootballLineup>;

/** GET /players */
export type ApiFootballPlayerDetails = {
  player: {
    id: number;
    name: string;
    firstname?: string | null;
    lastname?: string | null;
    age?: number | null;
    birth?: {
      date?: string | null;
      place?: string | null;
      country?: string | null;
    } | null;
    nationality?: string | null;
    height?: string | null;
    weight?: string | null;
    injured?: boolean;
    photo?: string | null;
  };
  statistics?: Array<{
    team?: { id: number; name: string; logo?: string | null } | null;
    league?: {
      id: number | null;
      name?: string | null;
      country?: string | null;
      season?: number | null;
    } | null;
    games?: {
      appearences?: number | null;
      lineups?: number | null;
      minutes?: number | null;
      number?: number | null;
      position?: string | null;
      rating?: string | null;
      captain?: boolean | null;
    } | null;
  }>;
};

export type ApiFootballPlayersResponse =
  ApiFootballListResponse<ApiFootballPlayerDetails>;

/** GET /leagues */
export type ApiFootballLeagueItem = {
  league: {
    id: number;
    name: string;
    type?: string | null;
    logo?: string | null;
  };
  country?: {
    name?: string | null;
    code?: string | null;
    flag?: string | null;
  } | null;
  seasons?: Array<{
    year: number;
    start?: string;
    end?: string;
    current?: boolean;
  }>;
};

export type ApiFootballLeaguesResponse =
  ApiFootballListResponse<ApiFootballLeagueItem>;

/** GET /teams/statistics — response is a single object (not an array). */
export type ApiFootballTeamStatistics = {
  league: {
    id: number;
    name: string;
    country?: string | null;
    logo?: string | null;
    flag?: string | null;
    season: number;
  };
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  form?: string | null;
  fixtures: {
    played: { home: number; away: number; total: number };
    wins: { home: number; away: number; total: number };
    draws: { home: number; away: number; total: number };
    loses: { home: number; away: number; total: number };
  };
  goals?: {
    for?: {
      total?: { home: number; away: number; total: number };
      average?: { home: string; away: string; total: string };
    };
    against?: {
      total?: { home: number; away: number; total: number };
      average?: { home: string; away: string; total: string };
    };
  };
};

export type ApiFootballTeamStatisticsResponse = {
  get?: string;
  parameters?: Record<string, string>;
  errors?: unknown;
  results?: number;
  paging?: { current: number; total: number };
  response: ApiFootballTeamStatistics;
};