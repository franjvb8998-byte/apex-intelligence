import { describe, expect, it } from "vitest";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { DEFAULT_OPPORTUNITY_FILTERS, filterOpportunities } from "@/lib/apex-opportunities";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";

describe("APEX Opportunities loader", () => {
  it("evaluates the recorded catalogue through the Decision Engine", async () => {
    const board = await getApexOpportunities({ env: {} });
    expect(board.analyzed.length).toBeGreaterThanOrEqual(1);
    expect(
      board.analyzed.some((row) => row.fixtureId === RECORDED_API_FOOTBALL_FIXTURE_ID),
    ).toBe(true);
    const first = board.analyzed[0]!;
    expect(first.score).toBeGreaterThanOrEqual(0);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(first.confidence).toBeGreaterThanOrEqual(0);
    expect(first.market).toBe("1x2");
    expect(first.verdict).toBeTruthy();

    const quality = filterOpportunities(board.analyzed, DEFAULT_OPPORTUNITY_FILTERS);
    expect(Array.isArray(quality)).toBe(true);
  }, 30_000);
});
