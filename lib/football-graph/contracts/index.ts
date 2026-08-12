import type { GraphEntity, GraphEntityKind, GraphId } from "@/lib/football-graph/types";
import type { GraphEdge, GraphRelationType } from "@/lib/football-graph/types";
import type {
  DiscoveredPattern,
  MatchNeighborhood,
  MatchSimilarityScore,
  PatternQuery,
  SimilarityQuery,
} from "@/lib/football-graph/types";

export interface GraphNodeRepository {
  getById(id: GraphId): Promise<GraphEntity | null>;
  listByKind(kind: GraphEntityKind): Promise<GraphEntity[]>;
  upsert(entity: GraphEntity): Promise<GraphEntity>;
}

export interface GraphEdgeRepository {
  listFrom(nodeId: GraphId, type?: GraphRelationType): Promise<GraphEdge[]>;
  listTo(nodeId: GraphId, type?: GraphRelationType): Promise<GraphEdge[]>;
  upsert(edge: GraphEdge): Promise<GraphEdge>;
}

export interface MatchGraphRepository {
  getMatch(id: GraphId): Promise<MatchNeighborhood | null>;
  listMatches(competitionId?: GraphId): Promise<import("@/lib/football-graph/types").MatchNode[]>;
}

/**
 * Query engine port — similarity + pattern discovery.
 * Implementations must not call external HTTP/DB directly; inject repos.
 */
export interface FootballGraphQueryEngine {
  findSimilarMatches(query: SimilarityQuery): Promise<MatchSimilarityScore[]>;
  discoverPatterns(query?: PatternQuery): Promise<DiscoveredPattern[]>;
  getNeighborhood(matchId: GraphId): Promise<MatchNeighborhood | null>;
}

/**
 * Source adapter — maps an external catalog into graph upserts.
 * Mock today; API-Football / Data Platform later.
 */
export interface FootballGraphSourceAdapter {
  readonly id: string;
  loadSnapshot(): Promise<{
    nodes: GraphEntity[];
    edges: GraphEdge[];
  }>;
}
