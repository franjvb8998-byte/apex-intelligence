/**
 * Published APEX Score weights. Missing positives are dropped and renormalized.
 * Injuries and risk are downward adjustments, never invented.
 */

import type { ApexScoreComponentKey } from "@/lib/decision-engine/types";

export const DECISION_POSITIVE_WEIGHTS: Record<
  Exclude<ApexScoreComponentKey, "injuries" | "riskAdjustment">,
  number
> = {
  attack: 0.15,
  defense: 0.15,
  form: 0.15,
  xg: 0.1,
  homeAdvantage: 0.08,
  rest: 0.05,
  motivation: 0.05,
  market: 0.12,
  value: 0.1,
};

export const DECISION_INJURY_WEIGHT = 0.08;
export const DECISION_RISK_WEIGHT = 0.07;

export const DECISION_COMPONENT_LABELS: Record<ApexScoreComponentKey, string> = {
  attack: "Attack",
  defense: "Defense",
  form: "Recent Form",
  xg: "xG Quality",
  homeAdvantage: "Home Advantage",
  rest: "Rest Days",
  injuries: "Injuries",
  motivation: "Motivation",
  market: "Market Edge",
  value: "Value",
  riskAdjustment: "Risk Adjustment",
};

export const STAKE_STEPS = [0, 0.5, 1, 2, 3, 5] as const;
export const MAX_STAKE_PCT = 5;
