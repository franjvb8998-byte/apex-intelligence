import { describe, expect, it } from "vitest";
import {
  createApiFootballProvider,
  createDataPlatform,
  createMockDataProvider,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
  type IDataProvider,
} from "@/lib/data-platform";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import { ApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { isApiFootballQuotaError } from "@/lib/data-platform/providers/api-football/quota";
import {
  createMatchCenterFromApexBundle,
  getMatchCenterData,
  listMatchCenterFixtures,
  loadMatchCenterFromApiFootball,
} from "@/lib/match-center";

describe("Match Center ← Data Platform", () => {
  it("loads Match Center from API-Football recorded fixtures (no mock)", async () => {
    const data = await getMatchCenterData({
      env: {},
      requireProvider: true,
    });

    expect(data.source).toBe("platform");
    expect(data.match.source).toBe("data-platform");
    expect(data.match.homeTeam.name).toBe("Arsenal");
    expect(data.match.awayTeam.name).toBe("Chelsea");
    expect(data.match.homeTeam.logoUrl).toBe(
      "https://media.api-sports.io/football/teams/42.png",
    );
    expect(data.match.awayTeam.logoUrl).toBe(
      "https://media.api-sports.io/football/teams/49.png",
    );
    expect(data.fixtures.length).toBeGreaterThan(0);
    expect(data.fixtures[0]?.homeTeam.logoUrl).toBe(
      "https://media.api-sports.io/football/teams/42.png",
    );
    expect(data.preview.hybrid.btts.yes + data.preview.hybrid.btts.no).toBeCloseTo(
      1,
    );
    expect(data.preview.dashboard.recommendation.title).toBeTruthy();
    expect(data.match.providerLabel).toBe("API-Football");
    expect(data.preview.source).toBe("intelligence-core");
    const homeOdds = data.preview.dashboard.odds.filter(
      (row) => row.market === "1x2" && row.selection === "home",
    );
    expect(homeOdds.length).toBeGreaterThan(1);
    const bestHome = homeOdds.find((row) => row.isBest);
    expect(bestHome?.decimalOdds).toBe(1.7);
    expect(bestHome?.bookmaker).toBe("1xBet");
    expect(
      data.preview.dashboard.odds.find(
        (row) => row.market === "over_under" && row.selection === "over" && row.isBest,
      )?.decimalOdds,
    ).toBe(1.8);
    expect(
      data.preview.dashboard.odds.find(
        (row) => row.market === "btts" && row.selection === "yes" && row.isBest,
      )?.bookmaker,
    ).toBe("1xBet");
    expect(data.live.source).toBe("data-platform");
    expect(data.live.vision.source).toBe("data-platform");
    expect(data.post.source).toBe("data-platform");
  });

  it("builds MatchCenterData from API-Football recorded match (legacy path)", async () => {
    const data = await loadMatchCenterFromApiFootball({
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    expect(data.source).toBe("platform");
    expect(data.match.homeTeam.name).toBe("Arsenal");
    expect(data.match.awayTeam.name).toBe("Chelsea");
    expect(data.match.status).toBe("finished");
    expect(data.defaultPhase).toBe("post");
    expect(data.post.finalScore).toEqual({ home: 2, away: 1 });
    expect(data.preview.analysis.oneXTwo.home).toBeGreaterThan(0);
    expect(data.preview.hybrid.btts.yes).toBeGreaterThan(0);
    expect(data.preview.dashboard.form.home?.form).toBeTruthy();
    expect(data.preview.dashboard.form.away?.teamName).toBe("Chelsea");
    expect(data.preview.dashboard.form.home?.recentMatches.length).toBe(5);
    expect(data.preview.dashboard.h2h.length).toBeGreaterThan(0);
    expect(data.preview.dashboard.injuries[0]?.playerName).toBe("T. Partey");
    expect(data.preview.dashboard.suspensions[0]?.playerName).toBe("R. James");
    expect(data.preview.dashboard.lineups.home?.formation).toBe("4-3-3");
    expect(data.preview.dashboard.lineups.away?.startXI[0]?.name).toBe("C. Palmer");
    expect(data.match.venue?.name).toBe("Emirates Stadium");
    expect(data.match.referee).toBe("M. Oliver");
    expect(data.match.attendance).toBeNull();
    expect(data.match.weather).toBeNull();
    expect(data.preview.dashboard.standings.home?.rank).toBe(1);
    expect(data.preview.dashboard.standings.away?.rank).toBe(2);
    expect(data.preview.dashboard.trends.home?.goalsScoredAvg).toBe(1.6);
    expect(data.preview.dashboard.trends.home?.seasonCleanSheets).toBe(18);
    expect(data.preview.dashboard.trends.home?.bttsPct).toBe(0.6);
    expect(data.live.lineups.home?.startXI.some((p) => p.name === "B. Saka")).toBe(
      true,
    );
    expect(data.aiAnalysis.recentForm.home).toBeTruthy();
  });

  it("maps ingested bundle via createMatchCenterFromApexBundle", async () => {
    const platform = createDataPlatform({
      providers: [createApiFootballProvider()],
    });
    const { bundle } = await platform.ingestMatch({
      providerId: "api-football",
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });

    const center = createMatchCenterFromApexBundle(bundle);
    expect(center.match.leagueName).toBe("Premier League");
    expect(center.live.vision.homeTeam.name).toBe("Arsenal");
    expect(center.live.source).not.toBe("mock");
    expect(center.post.source).not.toBe("mock");
    expect(center.preview.source).not.toBe("mock");
  });

  it("joins mock catalogue odds into EV rows when a mock provider is injected", async () => {
    const data = await getMatchCenterData({
      provider: createMockDataProvider(),
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
      requireProvider: true,
    });
    const home = data.preview.dashboard.odds.find(
      (row) => row.market === "1x2" && row.selection === "home",
    );
    expect(home?.decimalOdds).toBe(2.1);
    expect(home?.modelProbability).toBeGreaterThan(0);
    expect(home?.expectedValue).not.toBeNull();
  });

  it("loads the requested fixture id even when it is not in the catalogue", async () => {
    const inner = createMockDataProvider();
    const requested: string[] = [];
    const provider: IDataProvider = {
      id: "mock",
      displayName: "stub",
      async getMatch(query) {
        requested.push(query.matchId);
        return inner.getMatch(query);
      },
      async listFixtures() {
        return inner.listFixtures?.() ?? [];
      },
    };

    const data = await getMatchCenterData({
      provider,
      externalMatchId: "apex:api-football:match:123456",
      env: {},
    });

    expect(requested).toContain("123456");
    expect(data.preview.source).toBe("intelligence-core");
    expect(data.live.source).not.toBe("mock");
    expect(data.post.source).not.toBe("mock");
  });

  it("lists fixtures without loading match analysis", async () => {
    const inner = createMockDataProvider();
    let getMatchCalls = 0;
    const provider: IDataProvider = {
      id: "mock",
      displayName: "stub",
      async getMatch(query) {
        getMatchCalls += 1;
        return inner.getMatch(query);
      },
      async listFixtures() {
        return inner.listFixtures?.() ?? [];
      },
    };

    const matches = await listMatchCenterFixtures({ provider, env: {} });
    expect(matches.length).toBeGreaterThan(0);
    expect(getMatchCalls).toBe(0);
    expect(matches[0]?.homeTeam).toHaveProperty("logoUrl");
    expect(matches[0]?.awayTeam).toHaveProperty("logoUrl");
  });

  it("skips the fixture catalogue on the detail loader", async () => {
    const inner = createMockDataProvider();
    let listCalls = 0;
    const provider: IDataProvider = {
      id: "mock",
      displayName: "stub",
      async getMatch(query) {
        return inner.getMatch(query);
      },
      async listFixtures() {
        listCalls += 1;
        return inner.listFixtures?.() ?? [];
      },
    };

    const data = await getMatchCenterData({
      provider,
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
      includeFixtureList: false,
      env: {},
    });

    expect(listCalls).toBe(0);
    expect(data.fixtures).toEqual([]);
    expect(data.preview.source).toBe("intelligence-core");
  });

  it("does not swallow API-Football quota errors into an empty catalogue", async () => {
    const quota = new ApiFootballError({
      message:
        "API-Football fixtures error: You have reached the request limit for the day",
      code: "vendor_error",
      status: null,
    });
    const provider: IDataProvider = {
      id: "api-football",
      displayName: "API-Football",
      async getMatch() {
        throw quota;
      },
      async listFixtures() {
        throw quota;
      },
    };

    await expect(
      listMatchCenterFixtures({ provider, env: {} }),
    ).rejects.toSatisfy(isApiFootballQuotaError);
  });
});
