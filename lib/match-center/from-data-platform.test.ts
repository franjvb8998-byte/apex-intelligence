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
});
