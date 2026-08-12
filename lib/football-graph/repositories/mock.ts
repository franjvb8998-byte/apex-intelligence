import type {
  GraphEdge,
  GraphEntity,
  GraphEntityKind,
  GraphId,
  GraphRelationType,
  MatchNode,
} from "@/lib/football-graph/types";
import type { MatchNeighborhood } from "@/lib/football-graph/types";
import type {
  FootballGraphSourceAdapter,
  GraphEdgeRepository,
  GraphNodeRepository,
  MatchGraphRepository,
} from "@/lib/football-graph/contracts";
import { createMockGraphSeed } from "@/lib/football-graph/adapters/mock-seed";

/**
 * In-memory graph store shared by mock repositories.
 * Swap for Postgres/Neo4j-backed store later without changing ports.
 */
export class InMemoryGraphStore {
  readonly nodes = new Map<GraphId, GraphEntity>();
  readonly edges = new Map<GraphId, GraphEdge>();

  load(nodes: GraphEntity[], edges: GraphEdge[]): void {
    this.nodes.clear();
    this.edges.clear();
    for (const node of nodes) this.nodes.set(node.id, node);
    for (const edge of edges) this.edges.set(edge.id, edge);
  }
}

export class MockGraphNodeRepository implements GraphNodeRepository {
  constructor(private readonly store: InMemoryGraphStore) {}

  async getById(id: GraphId): Promise<GraphEntity | null> {
    return this.store.nodes.get(id) ?? null;
  }

  async listByKind(kind: GraphEntityKind): Promise<GraphEntity[]> {
    return [...this.store.nodes.values()].filter((node) => node.kind === kind);
  }

  async upsert(entity: GraphEntity): Promise<GraphEntity> {
    this.store.nodes.set(entity.id, entity);
    return entity;
  }
}

export class MockGraphEdgeRepository implements GraphEdgeRepository {
  constructor(private readonly store: InMemoryGraphStore) {}

  async listFrom(
    nodeId: GraphId,
    type?: GraphRelationType,
  ): Promise<GraphEdge[]> {
    return [...this.store.edges.values()].filter(
      (edge) =>
        edge.fromId === nodeId && (type ? edge.type === type : true),
    );
  }

  async listTo(
    nodeId: GraphId,
    type?: GraphRelationType,
  ): Promise<GraphEdge[]> {
    return [...this.store.edges.values()].filter(
      (edge) => edge.toId === nodeId && (type ? edge.type === type : true),
    );
  }

  async upsert(edge: GraphEdge): Promise<GraphEdge> {
    this.store.edges.set(edge.id, edge);
    return edge;
  }
}

export class MockMatchGraphRepository implements MatchGraphRepository {
  constructor(
    private readonly nodes: GraphNodeRepository,
    private readonly edges: GraphEdgeRepository,
  ) {}

  async listMatches(competitionId?: GraphId): Promise<MatchNode[]> {
    const matches = (await this.nodes.listByKind("match")) as MatchNode[];
    if (!competitionId) return matches;
    return matches.filter((match) => match.competitionId === competitionId);
  }

  async getMatch(id: GraphId): Promise<MatchNeighborhood | null> {
    const entity = await this.nodes.getById(id);
    if (!entity || entity.kind !== "match") return null;

    const fromEvents = await this.edges.listTo(id, "occurred_in");
    const styleHome = await this.edges.listFrom(entity.homeTeamId, "has_style");
    const styleAway = await this.edges.listFrom(entity.awayTeamId, "has_style");
    const metricsHome = await this.edges.listFrom(entity.homeTeamId, "has_metric");
    const metricsAway = await this.edges.listFrom(entity.awayTeamId, "has_metric");

    const metricIds = [...metricsHome, ...metricsAway]
      .map((edge) => edge.toId)
      .filter((metricId) => {
        // keep metrics tied to this match when available
        return true;
      });

    // Filter metrics that belong to this match
    const filteredMetricIds: GraphId[] = [];
    for (const metricId of metricIds) {
      const metric = await this.nodes.getById(metricId);
      if (
        metric?.kind === "metric" &&
        (metric.matchId === id || metric.matchId == null)
      ) {
        filteredMetricIds.push(metricId);
      }
    }

    return {
      match: entity,
      relatedIds: {
        homeTeamId: entity.homeTeamId,
        awayTeamId: entity.awayTeamId,
        competitionId: entity.competitionId,
        stadiumId: entity.stadiumId,
        refereeId: entity.refereeId,
        eventIds: fromEvents.map((edge) => edge.fromId),
        styleIds: [...styleHome, ...styleAway].map((edge) => edge.toId),
        metricIds: filteredMetricIds,
      },
    };
  }
}

export class MockFootballGraphSourceAdapter
  implements FootballGraphSourceAdapter
{
  readonly id = "mock-football-graph";

  async loadSnapshot() {
    return createMockGraphSeed();
  }
}

export function createMockFootballGraph() {
  const store = new InMemoryGraphStore();
  const seed = createMockGraphSeed();
  store.load(seed.nodes, seed.edges);

  const nodes = new MockGraphNodeRepository(store);
  const edges = new MockGraphEdgeRepository(store);
  const matches = new MockMatchGraphRepository(nodes, edges);
  const source = new MockFootballGraphSourceAdapter();

  return { store, nodes, edges, matches, source };
}
