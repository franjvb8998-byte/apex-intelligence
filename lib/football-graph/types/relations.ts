import type { GraphEntityKind, GraphId } from "@/lib/football-graph/types/ids";

/**
 * Directed edge vocabulary for the Football Intelligence Graph.
 * Extensible: add new relation types without changing query ports.
 */
export type GraphRelationType =
  | "plays_in" // team → competition
  | "belongs_to" // player → team
  | "coaches" // coach → team
  | "hosts" // stadium → match
  | "referees" // referee → match
  | "home_team" // match → team
  | "away_team" // match → team
  | "occurred_in" // event → match
  | "performed_by" // event → player
  | "for_team" // event → team
  | "has_style" // team → playing_style
  | "has_metric" // team|player|match → metric
  | "similar_to" // match → match (materialized similarity)
  | "pattern_of"; // pattern annotation → match

export type GraphEdge = {
  id: GraphId;
  type: GraphRelationType;
  fromId: GraphId;
  fromKind: GraphEntityKind;
  toId: GraphId;
  toKind: GraphEntityKind;
  /** Edge weight / confidence in [0, 1] when applicable. */
  weight?: number;
  properties?: Record<string, string | number | boolean | null>;
  createdAt?: string;
};

export type GraphSnapshot = {
  nodes: import("@/lib/football-graph/types/entities").GraphEntity[];
  edges: GraphEdge[];
  version: string;
};
