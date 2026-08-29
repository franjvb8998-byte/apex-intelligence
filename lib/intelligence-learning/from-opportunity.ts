import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { INTELLIGENCE_LEARNING_VERSION } from "@/lib/intelligence-learning/types";
import type { RecommendationDraft } from "@/lib/intelligence-learning/types";
import type { ApexScoring } from "@/lib/scoring-engine/types";
import type { ScoringComponentKey } from "@/lib/scoring-engine/types";

function pillar(scoring: ApexScoring | undefined, key: ScoringComponentKey): number | null {
  const row = scoring?.components.find((item) => item.key === key);
  return row?.available ? (row.score ?? null) : null;
}

export function recommendationDraftFromOpportunity(
  row: ApexOpportunity,
  scoring?: ApexScoring,
  timestamp = new Date().toISOString(),
): RecommendationDraft {
  return {
    timestamp,
    source: "scanner",
    fixtureId: row.fixtureId,
    competition: row.leagueName,
    teams: { home: row.home.name, away: row.away.name },
    market: row.market === "1x2" ? "1x2" : "1x2",
    selectionLabel: row.selectionLabel,
    predicted: row.predicted,
    odds: row.bookmakerOdds,
    recommendation: row.recommendation,
    apexScore: row.score,
    confidence: row.confidence,
    risk: row.riskScore,
    expectedValue: row.expectedValue,
    kellyStake: row.kellyPct,
    stakePct: row.stakePct,
    teamIntelligence: pillar(scoring, "teamIntelligence"),
    momentum: pillar(scoring, "momentum"),
    tacticalScore: pillar(scoring, "tactical"),
    marketScore: pillar(scoring, "marketValue"),
    dataQuality: pillar(scoring, "dataQuality"),
    reasoning: {
      summary: row.explanation,
      supporting: scoring
        ? scoring.explanation.supporting.map((item) => ({
            key: String(item.key),
            title: item.title,
            detail: item.detail,
          }))
        : [],
      against: scoring
        ? scoring.explanation.against.map((item) => ({
            key: String(item.key),
            title: item.title,
            detail: item.detail,
          }))
        : [],
      reasonsFor: row.reasonsFor.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
      })),
      reasonsAgainst: row.reasonsAgainst.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
      })),
    },
    engineVersion: {
      learning: INTELLIGENCE_LEARNING_VERSION,
      scoring: scoring?.engineId ?? "scoring-v2",
      decision: "deterministic-v1",
    },
  };
}
