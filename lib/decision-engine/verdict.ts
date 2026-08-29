/**
 * Final verdict — 5-tier card. Deterministic from score, confidence, risk and EV.
 */

import type {
  ApexConfidenceBlock,
  ApexDecisionVerdictKind,
  ApexRiskBlock,
  ApexValueBlock,
} from "@/lib/decision-engine/types";

export const VERDICT_META: Record<
  ApexDecisionVerdictKind,
  { label: string; stars: number }
> = {
  elite_pick: { label: "Elite Pick", stars: 5 },
  strong_bet: { label: "Strong Bet", stars: 4 },
  lean_bet: { label: "Lean Bet", stars: 3 },
  pass: { label: "Pass", stars: 2 },
  avoid: { label: "Avoid", stars: 1 },
};

export function decideVerdict(input: {
  score: number;
  confidence: ApexConfidenceBlock;
  risk: ApexRiskBlock;
  value: ApexValueBlock;
}): { kind: ApexDecisionVerdictKind; label: string; stars: number } {
  const ev = input.value.expectedValue;
  const negative = ev != null && ev < 0;
  const { score, confidence, risk } = input;

  let kind: ApexDecisionVerdictKind;
  if (negative || (risk.band === "high" && confidence.value < 40)) {
    kind = "avoid";
  } else if (
    score >= 78 &&
    confidence.value >= 70 &&
    risk.band !== "high" &&
    (ev == null || ev >= 0.05)
  ) {
    kind = "elite_pick";
  } else if (
    score >= 65 &&
    confidence.value >= 55 &&
    risk.band !== "high" &&
    (ev == null || ev >= 0.02)
  ) {
    kind = "strong_bet";
  } else if (
    score >= 52 &&
    confidence.value >= 45 &&
    (ev == null || ev >= 0) &&
    risk.band !== "high"
  ) {
    kind = "lean_bet";
  } else if (ev != null && ev > 0 && risk.band === "high") {
    kind = "pass";
  } else if (confidence.value < 40 || risk.band === "high") {
    kind = "avoid";
  } else {
    kind = "pass";
  }

  return { kind, ...VERDICT_META[kind] };
}
