/**
 * Value Engine — model probability vs published market. No invented prices.
 */

import type { ApexDecisionInput, ApexValueBlock } from "@/lib/decision-engine/types";
import {
  expectedValue,
  fairOdds,
  impliedProbability,
} from "@/lib/match-rating/pricing";

const EDGE_EPS = 0.005;

export function evaluateValue(input: ApexDecisionInput): ApexValueBlock {
  const modelProbability = input.oneXTwo[input.predicted];
  const marketProbability = impliedProbability(input.decimalOdds);
  const ev = expectedValue(modelProbability, input.decimalOdds);
  const fair = fairOdds(modelProbability);
  const marketEdge =
    marketProbability != null ? modelProbability - marketProbability : null;
  const valuePct = marketEdge != null ? marketEdge : ev;

  return {
    modelProbability,
    marketProbability,
    valuePct,
    expectedValue: ev,
    fairOdds: fair,
    impliedOdds: input.decimalOdds,
    marketEdge,
    positiveEdge: (marketEdge != null && marketEdge > EDGE_EPS) || (ev != null && ev > EDGE_EPS),
    negativeEdge:
      (marketEdge != null && marketEdge < -EDGE_EPS) || (ev != null && ev < -EDGE_EPS),
  };
}
