import { describe, expect, it } from "vitest";
import {
  createApiFootballDataProvider,
  RECORDED_API_FOOTBALL_FIXTURE_ID,
} from "@/lib/data-platform";
import { buildPremiumAnalysis } from "@/lib/match-analysis/premium";
import { createMatchCenterFromApexBundle } from "@/lib/match-center/from-data-platform";
import { buildMatchCenterLiveLiteFromBundle } from "@/lib/match-center/live-lite";
import { presentMatchCenterBettingSurfaces } from "@/lib/prematch-decision/actionability";

describe("Match Center actionability gate", () => {
  it("does not expose an actionable recommendation on the rich terminal path", async () => {
    const bundle = await createApiFootballDataProvider({
      env: {},
    }).getMatch({ matchId: RECORDED_API_FOOTBALL_FIXTURE_ID });
    const center = createMatchCenterFromApexBundle(bundle);
    expect(center.match.status).toBe("finished");
    expect(center.match.vendorStatusShort).toBe("FT");
    expect(center.liveLite).not.toBe(true);

    const presented = presentMatchCenterBettingSurfaces(
      center.match,
      center.preview.dashboard,
    );
    expect(presented.currentlyActionable).toBe(false);
    expect(presented.valueBet).toBeNull();
    expect(presented.showCurrentRecommendation).toBe(false);
    expect(presented.copyKey).toBe("noFrozenPrematchDecision");
    expect(center).not.toHaveProperty("frozenPrematchDecision");
    expect(center.preview.analysis).not.toHaveProperty("historicalRecommendation");
  });

  it("does not show a current Match Analysis recommendation on a live fixture", async () => {
    const recorded = await createApiFootballDataProvider({
      env: {},
    }).getMatch({ matchId: RECORDED_API_FOOTBALL_FIXTURE_ID });
    const live = {
      ...recorded,
      match: {
        ...recorded.match,
        status: "live" as const,
        vendorStatusShort: "1H",
      },
    };
    const center = createMatchCenterFromApexBundle(live);
    expect(center.match.status).toBe("live");
    const premium = buildPremiumAnalysis(center.preview.analysis);
    expect(premium.currentlyActionable).toBe(false);
    expect(premium.recommendations).toEqual([]);
    expect(premium.actionabilityCopyKey).toBe("noLongerPrematchOpportunity");

    const presented = presentMatchCenterBettingSurfaces(
      center.match,
      center.preview.dashboard,
    );
    expect(presented.showCurrentRecommendation).toBe(false);
    expect(presented.valueBet).toBeNull();
  });

  it("leaves Live Lite unchanged and does not add PE recommendations", async () => {
    const recorded = await createApiFootballDataProvider({
      env: {},
    }).getMatch({ matchId: RECORDED_API_FOOTBALL_FIXTURE_ID });
    const live = {
      ...recorded,
      match: {
        ...recorded.match,
        status: "live" as const,
        vendorStatusShort: "1H",
      },
    };
    const data = buildMatchCenterLiveLiteFromBundle(live, null);
    expect(data.liveLite).toBe(true);
    expect(data.live.loadMode).toBe("live-lite");
    expect(data.preview.probabilitiesAvailable).toBe(false);
    expect(data.preview.dashboard.valueBet).toBeNull();
    expect(data.preview.dashboard.recommendation.id).toBe("rec-pending");
    expect(data.preview.analysis.decision.explanation).toMatch(/Live Lite omitted/i);
  });
});
