import type { GraphId, GraphNodeBase } from "@/lib/football-graph/types/ids";

export type TeamNode = GraphNodeBase & {
  kind: "team";
  shortName: string;
  country: string | null;
  competitionIds: GraphId[];
};

export type PlayerNode = GraphNodeBase & {
  kind: "player";
  teamId: GraphId | null;
  position: "gk" | "df" | "mf" | "fw" | "unknown";
  shirtNumber: number | null;
  nationality: string | null;
};

export type CoachNode = GraphNodeBase & {
  kind: "coach";
  teamId: GraphId | null;
  nationality: string | null;
};

export type RefereeNode = GraphNodeBase & {
  kind: "referee";
  nationality: string | null;
};

export type CompetitionNode = GraphNodeBase & {
  kind: "competition";
  country: string | null;
  season: string | null;
  tier: number | null;
};

export type StadiumNode = GraphNodeBase & {
  kind: "stadium";
  city: string | null;
  country: string | null;
  capacity: number | null;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type MatchNode = GraphNodeBase & {
  kind: "match";
  competitionId: GraphId;
  homeTeamId: GraphId;
  awayTeamId: GraphId;
  stadiumId: GraphId | null;
  refereeId: GraphId | null;
  kickoffAt: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export type MatchEventType =
  | "goal"
  | "own_goal"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "penalty"
  | "var"
  | "other";

export type EventNode = GraphNodeBase & {
  kind: "event";
  matchId: GraphId;
  teamId: GraphId | null;
  playerId: GraphId | null;
  minute: number | null;
  eventType: MatchEventType;
};

export type PlayingStyleAxes = {
  possession: number;
  pressing: number;
  directness: number;
  width: number;
  tempo: number;
};

export type PlayingStyleNode = GraphNodeBase & {
  kind: "playing_style";
  /** Subject this style describes (usually a team). */
  subjectId: GraphId;
  axes: PlayingStyleAxes;
};

export type AdvancedMetricKey =
  | "xg"
  | "xga"
  | "xp"
  | "pressures"
  | "progressive_passes"
  | "field_tilt"
  | "ppda"
  | "custom";

export type MetricNode = GraphNodeBase & {
  kind: "metric";
  subjectId: GraphId;
  matchId: GraphId | null;
  key: AdvancedMetricKey;
  value: number;
  unit: string | null;
};

export type GraphEntity =
  | TeamNode
  | PlayerNode
  | CoachNode
  | RefereeNode
  | CompetitionNode
  | StadiumNode
  | MatchNode
  | EventNode
  | PlayingStyleNode
  | MetricNode;
