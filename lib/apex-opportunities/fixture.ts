import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

export function opportunityFixture(
  over: Partial<ApexOpportunity> = {},
): ApexOpportunity {
  return {
    fixtureId: "1035089",
    kickoffAt: "2026-08-27T15:00:00.000Z",
    leagueName: "Premier League",
    country: "England",
    market: "1x2",
    home: { name: "Arsenal", shortName: "ARS", logoUrl: null },
    away: { name: "Chelsea", shortName: "CHE", logoUrl: null },
    predicted: "home",
    selectionLabel: "Arsenal",
    score: 82,
    stars: 5,
    confidence: 72,
    confidenceBand: "high",
    riskBand: "low",
    riskScore: 18,
    fairOdds: 1.9,
    bookmakerOdds: 2.15,
    valuePct: 0.08,
    expectedValue: 0.06,
    marketEdge: 0.08,
    kellyPct: 3.1,
    stakePct: 3,
    stakeLabel: "3%",
    verdict: "elite_pick",
    verdictLabel: "Elite",
    recommendation: "Elite",
    explanation: "Model price is above the published 1X2 with high coverage.",
    reasonsFor: [
      {
        id: "edge",
        title: "Positive market edge",
        detail: "Model probability sits above the implied board.",
      },
    ],
    reasonsAgainst: [
      {
        id: "sample",
        title: "Finite sample",
        detail: "Form window is short; confidence is not certainty.",
      },
    ],
    positiveEdge: true,
    ...over,
  };
}
