import { emptyScoringInput } from "@/lib/scoring-engine/builders";
import type { ScoringEngineInput } from "@/lib/scoring-engine/types";

export function scoringEngineFixture(
  over: Partial<ScoringEngineInput> = {},
): ScoringEngineInput {
  return emptyScoringInput({
    selectionId: "1035089:home",
    selectionLabel: "Arsenal",
    predicted: "home",
    modelProbability: 0.58,
    oneXTwo: { home: 0.58, draw: 0.22, away: 0.2 },
    decimalOdds: 2.05,
    bookmakerCount: 4,
    expectedValue: 0.09,
    marketEdge: 0.092,
    teamIntelligenceScore: 74,
    teamIntelligenceCoverage: 0.82,
    momentumScore: 78,
    tacticalScore: 71,
    confidence: 68,
    risk: 28,
    coverage: 0.85,
    formSample: 8,
    injuriesPublished: true,
    ...over,
  });
}
