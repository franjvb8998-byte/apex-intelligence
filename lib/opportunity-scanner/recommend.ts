/**
 * Scanner recommendation — Scoring Engine v2 tier, never a parallel mapper.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";

export type ScannerRecommendation = ScoringTier;

export function scannerRecommendation(
  row: ApexOpportunity,
): ScannerRecommendation {
  return row.recommendation;
}

export function isStrongOrElite(row: ApexOpportunity): boolean {
  return row.recommendation === "Elite" || row.recommendation === "Strong Bet";
}
