/**
 * AI modes — reorder / gate Decision Engine rows. Never re-score.
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { isStrongOrElite, scannerRecommendation } from "@/lib/opportunity-scanner/recommend";

export type ScannerMode =
  | "ranked"
  | "conservative"
  | "value_hunter"
  | "high_odds"
  | "smart_combo"
  | "underdogs"
  | "premium";

export const SCANNER_MODES: Array<{ id: ScannerMode }> = [
  { id: "ranked" },
  { id: "conservative" },
  { id: "value_hunter" },
  { id: "high_odds" },
  { id: "smart_combo" },
  { id: "underdogs" },
  { id: "premium" },
];

function byScoreEv(a: ApexOpportunity, b: ApexOpportunity): number {
  if (b.score !== a.score) return b.score - a.score;
  const ev = (b.expectedValue ?? Number.NEGATIVE_INFINITY) - (a.expectedValue ?? Number.NEGATIVE_INFINITY);
  if (ev !== 0) return ev;
  return b.confidence - a.confidence;
}

export function applyScannerMode(
  rows: ApexOpportunity[],
  mode: ScannerMode,
): ApexOpportunity[] {
  const list = [...rows];

  if (mode === "ranked") {
    return list.sort(byScoreEv);
  }

  if (mode === "conservative") {
    return list
      .filter(
        (row) =>
          row.recommendation !== "Avoid" &&
          row.confidence >= 60 &&
          (row.bookmakerOdds == null || row.bookmakerOdds <= 2.2),
      )
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.riskScore - b.riskScore;
      });
  }

  if (mode === "value_hunter") {
    return list
      .filter((row) => (row.expectedValue ?? 0) > 0)
      .sort((a, b) => {
        const ev =
          (b.expectedValue ?? Number.NEGATIVE_INFINITY) -
          (a.expectedValue ?? Number.NEGATIVE_INFINITY);
        if (ev !== 0) return ev;
        return byScoreEv(a, b);
      });
  }

  if (mode === "high_odds") {
    return list
      .filter((row) => (row.bookmakerOdds ?? 0) >= 2.5)
      .sort((a, b) => {
        const odds = (b.bookmakerOdds ?? 0) - (a.bookmakerOdds ?? 0);
        if (odds !== 0) return odds;
        return byScoreEv(a, b);
      });
  }

  if (mode === "smart_combo") {
    return list
      .filter(
        (row) =>
          scannerRecommendation(row) !== "Avoid" &&
          row.bookmakerOdds != null &&
          row.bookmakerOdds > 1,
      )
      .sort((a, b) => {
        const leaguePenalty = (row: ApexOpportunity, others: ApexOpportunity[]) =>
          others.some(
            (other) =>
              other.fixtureId !== row.fixtureId &&
              other.leagueName === row.leagueName,
          )
            ? 8
            : 0;
        const scoreA = a.score + (a.expectedValue ?? 0) * 40 - leaguePenalty(a, list);
        const scoreB = b.score + (b.expectedValue ?? 0) * 40 - leaguePenalty(b, list);
        return scoreB - scoreA;
      });
  }

  if (mode === "underdogs") {
    return list
      .filter(
        (row) =>
          row.predicted === "away" || (row.bookmakerOdds ?? 0) >= 2.8,
      )
      .sort((a, b) => {
        const ev =
          (b.expectedValue ?? Number.NEGATIVE_INFINITY) -
          (a.expectedValue ?? Number.NEGATIVE_INFINITY);
        if (ev !== 0) return ev;
        return (b.bookmakerOdds ?? 0) - (a.bookmakerOdds ?? 0);
      });
  }

  return list
    .filter((row) => isStrongOrElite(row))
    .sort(byScoreEv);
}
