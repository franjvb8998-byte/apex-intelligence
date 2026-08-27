import { describe, expect, it } from "vitest";
import {
  createApiFootballProvider,
  createDataPlatform,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform";
import { DEMO_MATCH_EXTERNAL_ID } from "@/lib/data-platform/providers/_shared/demo-fixture";
import {
  createMatchCenterFromApexBundle,
  getMatchCenterData,
  loadMatchCenterFromApiFootball,
} from "@/lib/match-center";

describe("Match Center ← Data Platform", () => {
  it("loads default Match Center via MockDataProvider (v2)", async () => {
    const data = await getMatchCenterData({
      externalMatchId: DEMO_MATCH_EXTERNAL_ID,
      requireProvider: true,
    });

    expect(data.source).toBe("platform");
    expect(data.match.source).toBe("data-platform");
    expect(data.match.homeTeam.name).toBe("Northbridge FC");
    expect(data.match.awayTeam.name).toBe("Southport United");
    expect(data.preview.hybrid.btts.yes + data.preview.hybrid.btts.no).toBeCloseTo(
      1,
    );
    expect(data.preview.dashboard.odds.length).toBeGreaterThan(0);
    expect(
      data.preview.dashboard.odds.some((row) => row.market === "1x2"),
    ).toBe(true);
    expect(data.preview.dashboard.recommendation.title).toBeTruthy();
    expect(data.match.providerLabel).toBe("Mock");
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
  });

  it("joins mock catalogue odds into EV rows", async () => {
    const data = await getMatchCenterData({
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
});
