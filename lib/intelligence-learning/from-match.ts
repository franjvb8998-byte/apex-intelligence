import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";
import type { RecommendationDraft } from "@/lib/intelligence-learning/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { MatchAnalysisCore } from "@/lib/decision-engine/from-match";
import type { ApexScoring, ScoringComponentKey } from "@/lib/scoring-engine/types";

function pillar(scoring: ApexScoring, key: ScoringComponentKey): number | null {
  const row = scoring.components.find((item) => item.key === key);
  return row?.available ? (row.score ?? null) : null;
}

export function recommendationDraftFromMatchSelection(input: {
  analysis: MatchAnalysisCore;
  decision: ApexDecision;
  scoring: ApexScoring;
  timestamp?: string;
}): RecommendationDraft {
  const { analysis, decision, scoring } = input;
  return {
    timestamp: input.timestamp ?? analysis.kickoffAt,
    source: "match-analysis",
    fixtureId: analysis.matchId,
    competition: analysis.leagueName,
    teams: { home: analysis.homeTeam.name, away: analysis.awayTeam.name },
    market: "1x2",
    selectionLabel: decision.selectionLabel,
    predicted: decision.predicted,
    odds: decision.value.impliedOdds,
    recommendation: scoring.recommendation.tier,
    apexScore: scoring.overall,
    confidence: decision.confidence.value,
    risk: decision.risk.score,
    expectedValue: decision.value.expectedValue,
    kellyStake: decision.sizing.kellyPct,
    stakePct: decision.sizing.stakePct,
    teamIntelligence: pillar(scoring, "teamIntelligence"),
    momentum: pillar(scoring, "momentum"),
    tacticalScore: pillar(scoring, "tactical"),
    marketScore: pillar(scoring, "marketValue"),
    dataQuality: pillar(scoring, "dataQuality"),
    reasoning: {
      summary: scoring.explanation.summary,
      supporting: scoring.explanation.supporting.map((item) => ({
        key: String(item.key),
        title: item.title,
        detail: item.detail,
      })),
      against: scoring.explanation.against.map((item) => ({
        key: String(item.key),
        title: item.title,
        detail: item.detail,
      })),
      reasonsFor: decision.reasonsFor.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
      })),
      reasonsAgainst: decision.reasonsAgainst.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
      })),
    },
    engineVersion: {
      learning: INTELLIGENCE_LEARNING_VERSION,
      scoring: scoring.engineId,
      decision: decision.engineId,
    },
  };
}
