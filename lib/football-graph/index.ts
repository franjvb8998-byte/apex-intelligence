/**
 * APEX Football Intelligence Graph
 *
 * Domain graph for teams, players, coaches, referees, competitions,
 * stadiums, matches, events, playing styles and advanced metrics —
 * plus a query engine for similarity and pattern discovery.
 *
 * Mock-first. No HTTP. No real DB.
 * See docs/FOOTBALL_INTELLIGENCE_GRAPH.md
 */

export type * from "@/lib/football-graph/types";
export type * from "@/lib/football-graph/contracts";

export {
  createFootballIntelligenceGraph,
  type FootballIntelligenceGraph,
} from "@/lib/football-graph/platform";

export {
  createMockFootballGraph,
  InMemoryGraphStore,
  MockGraphNodeRepository,
  MockGraphEdgeRepository,
  MockMatchGraphRepository,
  MockFootballGraphSourceAdapter,
} from "@/lib/football-graph/repositories/mock";

export {
  DefaultFootballGraphQueryEngine,
  createFootballGraphQueryEngine,
} from "@/lib/football-graph/engine/query-engine";

export { createMockGraphSeed } from "@/lib/football-graph/adapters/mock-seed";
