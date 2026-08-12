import type { GraphId } from "@/lib/football-graph/types/ids";
import type { MatchNode } from "@/lib/football-graph/types/entities";

export type MatchSimilarityDimension =
  | "scoreline"
  | "competition"
  | "style"
  | "tempo"
  | "xg_profile"
  | "events";

export type MatchSimilarityScore = {
  matchId: GraphId;
  candidateMatchId: GraphId;
  score: number;
  dimensions: Array<{
    key: MatchSimilarityDimension;
    score: number;
    weight: number;
  }>;
  rationale: string[];
};

export type PatternKind =
  | "late_equalizer"
  | "high_press_collapse"
  | "set_piece_cluster"
  | "dominance_without_goals"
  | "custom";

export type DiscoveredPattern = {
  id: GraphId;
  kind: PatternKind;
  label: string;
  matchIds: GraphId[];
  confidence: number;
  signals: string[];
  summary: string;
};

export type SimilarityQuery = {
  matchId: GraphId;
  limit?: number;
  /** Optional dimension weights (missing → engine defaults). */
  weights?: Partial<Record<MatchSimilarityDimension, number>>;
};

export type PatternQuery = {
  competitionId?: GraphId;
  matchIds?: GraphId[];
  kinds?: PatternKind[];
  minConfidence?: number;
};

export type MatchNeighborhood = {
  match: MatchNode;
  relatedIds: {
    homeTeamId: GraphId;
    awayTeamId: GraphId;
    competitionId: GraphId;
    stadiumId: GraphId | null;
    refereeId: GraphId | null;
    eventIds: GraphId[];
    styleIds: GraphId[];
    metricIds: GraphId[];
  };
};
