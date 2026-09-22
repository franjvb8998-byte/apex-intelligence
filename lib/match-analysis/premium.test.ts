import { beforeEach, describe, expect, it } from "vitest";
import { RECORDED_API_FOOTBALL_FIXTURE_ID } from "@/lib/data-platform";
import { getMatchAnalysisData } from "@/lib/match-analysis/load";
import { buildPremiumAnalysis } from "@/lib/match-analysis/premium";
import { resetPrematchDecisionTicketStoreForTests } from "@/lib/prematch-decision/store";

describe("Match Analysis Premium v3 mapper", () => {
  beforeEach(() => {
    resetPrematchDecisionTicketStoreForTests();
  });
  it("presents published engines without inventing opening odds or unpublished axes", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    const premium = buildPremiumAnalysis(data);

    expect(data.twins).toBeDefined();
    expect(data.context).toHaveProperty("weather");
    expect(data.context).toHaveProperty("referee");

    expect(premium.market.openingOdds).toBeNull();
    expect(premium.score).toBe(Math.round(data.scoring?.overall ?? data.decision.score.value));
    expect(premium.confidence).toBe(data.decision.confidence.value);
    expect(premium.riskBand).toBe(data.decision.risk.band);
    expect(premium.expectedValue).toBe(data.decision.value.expectedValue);
    expect(premium.fairOdds).toBe(data.decision.value.fairOdds);
    expect(premium.bookmakerOdds).toBe(data.decision.value.impliedOdds);
    expect(premium.summary.length).toBeGreaterThan(40);

    expect(premium.currentlyActionable).toBe(false);
    expect(premium.recommendations).toEqual([]);
    expect(premium.actionabilityCopyKey).toBe("noFrozenPrematchDecision");
    expect(premium.actionabilityReason).toBe("STATUS_NOT_PREMATCH");
    expect(premium.hasFrozenPrematchDecision).toBe(false);
    expect(data).not.toHaveProperty("historicalRecommendation");
    expect(data.frozenPrematchDecision).toBeNull();

    expect(premium.evidence.total).toBe(6);
    expect(premium.evidence.aligned).toBeGreaterThanOrEqual(0);
    expect(premium.evidence.aligned).toBeLessThanOrEqual(6);
    expect(premium.evidence.signals).toHaveLength(6);

    const home = data.twins?.home;
    const away = data.twins?.away;
    if (home && away) {
      const unpublished = (side: typeof home, key: "pressingIntensity" | "setPieceRating") =>
        !side.tactical[key].available || side.tactical[key].value == null;
      if (unpublished(home, "pressingIntensity") && unpublished(away, "pressingIntensity")) {
        expect(premium.comparison.some((row) => row.key === "pressing")).toBe(false);
      }
      if (unpublished(home, "setPieceRating") && unpublished(away, "setPieceRating")) {
        expect(premium.comparison.some((row) => row.key === "setPieces")).toBe(false);
      }
      if (
        (!home.transfers.managerChanges.available ||
          home.transfers.managerChanges.value == null) &&
        (!away.transfers.managerChanges.available ||
          away.transfers.managerChanges.value == null)
      ) {
        expect(premium.comparison.some((row) => row.key === "coachStability")).toBe(
          false,
        );
      }
    }
  });
});

describe("Match Analysis current recommendation gate", () => {
  beforeEach(() => {
    resetPrematchDecisionTicketStoreForTests();
  });
  it("does not show a current Value/Strong/Elite bet on a finished fixture", async () => {
    const data = await getMatchAnalysisData({
      env: {},
      externalMatchId: RECORDED_API_FOOTBALL_FIXTURE_ID,
    });
    const premium = buildPremiumAnalysis(data);
    expect(data.vendorStatusShort).toBe("FT");
    expect(data.status).toBe("finished");
    expect(premium.currentlyActionable).toBe(false);
    expect(premium.recommendations).toEqual([]);
    expect(premium.actionabilityCopyKey).toBe("noFrozenPrematchDecision");
    expect(premium.hasFrozenPrematchDecision).toBe(false);
    expect(data.frozenPrematchDecision).toBeNull();
    expect(
      premium.tier != null &&
        ["Value Bet", "Strong Bet", "Elite"].includes(premium.tier) &&
        premium.currentlyActionable,
    ).toBe(false);
  });
});
