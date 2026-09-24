/**
 * GOALS-1F.1 — Expected-total strata from 2023 tertiles (frozen for 2024).
 */

import type { LabeledG1Row } from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";

export type ExpectedTotalCuts = {
  /** Exclusive upper bound for low tertile (33rd pct of 2023 EP_total). */
  lowMax: number;
  /** Exclusive upper bound for medium tertile (66th pct of 2023 EP_total). */
  mediumMax: number;
  sourceSeason: "2023";
  n: number;
};

export function computeExpectedTotalCutsFrom2023(
  rows2023: readonly LabeledG1Row[],
): ExpectedTotalCuts {
  const totals = rows2023
    .map((r) => r.muTotal)
    .sort((a, b) => a - b);
  if (totals.length === 0) {
    throw new Error("Cannot compute strata cuts from empty 2023 rows");
  }
  const pct = (p: number) => {
    const idx = Math.min(
      totals.length - 1,
      Math.max(0, Math.floor((p / 100) * (totals.length - 1))),
    );
    return totals[idx]!;
  };
  return {
    lowMax: pct(33),
    mediumMax: pct(66),
    sourceSeason: "2023",
    n: totals.length,
  };
}

export function assignExpectedTotalStratum(
  muTotal: number,
  cuts: ExpectedTotalCuts,
): "low" | "medium" | "high" {
  if (muTotal <= cuts.lowMax) return "low";
  if (muTotal <= cuts.mediumMax) return "medium";
  return "high";
}

export function stratifiedRobustness(
  rows: readonly LabeledG1Row[],
  cuts: ExpectedTotalCuts,
) {
  const byEvidence: Record<string, LabeledG1Row[]> = {
    BASE_PRIOR: [],
    THIN: [],
    DEVELOPING: [],
    ESTABLISHED: [],
  };
  const byTotal: Record<"low" | "medium" | "high", LabeledG1Row[]> = {
    low: [],
    medium: [],
    high: [],
  };
  for (const r of rows) {
    const b = r.evidenceSupportBucket;
    if (b in byEvidence) byEvidence[b]!.push(r);
    byTotal[assignExpectedTotalStratum(r.muTotal, cuts)].push(r);
  }

  const summarize = (subset: readonly LabeledG1Row[]) => {
    const n = subset.length;
    let obs00 = 0;
    let exp00 = 0;
    let pearsonTot = 0;
    let pearsonN = 0;
    for (const r of subset) {
      if (r.actualTotal === 0) obs00 += 1;
      exp00 += r.p00;
      if (r.muTotal > 0) {
        pearsonTot += ((r.actualTotal - r.muTotal) ** 2) / r.muTotal;
        pearsonN += 1;
      }
    }
    return {
      n,
      zeroZeroObserved: obs00,
      zeroZeroExpected: exp00,
      zeroZeroRateDiff: n ? obs00 / n - exp00 / n : null,
      pearsonTotalDispersion: pearsonN ? pearsonTot / pearsonN : null,
    };
  };

  return {
    cuts,
    byEvidenceQuality: Object.fromEntries(
      Object.entries(byEvidence).map(([k, v]) => [k, summarize(v)]),
    ),
    byExpectedTotal: {
      low: summarize(byTotal.low),
      medium: summarize(byTotal.medium),
      high: summarize(byTotal.high),
    },
  };
}
