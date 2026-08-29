/**
 * Verdict, adjusted confidence, and stake buckets.
 * Deterministic map from Match Rating + Intelligence Report risks.
 */

import { clamp } from "@/lib/match-rating/pricing";
import type {
  ApexReportRisk,
  ApexStakeKind,
  ApexVerdictKind,
} from "@/lib/intelligence-report/types";
import { totalRiskPenalty } from "@/lib/intelligence-report/risks";
import type { ApexMatchRating } from "@/lib/match-rating/types";

export const EXPOSURE_STEPS = [0.5, 1, 2, 3, 5] as const;

export type VerdictBlock = {
  kind: ApexVerdictKind;
  label: string;
  stars: number;
  selectionLabel: string;
};

export type ConfidenceBlock = {
  value: number;
  base: number;
  band: "low" | "medium" | "high";
  caption: string;
};

export type RecommendationBlock = {
  kind: ApexStakeKind;
  label: string;
  exposurePct: number;
  exposureLabel: string;
};

const VERDICT_LABEL: Record<ApexVerdictKind, string> = {
  strong_bet: "Strong Bet",
  lean_bet: "Lean Bet",
  avoid: "Avoid",
};

const VERDICT_STARS: Record<ApexVerdictKind, number> = {
  strong_bet: 5,
  lean_bet: 4,
  avoid: 2,
};

const STAKE_LABEL: Record<ApexStakeKind, string> = {
  pass: "PASS",
  small: "SMALL BET",
  medium: "MEDIUM BET",
  strong: "STRONG BET",
};

function confidenceBand(value: number): ConfidenceBlock["band"] {
  if (value >= 75) return "high";
  if (value >= 45) return "medium";
  return "low";
}

function bandCaption(band: ConfidenceBlock["band"]): string {
  if (band === "high") return "High confidence";
  if (band === "medium") return "Medium confidence";
  return "Low confidence";
}

export function adjustConfidence(
  basePct: number,
  risks: ApexReportRisk[],
): ConfidenceBlock {
  const base = clamp(Math.round(basePct), 0, 100);
  const value = clamp(base - totalRiskPenalty(risks), 0, 100);
  const band = confidenceBand(value);
  return { value, base, band, caption: bandCaption(band) };
}

export function decideVerdict(
  rating: ApexMatchRating,
  confidence: ConfidenceBlock,
): VerdictBlock {
  const ev = rating.expectedValue;
  const skip = rating.recommendation === "skip";
  const negativeEv = ev != null && ev < 0;

  let kind: ApexVerdictKind = "avoid";
  if (skip || negativeEv || confidence.value < 40) {
    kind = "avoid";
  } else if (
    rating.recommendation === "bet" &&
    (ev == null || ev >= 0.04) &&
    confidence.value >= 70 &&
    rating.risk !== "high"
  ) {
    kind = "strong_bet";
  } else if (
    (rating.recommendation === "bet" || rating.recommendation === "watch") &&
    (ev == null || ev >= 0) &&
    confidence.value >= 50
  ) {
    kind = "lean_bet";
  }

  return {
    kind,
    label: VERDICT_LABEL[kind],
    stars: VERDICT_STARS[kind],
    selectionLabel: rating.selectionLabel,
  };
}

export function snapExposure(pct: number): (typeof EXPOSURE_STEPS)[number] {
  let best: (typeof EXPOSURE_STEPS)[number] = EXPOSURE_STEPS[0];
  let dist = Number.POSITIVE_INFINITY;
  for (const step of EXPOSURE_STEPS) {
    const d = Math.abs(step - pct);
    if (d < dist) {
      dist = d;
      best = step;
    }
  }
  return best;
}

export function decideRecommendation(
  verdict: VerdictBlock,
  rating: ApexMatchRating,
): RecommendationBlock {
  if (verdict.kind === "avoid") {
    return {
      kind: "pass",
      label: STAKE_LABEL.pass,
      exposurePct: 0,
      exposureLabel: "0%",
    };
  }

  const kellyPct =
    rating.recommendedKelly != null
      ? rating.recommendedKelly * 100
      : rating.kellyFraction != null
        ? rating.kellyFraction * 100
        : verdict.kind === "strong_bet"
          ? 3
          : 1;

  const cap = verdict.kind === "strong_bet" ? 5 : 2;
  const floor = kellyPct <= 0 ? 0.5 : kellyPct;
  const exposurePct = Math.min(cap, snapExposure(floor));

  let kind: ApexStakeKind = "small";
  if (exposurePct >= 3) kind = "strong";
  else if (exposurePct >= 2) kind = "medium";
  else kind = "small";

  if (verdict.kind === "lean_bet" && kind === "strong") {
    kind = "medium";
  }

  return {
    kind,
    label: STAKE_LABEL[kind],
    exposurePct,
    exposureLabel: `${exposurePct}%`,
  };
}
