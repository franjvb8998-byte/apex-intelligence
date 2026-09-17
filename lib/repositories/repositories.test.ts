import { describe, expect, it } from "vitest";
import { MockDataProvider } from "@/lib/data-platform/mock-provider";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import {
  createRepositories,
  createRecordedDataProvider,
  dataModeOf,
  hasFootballApiKey,
  isQuotaError,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/repositories";

function oddsMarketsAndPrices(quotes: ApexOddsQuote[]) {
  return quotes.map((quote) => ({
    id: quote.id,
    matchId: quote.matchId,
    market: quote.market,
    line: quote.line,
    bookmaker: quote.bookmaker,
    sourceProvider: quote.sourceProvider,
    externalRefs: quote.externalRefs,
    selections: quote.selections,
  }));
}

describe("Data Access Layer v1", () => {
  it("serves fixtures from an injected provider without extras", async () => {
    const provider = new MockDataProvider();
    const repos = createRepositories({ provider });

    expect(repos.providerId).toBe("mock");
    expect(repos.hasResourcePort).toBe(false);

    const listed = await repos.fixtures.list();
    expect(listed.length).toBeGreaterThan(0);

    const bundle = await repos.fixtures.getById(DEMO_MATCH_EXTERNAL_ID);
    expect(bundle.homeTeam.name).toBe("Northbridge FC");
    expect(await repos.odds.listForFixture(DEMO_MATCH_EXTERNAL_ID)).toEqual(
      bundle.odds,
    );
    expect(await repos.teams.getById("1")).toBeNull();
    expect(await repos.standings.getTable("39", "2025")).toBeNull();
    expect(
      await repos.statistics.getTeamStatistics("1", "39", "2025"),
    ).toBeNull();

    const catalogue = await repos.matchAnalysis.getCatalogue(bundle);
    expect(catalogue.positions.home).toBeNull();
    expect(catalogue.matchMetrics.home).toBeNull();
  });

  it("lists the recorded catalogue through the fixtures repository", async () => {
    const repos = createRepositories({
      provider: createRecordedDataProvider({ enrichMatch: false }),
    });
    expect(repos.hasResourcePort).toBe(true);
    expect(dataModeOf(createRecordedDataProvider())).toBe("recorded");

    const catalogue = await repos.fixtures.listCatalogue();
    expect(catalogue.length).toBeGreaterThan(0);
    const first = catalogue[0]!;
    const loaded = await repos.fixtures.getById(
      first.match.externalRefs[0]?.externalId ?? first.match.id,
    );
    expect(loaded.match.id).toBe(first.match.id);
  });

  it("lists recorded odds without going through an enriched getMatch", async () => {
    const oddsOnly = createRepositories({
      provider: createRecordedDataProvider({ enrichMatch: false }),
    });
    const thin = await oddsOnly.fixtures.getById(RECORDED_API_FOOTBALL_FIXTURE_ID);
    expect(thin.odds).toEqual([]);

    const quotes = await oddsOnly.odds.listForFixture(
      RECORDED_API_FOOTBALL_FIXTURE_ID,
    );
    expect(quotes.length).toBeGreaterThan(0);
    expect(quotes.some((quote) => quote.market === "1x2")).toBe(true);
    expect(quotes.some((quote) => quote.market === "over_under")).toBe(true);
    expect(quotes.some((quote) => quote.market === "btts")).toBe(true);

    const enriched = createRepositories({
      provider: createRecordedDataProvider({ enrichMatch: true }),
    });
    const full = await enriched.fixtures.getById(RECORDED_API_FOOTBALL_FIXTURE_ID);
    expect(oddsMarketsAndPrices(quotes)).toEqual(
      oddsMarketsAndPrices(full.odds),
    );
  });

  it("detects API keys and quota errors without UI importing the vendor", () => {
    expect(hasFootballApiKey({})).toBe(false);
    expect(hasFootballApiKey({ API_FOOTBALL_KEY: "test" })).toBe(true);
    expect(isQuotaError(new Error("fixture not found"))).toBe(false);
  });
});
