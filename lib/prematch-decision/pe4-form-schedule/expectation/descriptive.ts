/**
 * PE-4G.3 — Descriptive distribution audits (no model fitting).
 */

import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

/** Predeclared fixed-width diagnostic ranges — NOT optimized on outcomes. */
export const PE4_EXPECTATION_DIAGNOSTIC_D_RANGES = [
  { id: "le_-100", min: Number.NEGATIVE_INFINITY, maxExclusive: -100 },
  { id: "(-100,-50]", min: -100, maxExclusive: -50 },
  { id: "(-50,-20]", min: -50, maxExclusive: -20 },
  { id: "(-20,-5]", min: -20, maxExclusive: -5 },
  { id: "(-5,5]", min: -5, maxExclusive: 5 },
  { id: "(5,20]", min: 5, maxExclusive: 20 },
  { id: "(20,50]", min: 20, maxExclusive: 50 },
  { id: "(50,100]", min: 50, maxExclusive: 100 },
  { id: "gt_100", min: 100, maxExclusive: Number.POSITIVE_INFINITY },
] as const;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function describePe4ExpectationDataset(
  rows: readonly Pe4ExpectationDatasetRow[],
) {
  const D = rows.map((r) => r.strengthDifferentialHome).sort((a, b) => a - b);
  const homeGoals = rows.map((r) => r.actualHomeGoals);
  const awayGoals = rows.map((r) => r.actualAwayGoals);
  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  const outcomeCounts = { HOME: 0, DRAW: 0, AWAY: 0 };
  const qualityCounts = {
    catalogue_catalogue: 0,
    catalogue_base_prior: 0,
    base_prior_catalogue: 0,
    base_prior_base_prior: 0,
    unavailable: 0,
  };
  const seasonCounts: Record<string, number> = {};
  for (const row of rows) {
    outcomeCounts[row.actualOutcome] += 1;
    qualityCounts[row.qualityKind] += 1;
    seasonCounts[row.season] = (seasonCounts[row.season] ?? 0) + 1;
  }

  const dRangeCounts: Record<string, number> = {};
  for (const range of PE4_EXPECTATION_DIAGNOSTIC_D_RANGES) {
    dRangeCounts[range.id] = 0;
  }
  for (const d of D) {
    for (const range of PE4_EXPECTATION_DIAGNOSTIC_D_RANGES) {
      if (d >= range.min && d < range.maxExclusive) {
        dRangeCounts[range.id] += 1;
        break;
      }
    }
  }

  const bothBasePrior = rows.filter((r) => r.lowInformationBothBasePrior);
  const homePlayed = rows.map((r) => r.homePlayed).sort((a, b) => a - b);
  const awayPlayed = rows.map((r) => r.awayPlayed).sort((a, b) => a - b);

  return {
    totalRows: rows.length,
    seasonCounts,
    outcomeCounts,
    outcomeRates: {
      HOME: rows.length ? outcomeCounts.HOME / rows.length : 0,
      DRAW: rows.length ? outcomeCounts.DRAW / rows.length : 0,
      AWAY: rows.length ? outcomeCounts.AWAY / rows.length : 0,
    },
    qualityCounts,
    differential: {
      min: D[0] ?? null,
      max: D[D.length - 1] ?? null,
      median: quantile(D, 0.5),
      p10: quantile(D, 0.1),
      p25: quantile(D, 0.25),
      p75: quantile(D, 0.75),
      p90: quantile(D, 0.9),
      diagnosticRangeCounts: dRangeCounts,
    },
    played: {
      homeMedian: quantile(homePlayed, 0.5),
      awayMedian: quantile(awayPlayed, 0.5),
      homeP10: quantile(homePlayed, 0.1),
      homeP90: quantile(homePlayed, 0.9),
    },
    scoring: {
      meanHomeGoals: mean(homeGoals),
      meanAwayGoals: mean(awayGoals),
      meanTotalGoals: mean(
        rows.map((r) => r.actualHomeGoals + r.actualAwayGoals),
      ),
    },
    bothBasePrior: {
      count: bothBasePrior.length,
      seasons: [...new Set(bothBasePrior.map((r) => r.season))].sort(),
      outcomeCounts: bothBasePrior.reduce(
        (acc, r) => {
          acc[r.actualOutcome] += 1;
          return acc;
        },
        { HOME: 0, DRAW: 0, AWAY: 0 },
      ),
      differentialValues: [
        ...new Set(bothBasePrior.map((r) => r.strengthDifferentialHome)),
      ].sort((a, b) => a - b),
    },
  };
}
