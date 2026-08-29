import { describe, expect, it } from "vitest";
import { filterOpportunities } from "@/lib/apex-opportunities/filters";
import { opportunityFixture } from "@/lib/apex-opportunities/fixture";
import { boardView, marketSummary } from "@/lib/apex-opportunities/stats";
import { DEFAULT_OPPORTUNITY_FILTERS } from "@/lib/apex-opportunities/types";
import {
  parseWatchlist,
  serializeWatchlist,
  toggleWatchlistId,
} from "@/lib/apex-opportunities/watchlist";

describe("APEX Opportunities filters", () => {
  const elite = opportunityFixture();
  const weak = opportunityFixture({
    fixtureId: "2",
    score: 66,
    confidence: 37,
    expectedValue: 0.04,
    verdict: "avoid",
    verdictLabel: "Avoid",
    recommendation: "Avoid",
    stars: 1,
    riskBand: "medium",
    riskScore: 55,
  });
  const pass = opportunityFixture({
    fixtureId: "3",
    score: 78,
    confidence: 68,
    expectedValue: -0.02,
    positiveEdge: false,
    verdict: "pass",
    verdictLabel: "Watch",
    recommendation: "Watch",
    stars: 2,
    predicted: "away",
    selectionLabel: "Chelsea",
    kickoffAt: "2026-08-27T20:00:00.000Z",
    leagueName: "La Liga",
    bookmakerOdds: 3.4,
  });

  it("hides weak rows under the default quality bar", () => {
    const rows = filterOpportunities([elite, weak, pass]);
    expect(rows.map((row) => row.fixtureId)).toEqual(["1035089"]);
  });

  it("requires strictly positive EV when minEv is 0", () => {
    const zeroEv = opportunityFixture({
      fixtureId: "zero",
      expectedValue: 0,
    });
    expect(filterOpportunities([zeroEv, elite])).toHaveLength(1);
  });

  it("filters league, side, kickoff, risk and odds range", () => {
    const rows = [elite, pass];
    expect(
      filterOpportunities(rows, {
        ...DEFAULT_OPPORTUNITY_FILTERS,
        minScore: 0,
        minConfidence: 0,
        minEv: -1,
        league: "La Liga",
      }).map((row) => row.fixtureId),
    ).toEqual(["3"]);

    expect(
      filterOpportunities(rows, {
        ...DEFAULT_OPPORTUNITY_FILTERS,
        minScore: 0,
        minConfidence: 0,
        minEv: -1,
        side: "away",
      })[0]?.fixtureId,
    ).toBe("3");

    expect(
      filterOpportunities(rows, {
        ...DEFAULT_OPPORTUNITY_FILTERS,
        minScore: 0,
        minConfidence: 0,
        minEv: -1,
        kickoff: "evening",
      })[0]?.fixtureId,
    ).toBe("3");

    expect(
      filterOpportunities(rows, {
        ...DEFAULT_OPPORTUNITY_FILTERS,
        minScore: 0,
        minConfidence: 0,
        minEv: -1,
        oddsMin: 3,
        oddsMax: 4,
      })[0]?.fixtureId,
    ).toBe("3");
  });
});

describe("APEX Opportunities stats", () => {
  it("counts analyzed vs quality opportunities and names market extremes", () => {
    const elite = opportunityFixture();
    const weak = opportunityFixture({
      fixtureId: "weak",
      score: 50,
      confidence: 30,
      expectedValue: 0.12,
      kellyPct: 8,
      stakePct: 5,
      riskScore: 90,
      riskBand: "high",
      verdict: "avoid",
      recommendation: "Avoid",
    });
    const view = boardView([elite, weak]);
    expect(view.header.analyzed).toBe(2);
    expect(view.header.opportunities).toBe(1);
    expect(view.header.elitePicks).toBe(1);
    expect(view.top[0]?.fixtureId).toBe("1035089");

    const market = marketSummary([elite, weak]);
    expect(market.highestEv?.fixtureId).toBe("weak");
    expect(market.highestScore?.fixtureId).toBe("1035089");
    expect(market.safest?.fixtureId).toBe("1035089");
    expect(market.mostAggressive?.fixtureId).toBe("weak");
  });
});

describe("watchlist storage helpers", () => {
  it("parses, serializes and toggles fixture ids", () => {
    expect(parseWatchlist("not-json")).toEqual([]);
    expect(parseWatchlist('["a","a"," "]')).toEqual(["a"]);
    expect(serializeWatchlist(["b", "b"])).toBe('["b"]');
    expect(toggleWatchlistId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleWatchlistId(["a", "b"], "a")).toEqual(["b"]);
  });
});
