/**
 * Post Match evaluation availability.
 *
 * Final result-vs-prediction metrics are produced only for Apex `finished`
 * matches (vendor FT / AET / PEN). Live and prematch payloads must not
 * impersonate a completed evaluation.
 */

import type { MatchCenterPostData } from "@/lib/match-center/types";

export function isMatchCenterPostEvaluated(
  post: MatchCenterPostData,
): boolean {
  return post.evaluationAvailable !== false;
}

export function unevaluatedMatchCenterPost(input: {
  at: string;
  score: { home: number; away: number };
  summary: string;
}): MatchCenterPostData {
  return {
    finishedAt: input.at,
    finalScore: input.score,
    actualOutcome: "draw",
    preMatch: {
      predictedOutcome: "draw",
      oneXTwo: { home: 0, draw: 0, away: 0 },
      confidence: { value: 0, band: "low" },
      modelVersion: "unevaluated",
    },
    outcomeHit: false,
    markets: [],
    metrics: { brierScore: 0, outcomeError: 0 },
    learningSummary: input.summary,
    notes: [],
    recommendations: [],
    source: "data-platform",
    evaluationAvailable: false,
  };
}
