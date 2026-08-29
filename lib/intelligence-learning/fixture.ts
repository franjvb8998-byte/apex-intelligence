import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";
import type { RecommendationDraft } from "@/lib/intelligence-learning/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export function recommendationDraftFixture(
  over: Partial<RecommendationDraft> & {
    fixtureId?: string;
    recommendation?: ScoringTier;
  } = {},
): RecommendationDraft {
  const fixtureId = over.fixtureId ?? "1035089";
  return {
    timestamp: "2026-08-28T15:00:00.000Z",
    source: "scanner",
    fixtureId,
    competition: "Premier League",
    teams: { home: "Arsenal", away: "Chelsea" },
    market: "1x2",
    selectionLabel: "Arsenal",
    predicted: "home",
    odds: 1.9,
    recommendation: "Value Bet",
    apexScore: 72,
    confidence: 70,
    risk: 32,
    expectedValue: 0.05,
    kellyStake: 3.1,
    stakePct: 3,
    teamIntelligence: 68,
    momentum: 61,
    tacticalScore: 64,
    marketScore: 71,
    dataQuality: 80,
    reasoning: {
      summary: "Model price sits above the published 1X2.",
      supporting: [
        { key: "expectedValue", title: "EV", detail: "+5.0% published EV." },
      ],
      against: [
        { key: "risk", title: "Risk", detail: "Residual three-way noise." },
      ],
      reasonsFor: [
        { id: "edge", title: "Positive edge", detail: "Model P above implied." },
      ],
      reasonsAgainst: [
        { id: "sample", title: "Finite sample", detail: "Form window is short." },
      ],
    },
    engineVersion: {
      learning: INTELLIGENCE_LEARNING_VERSION,
      scoring: "scoring-v2",
      decision: "deterministic-v1",
    },
    ...over,
  };
}
