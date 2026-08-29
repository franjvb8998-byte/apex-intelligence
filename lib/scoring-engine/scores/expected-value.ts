import { expectedValue } from "@/lib/match-rating/pricing";
import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

export function publishedExpectedValue(input: ScoringEngineInput): number | null {
  if (input.expectedValue != null && Number.isFinite(input.expectedValue)) {
    return input.expectedValue;
  }
  if (input.modelProbability == null || input.decimalOdds == null) return null;
  return expectedValue(input.modelProbability, input.decimalOdds);
}

/** Map decimal EV (−15% … +20%) onto 0–100. Null without a price or model p. */
export function scoreExpectedValue(input: ScoringEngineInput): ScoringComponent {
  const ev = publishedExpectedValue(input);
  if (ev == null) {
    return component(
      "expectedValue",
      null,
      "No EV without a published price and model probability.",
    );
  }
  return component(
    "expectedValue",
    clamp(((ev + 0.15) / 0.35) * 100, 0, 100),
    `EV ${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}%.`,
  );
}
