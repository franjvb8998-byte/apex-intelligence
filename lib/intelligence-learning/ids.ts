/**
 * Stable recommendation ids. Deterministic for the same pending key.
 */

import type { LearningMarket, RecommendationSource } from "@/lib/intelligence-learning/types";

function slug(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return trimmed.replace(/^-|-$/g, "") || "selection";
}

export function recommendationPendingKey(input: {
  source: RecommendationSource;
  fixtureId: string;
  market: LearningMarket;
  selectionLabel: string;
}): string {
  return [
    input.source,
    input.fixtureId,
    input.market,
    slug(input.selectionLabel),
  ].join(":");
}

export function recommendationIdFromKey(pendingKey: string): string {
  return `rec:${pendingKey}`;
}

export function replayRecommendationId(
  pendingKey: string,
  timestamp: string,
): string {
  return `rec:${pendingKey}:${timestamp}`;
}
