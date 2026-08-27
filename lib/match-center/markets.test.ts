import { describe, expect, it } from "vitest";
import { buildOddsEvRows, expectedValue } from "@/lib/match-center/markets";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";

describe("expectedValue", () => {
  it("is modelP × odds − 1", () => {
    expect(expectedValue(0.5, 2.2)).toBeCloseTo(0.1, 10);
    expect(expectedValue(0.4, 2)).toBeCloseTo(-0.2, 10);
  });

  it("returns null without usable odds", () => {
    expect(expectedValue(0.5, null)).toBeNull();
    expect(expectedValue(0.5, 1)).toBeNull();
  });
});

describe("buildOddsEvRows", () => {
  it("joins 1X2 quotes with model probabilities", () => {
    const quotes: ApexOddsQuote[] = [
      {
        id: "odds-1x2",
        matchId: "m1",
        market: "1x2",
        line: null,
        bookmaker: "MockBook",
        selections: [
          {
            key: "home",
            label: "Home",
            decimalOdds: 2.1,
            impliedProbability: 1 / 2.1,
          },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
        sourceProvider: "mock",
        externalRefs: [],
      },
    ];

    const rows = buildOddsEvRows({
      quotes,
      oneXTwo: { home: 0.48, draw: 0.27, away: 0.25 },
      overUnder25: { over: 0.55, under: 0.45 },
      btts: { yes: 0.52, no: 0.48 },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]!.modelProbability).toBe(0.48);
    expect(rows[0]!.expectedValue).toBeCloseTo(0.48 * 2.1 - 1, 8);
  });
});
