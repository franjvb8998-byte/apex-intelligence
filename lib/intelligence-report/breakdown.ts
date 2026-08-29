/**
 * Nine-bar APEX Score Breakdown. Missing catalogue signals stay n/d.
 */

import { clamp, roundScore } from "@/lib/match-rating/pricing";
import type { ApexReportRisk, ApexReportBreakdownBar } from "@/lib/intelligence-report/types";
import { totalRiskPenalty } from "@/lib/intelligence-report/risks";
import type { ApexMatchRating, ApexRatingMetricKey } from "@/lib/match-rating/types";
import type { OutcomeProbability } from "@/lib/intelligence/types";

const RISK_BASE = { low: 82, medium: 55, high: 28 } as const;

function metricScore(
  rating: ApexMatchRating,
  key: ApexRatingMetricKey,
): { score: number | null; note: string } {
  const row = rating.metrics.find((metric) => metric.key === key);
  if (!row || !row.available || row.score == null) {
    return { score: null, note: row?.note ?? "Not published." };
  }
  return { score: row.score, note: row.note };
}

function blend(
  a: { score: number | null; note: string },
  b: { score: number | null; note: string },
): { score: number | null; note: string } {
  if (a.score == null && b.score == null) {
    return { score: null, note: "No published market depth or implied-probability signal." };
  }
  if (a.score == null) return b;
  if (b.score == null) return a;
  return {
    score: roundScore((a.score + b.score) / 2),
    note: "Blend of bookmaker depth and implied-probability agreement.",
  };
}

/** Shannon-style concentration of the 1X2 board (always available from PE). */
export function disciplineScore(oneXTwo: OutcomeProbability): number {
  const parts = [oneXTwo.home, oneXTwo.draw, oneXTwo.away].filter(
    (p) => p > 0,
  );
  const entropy = parts.reduce((sum, p) => sum + -p * Math.log2(p), 0);
  const maxEntropy = Math.log2(3);
  return roundScore((1 - entropy / maxEntropy) * 100);
}

export function buildBreakdown(input: {
  rating: ApexMatchRating;
  oneXTwo: OutcomeProbability;
  risks: ApexReportRisk[];
}): ApexReportBreakdownBar[] {
  const { rating, oneXTwo, risks } = input;
  const attack = metricScore(rating, "attack");
  const defense = metricScore(rating, "defense");
  const momentum = metricScore(rating, "momentum");
  const form = metricScore(rating, "form");
  const value = metricScore(rating, "value");
  const market = blend(
    metricScore(rating, "odds"),
    metricScore(rating, "impliedProbability"),
  );
  const penalty = totalRiskPenalty(risks);
  const riskScore = roundScore(
    clamp(RISK_BASE[rating.risk] - penalty * 1.1, 0, 100),
  );
  const fitness = metricScore(rating, "injuries");
  const discipline = disciplineScore(oneXTwo);

  return [
    {
      key: "attack",
      label: "Attack",
      score: attack.score,
      available: attack.score != null,
      note: attack.note,
    },
    {
      key: "defense",
      label: "Defense",
      score: defense.score,
      available: defense.score != null,
      note: defense.note,
    },
    {
      key: "momentum",
      label: "Momentum",
      score: momentum.score,
      available: momentum.score != null,
      note: momentum.note,
    },
    {
      key: "form",
      label: "Form",
      score: form.score,
      available: form.score != null,
      note: form.note,
    },
    {
      key: "value",
      label: "Value",
      score: value.score,
      available: value.score != null,
      note: value.note,
    },
    {
      key: "market",
      label: "Market",
      score: market.score,
      available: market.score != null,
      note: market.note,
    },
    {
      key: "risk",
      label: "Risk",
      score: riskScore,
      available: true,
      note:
        penalty > 0
          ? `Starts from Match Rating risk (${rating.risk}), then subtracts published risk penalties.`
          : `Match Rating risk band: ${rating.risk}. No extra published penalties.`,
    },
    {
      key: "discipline",
      label: "Discipline",
      score: discipline,
      available: true,
      note: "Concentration of the Probability Engine 1X2 board. Higher = less three-way noise.",
    },
    {
      key: "fitness",
      label: "Fitness",
      score: fitness.score,
      available: fitness.score != null,
      note: fitness.note,
    },
  ];
}
