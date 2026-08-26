/**
 * Mock explainable prediction for UI demos (Copilot / Match Analysis page).
 */

import { createEloPoissonHybridEngine } from "@/lib/intelligence/modules/probability";
import { explainPrediction } from "@/lib/explainable-ai/engine";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

export function getMockExplainablePrediction(
  overrides?: Partial<{
    homeElo: number;
    awayElo: number;
    homeName: string;
    awayName: string;
    matchId: string;
  }>,
): ExplainablePrediction {
  const homeElo = overrides?.homeElo ?? 1620;
  const awayElo = overrides?.awayElo ?? 1510;
  const probability = createEloPoissonHybridEngine().predict({
    homeElo,
    awayElo,
    matchId: overrides?.matchId ?? "apex:mock:explainable:1",
  });

  return explainPrediction({
    matchId: overrides?.matchId ?? "apex:mock:explainable:1",
    homeTeamName: overrides?.homeName ?? "Northbridge FC",
    awayTeamName: overrides?.awayName ?? "Southport United",
    leagueName: "Premier League",
    probability,
    homeForm: "WWDLW",
    awayForm: "LDLWW",
    timelineEventCount: 2,
    dataProvider: "mock",
  });
}
