import { describe, expect, it } from "vitest";
import {
  confidenceFromHybrid,
  estimateEloFromTeamId,
} from "@/lib/intelligence/modules/probability";
import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";

describe("shared PE helpers", () => {
  it("hashes team ids to a stable Elo around the base", () => {
    const a = estimateEloFromTeamId("42", 1500);
    const b = estimateEloFromTeamId("42", 1500);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(1375);
    expect(a).toBeLessThanOrEqual(1625);
    expect(estimateEloFromTeamId("49", 1500)).not.toBe(a);
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
