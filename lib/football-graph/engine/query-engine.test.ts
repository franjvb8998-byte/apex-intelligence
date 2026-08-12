import { describe, expect, it } from "vitest";
import { createFootballIntelligenceGraph } from "@/lib/football-graph";

describe("Football Intelligence Graph", () => {
  it("loads mock neighborhood for a match", async () => {
    const graph = createFootballIntelligenceGraph();
    const neighborhood = await graph.query.getNeighborhood("match-a");

    expect(neighborhood?.match.homeTeamId).toBe("team-nor");
    expect(neighborhood?.relatedIds.eventIds.length).toBeGreaterThan(0);
    expect(neighborhood?.relatedIds.styleIds.length).toBeGreaterThan(0);
  });

  it("finds similar matches with scores in [0,1]", async () => {
    const graph = createFootballIntelligenceGraph();
    const similar = await graph.query.findSimilarMatches({
      matchId: "match-a",
      limit: 5,
    });

    expect(similar.length).toBeGreaterThan(0);
    for (const row of similar) {
      expect(row.candidateMatchId).not.toBe("match-a");
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(1);
      expect(row.dimensions.length).toBeGreaterThan(0);
    }
  });

  it("discovers at least one pattern from the mock seed", async () => {
    const graph = createFootballIntelligenceGraph();
    const patterns = await graph.query.discoverPatterns({
      minConfidence: 0.4,
    });

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]?.matchIds.length).toBeGreaterThan(0);
  });
});
