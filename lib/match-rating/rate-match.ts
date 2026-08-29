/**
 * APEX Match Rating engine — weighted 0–100 score + decision fields.
 */

import { buildRatingMetrics } from "@/lib/match-rating/metrics";
import {
  expectedValue,
  fairOdds,
  quarterKelly,
  valueRatingFromEv,
} from "@/lib/match-rating/pricing";
import type {
  ApexMatchRating,
  ApexRatingAction,
  ApexRatingInput,
  ApexRatingRisk,
} from "@/lib/match-rating/types";
import type { ApexScoreBreakdown } from "@/lib/match-analysis/types";

const ACTION_LABEL: Record<ApexRatingAction, string> = {
  bet: "Bet",
  watch: "Watch",
  skip: "Skip",
};

function overallLabel(score: number, predictedLabel: string): string {
  if (score >= 80) return `Señal fuerte · ${predictedLabel}`;
  if (score >= 65) return `Señal constructiva · ${predictedLabel}`;
  if (score >= 50) return `Señal mixta · ${predictedLabel}`;
  return `Señal débil · ${predictedLabel}`;
}

function deriveRisk(input: ApexRatingInput): ApexRatingRisk {
  if (input.riskLevel) return input.riskLevel;
  if (input.confidence.band === "low" || input.oneXTwo.draw >= 0.32) return "high";
  if (input.confidence.band === "medium") return "medium";
  return "low";
}

function deriveAction(
  input: ApexRatingInput,
  risk: ApexRatingRisk,
  ev: number | null,
): ApexRatingAction {
  const explicit = input.recommendationAction;
  if (explicit === "bet") return ev != null && ev < 0 ? "watch" : "bet";
  if (explicit === "watch" || explicit === "reduce_stake") return "watch";
  if (explicit === "pass" || explicit === "other") return "skip";
  if (risk === "high" || input.confidence.band === "low") return "skip";
  if (input.confidence.band === "high" && risk === "low" && (ev == null || ev >= 0)) {
    return "bet";
  }
  return "watch";
}

export function rateMatch(input: ApexRatingInput): ApexMatchRating {
  const p = input.oneXTwo[input.predictedOutcome];
  const ev = expectedValue(p, input.decimalOdds);
  const metrics = buildRatingMetrics(input, ev);
  const available = metrics.filter((row) => row.available && row.score != null);
  const weightSum = available.reduce((sum, row) => sum + row.weight, 0);
  const overall =
    weightSum > 0
      ? Math.round(
          available.reduce((sum, row) => sum + (row.score ?? 0) * row.weight, 0) /
            weightSum,
        )
      : 0;
  const totalWeight = metrics.reduce((sum, row) => sum + row.weight, 0);
  const used = available.reduce((sum, row) => sum + row.weight, 0);
  const risk = deriveRisk(input);
  const recommendation = deriveAction(input, risk, ev);
  const kelly = quarterKelly(p, input.decimalOdds);
  const recommendedKelly =
    recommendation === "skip"
      ? 0
      : recommendation === "watch" && kelly != null
        ? Math.min(kelly, 0.0125)
        : kelly;

  let kellyLabel: string;
  if (input.decimalOdds == null) {
    kellyLabel = "n/d — sin cuota de mercado";
  } else if (recommendation === "skip") {
    kellyLabel = "0% · Skip";
  } else if (recommendedKelly == null) {
    kellyLabel = "n/d";
  } else {
    kellyLabel = `${(recommendedKelly * 100).toFixed(1)}% bankroll (¼ Kelly)`;
  }

  return {
    overall,
    label: input.headline ?? overallLabel(overall, input.predictedLabel),
    confidence: input.confidence,
    confidencePct: Math.round(input.confidence.value * 100),
    risk,
    valueRating: valueRatingFromEv(ev),
    kellyFraction: kelly,
    recommendedKelly,
    kellyLabel,
    fairOdds: fairOdds(p),
    expectedValue: ev,
    recommendation,
    recommendationLabel: ACTION_LABEL[recommendation],
    selectionLabel: input.predictedLabel,
    predictedOutcome: input.predictedOutcome,
    metrics,
    coverage: totalWeight > 0 ? used / totalWeight : 0,
  };
}

export function apexScoreFromRating(rating: ApexMatchRating): ApexScoreBreakdown {
  return {
    value: rating.overall,
    label: rating.label,
    components: rating.metrics.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.score ?? 0,
      weight: row.weight,
    })),
  };
}
