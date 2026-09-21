/**
 * Daily ranking boards from the raw Decision Engine scan.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { isStrongOrElite, scannerRecommendation } from "@/lib/opportunity-scanner/recommend";
import { filterCurrentActionableOpportunities } from "@/lib/prematch-decision/actionability";

export type ScannerRankingKind =
  | "top10"
  | "value"
  | "confidence"
  | "longshots";

export type ScannerRankingBoard = {
  kind: ScannerRankingKind;
  items: ApexOpportunity[];
};

const LIMIT = 10;

export type ScannerDeskStats = {
  today: number;
  strong: number;
  value: number;
  averageConfidence: number | null;
  averageEv: number | null;
};

export function scannerDeskStats(rows: ApexOpportunity[]): ScannerDeskStats {
  const actionable = filterCurrentActionableOpportunities(rows);
  const strong = actionable.filter(isStrongOrElite).length;
  const value = actionable.filter(
    (row) => scannerRecommendation(row) === "Value Bet",
  ).length;
  const conf =
    actionable.length === 0
      ? null
      : actionable.reduce((sum, row) => sum + row.confidence, 0) / actionable.length;
  const evs = actionable
    .map((row) => row.expectedValue)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const averageEv =
    evs.length === 0
      ? null
      : evs.reduce((sum, value) => sum + value, 0) / evs.length;
  return {
    today: actionable.length,
    strong,
    value,
    averageConfidence: conf,
    averageEv,
  };
}

function byScore(a: ApexOpportunity, b: ApexOpportunity): number {
  if (b.score !== a.score) return b.score - a.score;
  return (b.expectedValue ?? -99) - (a.expectedValue ?? -99);
}

export function buildScannerRankings(
  analyzed: ApexOpportunity[],
): ScannerRankingBoard[] {
  const actionable = filterCurrentActionableOpportunities(analyzed);
  const live = actionable.filter((row) => row.verdict !== "avoid" || (row.expectedValue ?? 0) > 0);

  return [
    {
      kind: "top10",
      items: [...actionable].sort(byScore).slice(0, LIMIT),
    },
    {
      kind: "value",
      items: actionable
        .filter((row) => scannerRecommendation(row) === "Value Bet" || (row.expectedValue ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.expectedValue ?? Number.NEGATIVE_INFINITY) -
            (a.expectedValue ?? Number.NEGATIVE_INFINITY),
        )
        .slice(0, LIMIT),
    },
    {
      kind: "confidence",
      items: actionable
        .filter((row) => row.confidence >= 65)
        .sort((a, b) => b.confidence - a.confidence || byScore(a, b))
        .slice(0, LIMIT),
    },
    {
      kind: "longshots",
      items: live
        .filter((row) => (row.bookmakerOdds ?? 0) >= 3)
        .sort(
          (a, b) =>
            (b.expectedValue ?? Number.NEGATIVE_INFINITY) -
            (a.expectedValue ?? Number.NEGATIVE_INFINITY) ||
            (b.bookmakerOdds ?? 0) - (a.bookmakerOdds ?? 0),
        )
        .slice(0, LIMIT),
    },
  ];
}
