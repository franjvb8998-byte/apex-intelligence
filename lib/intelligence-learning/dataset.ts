import type {
  LearningFeatureRow,
  RecommendationRecord,
  ResultRecord,
} from "@/lib/intelligence-learning/types";

export function toFeatureRow(
  recommendation: RecommendationRecord,
  result?: ResultRecord | null,
): LearningFeatureRow {
  return {
    recommendationId: recommendation.id,
    timestamp: recommendation.timestamp,
    source: recommendation.source,
    fixtureId: recommendation.fixtureId,
    competition: recommendation.competition,
    market: recommendation.market,
    recommendation: recommendation.recommendation,
    apexScore: recommendation.apexScore,
    confidence: recommendation.confidence,
    risk: recommendation.risk,
    expectedValue: recommendation.expectedValue,
    kellyStake: recommendation.kellyStake,
    stakePct: recommendation.stakePct,
    odds: recommendation.odds,
    teamIntelligence: recommendation.teamIntelligence,
    momentum: recommendation.momentum,
    tacticalScore: recommendation.tacticalScore,
    marketScore: recommendation.marketScore,
    dataQuality: recommendation.dataQuality,
    engineScoring: recommendation.engineVersion.scoring,
    engineDecision: recommendation.engineVersion.decision,
    labelHit: result?.selectionHit ?? null,
    labelRoi: result?.roi ?? null,
    labelCorrect: result?.recommendationCorrect ?? null,
  };
}

export function exportLearningDataset(
  recommendations: RecommendationRecord[],
  results: ResultRecord[],
): LearningFeatureRow[] {
  const byId = new Map(results.map((row) => [row.recommendationId, row]));
  return recommendations
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((row) => toFeatureRow(row, byId.get(row.id) ?? null));
}
