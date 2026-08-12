import type { FootballGraphQueryEngine } from "@/lib/football-graph/contracts";
import {
  createFootballGraphQueryEngine,
} from "@/lib/football-graph/engine/query-engine";
import { createMockFootballGraph } from "@/lib/football-graph/repositories/mock";

export type FootballIntelligenceGraph = {
  nodes: ReturnType<typeof createMockFootballGraph>["nodes"];
  edges: ReturnType<typeof createMockFootballGraph>["edges"];
  matches: ReturnType<typeof createMockFootballGraph>["matches"];
  source: ReturnType<typeof createMockFootballGraph>["source"];
  query: FootballGraphQueryEngine;
};

/**
 * Composition root for the Football Intelligence Graph (mock-backed).
 * Swap repositories/adapters without changing callers.
 */
export function createFootballIntelligenceGraph(): FootballIntelligenceGraph {
  const graph = createMockFootballGraph();
  const query = createFootballGraphQueryEngine(graph.nodes, graph.matches);
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    matches: graph.matches,
    source: graph.source,
    query,
  };
}
