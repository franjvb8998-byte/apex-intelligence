import { describe, expect, it } from "vitest";
import {
  confidenceFromHybrid,
  estimateEloFromTeamId,
} from "@/lib/intelligence/modules/probability";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";

describe("shared PE helpers", () => {
  it("returns the side base and ignores team id (Sprint 5B.1)", () => {
    const a = estimateEloFromTeamId("42", 1500);
    const b = estimateEloFromTeamId("42", 1500);
    expect(a).toBe(1500);
    expect(b).toBe(1500);
    expect(estimateEloFromTeamId("49", 1500)).toBe(1500);
    expect(estimateEloFromTeamId("apex:api-football:team:17885", 1580)).toBe(
      1580,
    );
  });

  it("maps PE entropy to a 0–1 ConfidenceScore", () => {
    const engine = createEloPoissonHybridEngine();
    const result = engine.predict({ homeElo: 1700, awayElo: 1400 });
    const confidence = confidenceFromHybrid(result);
    expect(confidence.value).toBeGreaterThan(0);
    expect(confidence.value).toBeLessThanOrEqual(1);
    expect(["low", "medium", "high"]).toContain(confidence.band);
  });
});
