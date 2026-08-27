import { describe, expect, it } from "vitest";
import { suggestedOddsFromQuotes } from "@/lib/bankroll/odds-from-fixture";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";

describe("suggestedOddsFromQuotes", () => {
  it("maps 1X2 / O-U / BTTS selections and keeps the best price", () => {
    const quotes: ApexOddsQuote[] = [
      {
        id: "q1",
        matchId: "m1",
        market: "1x2",
        line: null,
        bookmaker: "A",
        capturedAt: "2026-01-01T00:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
        selections: [
          { key: "home", label: "Home", decimalOdds: 1.65, impliedProbability: null },
          { key: "draw", label: "Draw", decimalOdds: 4.2, impliedProbability: null },
          { key: "away", label: "Away", decimalOdds: 5, impliedProbability: null },
        ],
      },
      {
        id: "q2",
        matchId: "m1",
        market: "1x2",
        line: null,
        bookmaker: "B",
        capturedAt: "2026-01-01T00:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
        selections: [
          { key: "home", label: "Home", decimalOdds: 1.7, impliedProbability: null },
        ],
      },
      {
        id: "q3",
        matchId: "m1",
        market: "over_under",
        line: 2.5,
        bookmaker: "A",
        capturedAt: "2026-01-01T00:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
        selections: [
          { key: "over", label: "Over 2.5", decimalOdds: 1.8, impliedProbability: null },
          { key: "under", label: "Under 2.5", decimalOdds: 2.1, impliedProbability: null },
        ],
      },
      {
        id: "q4",
        matchId: "m1",
        market: "btts",
        line: null,
        bookmaker: "A",
        capturedAt: "2026-01-01T00:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
        selections: [
          { key: "yes", label: "Yes", decimalOdds: 1.66, impliedProbability: null },
          { key: "no", label: "No", decimalOdds: 2.2, impliedProbability: null },
        ],
      },
    ];

    const mapped = suggestedOddsFromQuotes(quotes);
    expect(mapped["1X2 · Local"]).toBe(1.7);
    expect(mapped["1X2 · Empate"]).toBe(4.2);
    expect(mapped["Over 2.5"]).toBe(1.8);
    expect(mapped["BTTS · Sí"]).toBe(1.66);
  });
});
