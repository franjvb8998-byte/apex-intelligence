import { describe, expect, it } from "vitest";
import {
  mostLikelyOutcome,
  normalizeOutcomeProbability,
  normalizedEntropy,
  softmaxFromScores,
} from "@/lib/intelligence/modules/probability/math/normalize";
import { ProbabilityService } from "@/lib/intelligence/modules/probability";

describe("probability utilities", () => {
  it("normalizes a 1X2 triple to sum 1", () => {
    const p = normalizeOutcomeProbability({ home: 2, draw: 1, away: 1 });
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
    expect(p.home).toBeCloseTo(0.5, 12);
  });

  it("applies stable softmax", () => {
    const p = softmaxFromScores({ home: 10, draw: 0, away: 0 });
    expect(p.home).toBeGreaterThan(0.99);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
  });

  it("picks most likely with deterministic ties", () => {
    expect(
      mostLikelyOutcome({ home: 0.4, draw: 0.4, away: 0.2 }),
    ).toBe("home");
  });

  it("returns max entropy for uniform distribution", () => {
    expect(
      normalizedEntropy({ home: 1 / 3, draw: 1 / 3, away: 1 / 3 }),
    ).toBeCloseTo(1, 8);
  });

  it("exposes the same behavior via ProbabilityService", () => {
    const service = new ProbabilityService();
    const p = service.normalize({ home: 1, draw: 1, away: 2 });
    expect(service.mostLikely(p)).toBe("away");
    expect(service.uncertainty(p)).toBeGreaterThan(0.5);
  });
});
