import { describe, expect, it } from "vitest";
import { buildOddsEvRows, expectedValue, preMatchOddsBoard } from "@/lib/match-center/markets";
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
        bookmaker: "Bet365",
        selections: [
          {
            key: "home",
            label: "Home",
            decimalOdds: 2.1,
            impliedProbability: 1 / 2.1,
          },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
        sourceProvider: "api-football",
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
    expect(rows[0]!.isBest).toBe(true);
    expect(rows[0]!.bookmaker).toBe("Bet365");
  });

  it("highlights the highest decimal odds across bookmakers", () => {
    const quotes: ApexOddsQuote[] = [
      {
        id: "odds-1x2-a",
        matchId: "m1",
        market: "1x2",
        line: null,
        bookmaker: "Bet365",
        selections: [
          {
            key: "home",
            label: "Home",
            decimalOdds: 1.8,
            impliedProbability: 1 / 1.8,
          },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
      },
      {
        id: "odds-1x2-b",
        matchId: "m1",
        market: "1x2",
        line: null,
        bookmaker: "Pinnacle",
        selections: [
          {
            key: "home",
            label: "Home",
            decimalOdds: 1.92,
            impliedProbability: 1 / 1.92,
          },
        ],
        capturedAt: "2026-08-11T12:00:00.000Z",
        sourceProvider: "api-football",
        externalRefs: [],
      },
    ];

    const rows = buildOddsEvRows({
      quotes,
      oneXTwo: { home: 0.48, draw: 0.27, away: 0.25 },
      overUnder25: { over: 0.55, under: 0.45 },
      btts: { yes: 0.52, no: 0.48 },
    });

    const best = rows.find((row) => row.isBest);
    expect(best?.bookmaker).toBe("Pinnacle");
    expect(best?.decimalOdds).toBe(1.92);
    expect(rows.find((row) => row.bookmaker === "Bet365")?.isBest).toBe(false);
  });
});

describe("preMatchOddsBoard", () => {
  it("keeps the best 1X2, O/U 2.5 and BTTS prices", () => {
    const rows = buildOddsEvRows({
      quotes: [
        {
          id: "a-1x2",
          matchId: "m1",
          market: "1x2",
          line: null,
          bookmaker: "Bet365",
          selections: [
            { key: "home", label: "Home", decimalOdds: 1.6, impliedProbability: 1 / 1.6 },
            { key: "draw", label: "Draw", decimalOdds: 4.2, impliedProbability: 1 / 4.2 },
            { key: "away", label: "Away", decimalOdds: 5.0, impliedProbability: 1 / 5.0 },
          ],
          capturedAt: "2026-08-11T12:00:00.000Z",
          sourceProvider: "api-football",
          externalRefs: [],
        },
        {
          id: "b-1x2",
          matchId: "m1",
          market: "1x2",
          line: null,
          bookmaker: "1xBet",
          selections: [
            { key: "home", label: "Home", decimalOdds: 1.7, impliedProbability: 1 / 1.7 },
            { key: "draw", label: "Draw", decimalOdds: 4.0, impliedProbability: 1 / 4.0 },
            { key: "away", label: "Away", decimalOdds: 5.2, impliedProbability: 1 / 5.2 },
          ],
          capturedAt: "2026-08-11T12:00:00.000Z",
          sourceProvider: "api-football",
          externalRefs: [],
        },
        {
          id: "a-ou",
          matchId: "m1",
          market: "over_under",
          line: 2.5,
          bookmaker: "Pinnacle",
          selections: [
            { key: "over", label: "Over 2.5", decimalOdds: 1.8, impliedProbability: 1 / 1.8 },
            { key: "under", label: "Under 2.5", decimalOdds: 2.1, impliedProbability: 1 / 2.1 },
          ],
          capturedAt: "2026-08-11T12:00:00.000Z",
          sourceProvider: "api-football",
          externalRefs: [],
        },
        {
          id: "a-btts",
          matchId: "m1",
          market: "btts",
          line: null,
          bookmaker: "Bet365",
          selections: [
            { key: "yes", label: "Yes", decimalOdds: 1.72, impliedProbability: 1 / 1.72 },
            { key: "no", label: "No", decimalOdds: 2.2, impliedProbability: 1 / 2.2 },
          ],
          capturedAt: "2026-08-11T12:00:00.000Z",
          sourceProvider: "api-football",
          externalRefs: [],
        },
      ],
      oneXTwo: { home: 0.48, draw: 0.27, away: 0.25 },
      overUnder25: { over: 0.55, under: 0.45 },
      btts: { yes: 0.52, no: 0.48 },
    });

    const board = preMatchOddsBoard(rows);
    expect(board.bookmakerCount).toBe(3);
    expect(board.oneXTwo.map((row) => row.bookmaker)).toEqual([
      "1xBet",
      "Bet365",
      "1xBet",
    ]);
    expect(board.overUnder25).toHaveLength(2);
    expect(board.btts.map((row) => row.selection)).toEqual(["yes", "no"]);
  });
});
