import { describe, expect, it } from "vitest";
import {
  createInitialVisionState,
  simulateVisionTick,
} from "@/lib/apex-vision";

describe("APEX Vision mock simulation", () => {
  it("seeds 22 players and a ball", () => {
    const state = createInitialVisionState();
    expect(state.players).toHaveLength(22);
    expect(state.ball.x).toBeGreaterThan(0);
    expect(state.source).toBe("mock");
  });

  it("appends an event and updates live metrics on tick", () => {
    const prev = createInitialVisionState();
    const next = simulateVisionTick(prev);
    const latest = next.events[0];

    expect(next.events.length).toBeGreaterThanOrEqual(prev.events.length);
    expect(latest?.id).not.toBe(prev.events[0]?.id);
    expect(latest?.aiExplanation.length).toBeGreaterThan(10);
    expect(latest?.whyChanged.length).toBeGreaterThan(0);
    expect(typeof latest?.momentumDelta).toBe("number");
    expect(latest?.probabilityImpact).toBeDefined();
    expect(next.possessionHome).toBeGreaterThanOrEqual(35);
    expect(next.possessionHome).toBeLessThanOrEqual(70);
    expect(next.markets.homeWin + next.markets.draw + next.markets.awayWin).toBeCloseTo(
      1,
      5,
    );
  });
});
