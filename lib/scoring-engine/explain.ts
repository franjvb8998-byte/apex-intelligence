/**
 * Explainability for Scoring Engine v2 — why the overall and the tier exist.
 */

import { publishedExpectedValue } from "@/lib/scoring-engine/scores/expected-value";
import type {
  ScoringComponent,
  ScoringEngineInput,
  ScoringExplanation,
  ScoringExplanationFactor,
  ScoringTier,
} from "@/lib/scoring-engine/types";

function topAvailable(
  components: ScoringComponent[],
  direction: "high" | "low",
  limit: number,
): ScoringComponent[] {
  const rows = components.filter((row) => row.available && row.score != null);
  const sorted = [...rows].sort((a, b) =>
    direction === "high"
      ? (b.score ?? 0) - (a.score ?? 0)
      : (a.score ?? 0) - (b.score ?? 0),
  );
  return sorted.slice(0, limit);
}

export function explainScoring(args: {
  input: ScoringEngineInput;
  overall: number;
  coverage: number;
  components: ScoringComponent[];
  recommendation: ScoringTier;
}): ScoringExplanation {
  const { input, overall, coverage, components, recommendation } = args;
  const ev = publishedExpectedValue(input);
  const evLabel =
    ev == null ? "n/d" : `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`;

  const supporting: ScoringExplanationFactor[] = topAvailable(
    components,
    "high",
    4,
  ).map((row) => ({
    key: row.key,
    title: row.label,
    detail: `${row.score}/100. ${row.note}`,
  }));

  const against: ScoringExplanationFactor[] = topAvailable(
    components,
    "low",
    3,
  )
    .filter((row) => (row.score ?? 100) <= 55)
    .map((row) => ({
      key: row.key,
      title: row.label,
      detail: `${row.score}/100. ${row.note}`,
    }));

  const missing = components.filter((row) => !row.available);
  if (missing.length > 0 && against.length < 3) {
    against.push({
      key: missing[0]!.key,
      title: missing[0]!.label,
      detail: missing[0]!.note,
    });
  }

  const summary = `${input.selectionLabel} scores ${overall}/100 (${recommendation}) with ${(coverage * 100).toFixed(0)}% pillar coverage and EV ${evLabel}. Weights renormalize over published components only.`;

  return {
    summary,
    overall,
    coverage,
    recommendation,
    supporting,
    against,
  };
}
