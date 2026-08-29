import { describe, expect, it } from "vitest";
import {
  buildAlertCard,
  buildBankrollCard,
  buildConfidenceMovers,
  buildEliteCard,
  buildFinishedCard,
  buildMarketMovers,
  buildPerformanceCard,
  buildUpcomingCard,
  hrefForMatchName,
} from "@/lib/feed/build";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";
import { getMockBankroll } from "@/lib/bankroll/mock-data";
import { buildPortfolioReport } from "@/lib/portfolio/build";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";

function recFromVerdict(
  verdict: ApexOpportunity["verdict"],
): ScoringTier {
  if (verdict === "elite_pick") return "Elite";
  if (verdict === "strong_bet") return "Strong Bet";
  if (verdict === "lean_bet") return "Value Bet";
  if (verdict === "pass") return "Watch";
  return "Avoid";
}

function opp(
  overrides: Partial<ApexOpportunity> & Pick<ApexOpportunity, "fixtureId" | "verdict" | "score" | "confidence">,
): ApexOpportunity {
  return {
    kickoffAt: "2026-04-23T19:00:00.000Z",
    leagueName: "Premier League",
    country: "England",
    market: "1x2",
    home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
    away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
    predicted: "home",
    selectionLabel: "Arsenal",
    stars: 3,
    confidenceBand: overrides.confidence >= 70 ? "high" : overrides.confidence >= 45 ? "medium" : "low",
    riskBand: "medium",
    riskScore: 40,
    fairOdds: 1.8,
    bookmakerOdds: 1.7,
    valuePct: 0.04,
    expectedValue: 0.04,
    marketEdge: 0.04,
    kellyPct: 0.014,
    stakePct: 0,
    stakeLabel: "0%",
    verdictLabel: overrides.verdict,
    recommendation: recFromVerdict(overrides.verdict),
    explanation: "Test desk note.",
    reasonsFor: [],
    reasonsAgainst: [],
    positiveEdge: (overrides.expectedValue ?? 0.04) > 0,
    ...overrides,
  };
}

const catalogue: DashboardMatchSummary[] = [
  {
    id: "1635059",
    externalId: "1635059",
    kickoffAt: "2026-04-23T19:00:00.000Z",
    status: "finished",
    leagueName: "Premier League",
    homeTeam: {
      id: "h",
      name: "Arsenal",
      shortName: "ARS",
      logoUrl: null,
    },
    awayTeam: {
      id: "a",
      name: "Chelsea",
      shortName: "CHE",
      logoUrl: null,
    },
    score: { home: 2, away: 1 },
  },
  {
    id: "live-1",
    externalId: "99",
    kickoffAt: "2026-08-27T18:00:00.000Z",
    status: "live",
    leagueName: "Premier League",
    homeTeam: {
      id: "h2",
      name: "Liverpool",
      shortName: "LIV",
      logoUrl: null,
    },
    awayTeam: {
      id: "a2",
      name: "Everton",
      shortName: "EVE",
      logoUrl: null,
    },
    score: { home: 1, away: 0 },
  },
];

describe("APEX Intelligence Feed builders", () => {
  it("ranks elite_pick first then fills with top score", () => {
    const elite = opp({
      fixtureId: "e1",
      verdict: "elite_pick",
      score: 80,
      confidence: 72,
    });
    const avoid = opp({
      fixtureId: "a1",
      verdict: "avoid",
      score: 90,
      confidence: 30,
      expectedValue: -0.1,
      positiveEdge: false,
    });
    const model = buildEliteCard([avoid, elite]);
    expect(model.rows[0]?.id).toBe("e1");
    expect(model.kpis[0]?.value).toBe("1");
    expect(model.rows[0]?.href).toContain("/match-analysis/");
  });

  it("ranks confidence movers by conviction", () => {
    const low = opp({
      fixtureId: "low",
      verdict: "avoid",
      score: 50,
      confidence: 20,
    });
    const high = opp({
      fixtureId: "high",
      verdict: "lean_bet",
      score: 55,
      confidence: 81,
      confidenceBand: "high",
    });
    const model = buildConfidenceMovers([low, high]);
    expect(model.rows[0]?.id).toBe("high");
    expect(model.kpis[0]?.value).toBe("1");
  });

  it("ranks market movers by absolute expected value", () => {
    const small = opp({
      fixtureId: "s",
      verdict: "lean_bet",
      score: 60,
      confidence: 50,
      expectedValue: 0.01,
    });
    const large = opp({
      fixtureId: "l",
      verdict: "pass",
      score: 40,
      confidence: 40,
      expectedValue: 0.12,
    });
    const model = buildMarketMovers([small, large]);
    expect(model.rows[0]?.id).toBe("l");
  });

  it("surfaces injuries before desk notes", () => {
    const model = buildAlertCard({
      injuries: [
        {
          id: "i1",
          playerName: "T. Partey",
          teamId: "t",
          teamName: "Arsenal",
          detail: "Knock",
        },
      ],
      suspensions: [],
      featuredHref: "/match-analysis/1635059",
      featuredLabel: "ARS vs CHE",
      analyzed: [
        opp({ fixtureId: "d1", verdict: "avoid", score: 40, confidence: 20 }),
      ],
    });
    expect(model.rows[0]?.title).toBe("T. Partey");
    expect(model.rows[0]?.href).toBe("/match-analysis/1635059");
    expect(model.rows.some((row) => row.badge?.label === "badge.desk")).toBe(true);
  });

  it("lists live and scheduled upcoming matches", () => {
    const model = buildUpcomingCard(catalogue);
    expect(model.rows[0]?.badge?.label).toBe("LIVE");
    expect(model.rows[0]?.href).toContain("/match-analysis/99");
  });

  it("mixes finished fixtures with settled bankroll bets", () => {
    const data = getMockBankroll();
    const model = buildFinishedCard({
      matches: catalogue,
      bets: data.bets,
      fixtures: catalogue,
    });
    expect(model.rows[0]?.title).toContain("Arsenal");
    expect(model.rows.some((row) => row.badge?.label === "WON" || row.badge?.label === "LOST")).toBe(
      true,
    );
  });

  it("builds performance and bankroll snapshots from the session ledger", () => {
    const data = getMockBankroll();
    const report = buildPortfolioReport(data, []);
    const performance = buildPerformanceCard(data, report);
    const bankroll = buildBankrollCard(data, report);
    expect(performance.footerHref).toBe("/portfolio");
    expect(bankroll.footerHref).toBe("/bankroll");
    expect(bankroll.rows.every((row) => row.href.length > 0)).toBe(true);
    expect(performance.kpis[0]?.label).toBe("ROI");
  });

  it("resolves bankroll match names to analysis when the fixture exists", () => {
    expect(hrefForMatchName("Arsenal vs Chelsea", catalogue)).toContain(
      "/match-analysis/1635059",
    );
    expect(hrefForMatchName("Unknown FC vs Other", catalogue)).toBe("/bankroll");
  });
});
