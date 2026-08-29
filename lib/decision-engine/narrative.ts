/**
 * Deterministic executive copy from calculated metrics. No LLM.
 */

import type {
  ApexConfidenceBlock,
  ApexDecision,
  ApexDecisionInput,
  ApexRiskBlock,
  ApexValueBlock,
} from "@/lib/decision-engine/types";

export function explainDecision(input: {
  data: ApexDecisionInput;
  score: number;
  confidence: ApexConfidenceBlock;
  risk: ApexRiskBlock;
  value: ApexValueBlock;
  verdict: ApexDecision["verdict"];
  reasonsFor: ApexDecision["reasonsFor"];
}): string {
  const { data, score, confidence, risk, value, verdict, reasonsFor } = input;
  const side =
    data.predicted === "draw"
      ? "the draw"
      : `the ${data.predicted} side (${data.predicted === "away" ? data.awayName : data.homeName})`;

  const favor =
    score >= 70
      ? `The model strongly favors ${side}`
      : score >= 52
        ? `The model leans toward ${side}`
        : `The model only weakly prefers ${side}`;

  const why =
    reasonsFor.length >= 2
      ? ` because of ${reasonsFor[0]!.title.toLowerCase()}, ${reasonsFor[1]!.title.toLowerCase()}${
          reasonsFor[2] ? `, and ${reasonsFor[2].title.toLowerCase()}` : ""
        }.`
      : reasonsFor.length === 1
        ? ` because of ${reasonsFor[0]!.title.toLowerCase()}.`
        : " without a cluster of published edges.";

  const conf =
    confidence.band === "high"
      ? " Confidence remains high due to a usable sample and contained variance."
      : confidence.band === "medium"
        ? " Confidence is moderate — some catalogue pillars are thin or mixed."
        : " Confidence stays low because of missing data, injuries, or high 1X2 entropy.";

  const riskLine =
    risk.band === "high"
      ? " Risk is high, so stake is capped regardless of headline xG."
      : risk.band === "medium"
        ? " Risk is medium after published volatility and availability checks."
        : " Risk is contained on the published board.";

  const evLine =
    value.expectedValue == null
      ? " Expected value is n/d without a bookmaker price."
      : value.positiveEdge
        ? ` The market still offers a positive edge (EV ${(value.expectedValue * 100).toFixed(1)}%).`
        : value.negativeEdge
          ? ` The current price is a negative-EV proposition (EV ${(value.expectedValue * 100).toFixed(1)}%).`
          : ` Expected value is roughly flat (${(value.expectedValue * 100).toFixed(1)}%).`;

  return `${favor}${why}${conf}${riskLine}${evLine} Verdict: ${verdict.label}.`;
}
