import { impliedProbability } from "@/lib/match-rating/pricing";
import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

export function publishedMarketEdge(input: ScoringEngineInput): number | null {
  if (input.marketEdge != null && Number.isFinite(input.marketEdge)) {
    return input.marketEdge;
  }
  if (input.modelProbability == null) return null;
  const implied = impliedProbability(input.decimalOdds);
  if (implied == null) return null;
  return input.modelProbability - implied;
}

/** Edge vs implied board, with a small bump for bookmaker depth. */
export function scoreMarketValue(input: ScoringEngineInput): ScoringComponent {
  const edge = publishedMarketEdge(input);
  if (edge == null) {
    return component(
      "marketValue",
      null,
      "No market value without a published bookmaker price.",
    );
  }
  const depth = clamp(input.bookmakerCount / 4, 0, 1);
  const fromEdge = clamp(50 + edge * 220, 0, 100);
  return component(
    "marketValue",
    fromEdge * 0.82 + depth * 18,
    `Market edge ${(edge * 100).toFixed(1)} pp · ${input.bookmakerCount} book(s).`,
  );
}
