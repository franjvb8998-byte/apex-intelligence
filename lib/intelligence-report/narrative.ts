/**
 * Executive summary — templated from published facts. No LLM.
 */

import type { ReportFacts } from "@/lib/intelligence-report/facts";
import type {
  ApexReportMarket,
  ApexReportReason,
  ApexReportRisk,
  ApexIntelligenceReport,
} from "@/lib/intelligence-report/types";
import type { ApexMatchRating } from "@/lib/match-rating/types";

function valuePhrase(market: ApexReportMarket): string {
  if (market.flags.positiveEv && market.flags.underpriced) {
    return "undervalued";
  }
  if (market.flags.negativeEv || market.flags.overpriced) {
    return "overvalued";
  }
  if (market.expectedValue == null) {
    return "unpriced by the book";
  }
  return "fairly priced";
}

function evClause(market: ApexReportMarket): string {
  if (market.expectedValue == null) {
    return "No published bookmaker price is available, so expected value stays n/d.";
  }
  const pct = (market.expectedValue * 100).toFixed(1);
  const sign = market.expectedValue > 0 ? "+" : "";
  if (market.flags.positiveEv) {
    return `The market still offers positive expected value (${sign}${pct}%).`;
  }
  if (market.flags.negativeEv) {
    return `The current board does not offer value (EV ${sign}${pct}%).`;
  }
  return `Expected value is roughly flat (${sign}${pct}%).`;
}

function reasonClause(reasons: ApexReportReason[]): string {
  if (reasons.length === 0) {
    return "Published attacking, form and H2H edges are not strong enough to list as key reasons.";
  }
  const titles = reasons.slice(0, 3).map((row) => row.title);
  if (titles.length === 1) return `${titles[0]} is the main published edge.`;
  if (titles.length === 2) {
    return `${titles[0]} and ${titles[1].toLowerCase()} justify a higher win probability than a coin-flip.`;
  }
  return `${titles[0]}, ${titles[1].toLowerCase()} and ${titles[2].toLowerCase()} justify a higher win probability than implied by a neutral market.`;
}

function riskClause(risks: ApexReportRisk[]): string {
  if (risks.length === 0) {
    return "No published risk flags reduced the reading.";
  }
  const titles = risks.map((row) => row.title.toLowerCase());
  if (titles.length === 1) {
    return `Despite ${titles[0]}, the recommendation still follows the model probability and the board.`;
  }
  return `Despite ${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}, the market reading is unchanged in direction.`;
}

export function buildNarrative(input: {
  facts: ReportFacts;
  rating: ApexMatchRating;
  market: ApexReportMarket;
  reasons: ApexReportReason[];
  risks: ApexReportRisk[];
  verdict: ApexIntelligenceReport["verdict"];
  recommendation: ApexIntelligenceReport["recommendation"];
}): string {
  const { facts, market, reasons, risks, verdict, recommendation, rating } = input;
  const side =
    facts.predicted === "draw" ? "the draw" : `the ${facts.predicted} side (${facts.pickName})`;
  const priced = valuePhrase(market);
  const coverage =
    rating.coverage < 0.5
      ? " Several catalogue signals were unpublished, so this reading is thinner than a full board."
      : "";

  const close =
    recommendation.kind === "pass"
      ? `APEX therefore marks this as ${verdict.label} and recommends ${recommendation.label}.`
      : `APEX therefore marks this as ${verdict.label} and sizes it as ${recommendation.label} (${recommendation.exposureLabel} of bankroll).`;

  return [
    `APEX believes ${side} is ${priced}.`,
    reasonClause(reasons),
    riskClause(risks),
    evClause(market),
    close,
  ]
    .join(" ")
    .concat(coverage);
}
