import { describe, expect, it } from "vitest";
import {
  factorial,
  poissonPmf,
  scorelineProbability,
} from "@/lib/intelligence/modules/probability/math/poisson";

describe("poisson math", () => {
  it("computes factorial", () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
  });

  it("matches known Poisson(λ=2) masses", () => {
    // P(K=0)=e^{-2}, P(K=1)=2e^{-2}, P(K=2)=2e^{-2}
    expect(poissonPmf(0, 2)).toBeCloseTo(Math.exp(-2), 10);
    expect(poissonPmf(1, 2)).toBeCloseTo(2 * Math.exp(-2), 10);
    expect(poissonPmf(2, 2)).toBeCloseTo(2 * Math.exp(-2), 10);
  });

  it("sums approximately to 1 over a wide support", () => {
    let sum = 0;
    for (let k = 0; k <= 30; k += 1) {
      sum += poissonPmf(k, 1.5);
    }
    expect(sum).toBeCloseTo(1, 5);
  });

  it("factors independent scoreline probability", () => {
    const joint = scorelineProbability(1, 0, 1.2, 0.9);
    expect(joint).toBeCloseTo(poissonPmf(1, 1.2) * poissonPmf(0, 0.9), 12);
  });
});
