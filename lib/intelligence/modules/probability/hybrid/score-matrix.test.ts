import { describe, expect, it } from "vitest";
import {
  bothTeamsToScoreFromLambdas,
  marginalizePoissonScoreGrid,
} from "@/lib/intelligence/modules/probability/hybrid/score-matrix";

describe("bothTeamsToScoreFromLambdas", () => {
  it("sums yes + no to 1", () => {
    const btts = bothTeamsToScoreFromLambdas({
      lambdaHome: 1.45,
      lambdaAway: 1.15,
      maxGoals: 15,
    });
    expect(btts.yes + btts.no).toBeCloseTo(1, 10);
    expect(btts.yes).toBeGreaterThan(0.3);
    expect(btts.yes).toBeLessThan(0.8);
  });

  it("rises with higher scoring lambdas", () => {
    const low = bothTeamsToScoreFromLambdas({
      lambdaHome: 0.6,
      lambdaAway: 0.5,
      maxGoals: 15,
    });
    const high = bothTeamsToScoreFromLambdas({
      lambdaHome: 2.2,
      lambdaAway: 1.9,
      maxGoals: 15,
    });
    expect(high.yes).toBeGreaterThan(low.yes);
  });

  it("stays consistent with the truncated score-grid mass", () => {
    const grid = marginalizePoissonScoreGrid({
      lambdaHome: 1.4,
      lambdaAway: 1.1,
      maxGoals: 15,
    });
    expect(grid.coveredMass).toBeGreaterThan(0.99);
  });
});
