/**
 * Official recommendation tiers for Scoring Engine v2.
 * Elite / Strong Bet / Value Bet / Watch / Avoid.
 */

import { publishedExpectedValue } from "@/lib/scoring-engine/scores/expected-value";
import type {
  ScoringComponent,
  ScoringEngineInput,
  ScoringRecommendation,
  ScoringTier,
} from "@/lib/scoring-engine/types";
import { SCORING_TIER_STARS } from "@/lib/scoring-engine/weights";

function pick(
  components: ScoringComponent[],
  key: ScoringComponent["key"],
): number | null {
  const row = components.find((item) => item.key === key);
  return row?.available ? (row.score ?? null) : null;
}

export function recommendScoring(args: {
  overall: number;
  input: ScoringEngineInput;
  components: ScoringComponent[];
}): ScoringRecommendation {
  const { overall, input, components } = args;
  const ev = publishedExpectedValue(input);
  const confidence = pick(components, "confidence") ?? input.confidence;
  const safety = pick(components, "risk");
  const negative = ev != null && ev < 0;

  let tier: ScoringTier;
  let note: string;

  if (negative || (safety != null && safety < 32 && (confidence ?? 100) < 42)) {
    tier = "Avoid";
    note = negative
      ? "Negative expected value against the published price."
      : "High raw risk with weak confidence.";
  } else if (
    overall >= 80 &&
    (confidence ?? 0) >= 70 &&
    (safety == null || safety >= 52) &&
    (ev == null || ev >= 0.05)
  ) {
    tier = "Elite";
    note = "Top-band overall with high confidence and non-negative edge.";
  } else if (
    overall >= 66 &&
    (confidence ?? 0) >= 55 &&
    (safety == null || safety >= 45) &&
    (ev == null || ev >= 0.02)
  ) {
    tier = "Strong Bet";
    note = "Strong overall with acceptable risk and a non-negative edge.";
  } else if (ev != null && ev > 0 && overall >= 48 && (safety == null || safety >= 38)) {
    tier = "Value Bet";
    note = "Positive expected value on a mid-band overall.";
  } else if (overall < 40 || (confidence != null && confidence < 38)) {
    tier = "Avoid";
    note = "Overall or confidence too thin to recommend a stake.";
  } else {
    tier = "Watch";
    note = "Not Avoid, not a priced value or strong band — watch the board.";
  }

  return { tier, stars: SCORING_TIER_STARS[tier], note };
}
