import { clamp, component } from "@/lib/scoring-engine/normalizers";
import type { ScoringComponent, ScoringEngineInput } from "@/lib/scoring-engine/types";

/** How much of the catalogue actually published — not a football quality score. */
export function scoreDataQuality(input: ScoringEngineInput): ScoringComponent {
  const coverage = input.coverage;
  const sample = input.formSample;
  const books = input.bookmakerCount;
  const twin = input.teamIntelligenceCoverage;
  const hasAny =
    coverage != null ||
    (sample != null && sample > 0) ||
    books > 0 ||
    twin != null ||
    input.injuriesPublished;

  if (!hasAny) {
    return component(
      "dataQuality",
      null,
      "No coverage, form sample, books, twin coverage or injury feed to score data quality.",
    );
  }

  let value = 28;
  if (coverage != null) value += clamp(coverage, 0, 1) * 32;
  if (sample != null && sample > 0) value += (Math.min(sample, 10) / 10) * 16;
  if (books > 0) value += clamp(books / 4, 0, 1) * 12;
  if (twin != null) value += clamp(twin, 0, 1) * 10;
  if (input.injuriesPublished) value += 6;

  return component(
    "dataQuality",
    clamp(value, 12, 96),
    "Data quality from published coverage, sample, books and twin completeness.",
  );
}
