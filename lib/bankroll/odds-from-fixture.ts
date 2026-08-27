/**
 * Map Data Platform odds quotes onto Add Bet market labels.
 */

import { BANKROLL_MARKETS } from "@/lib/bankroll/form";
import type { SuggestedOdds } from "@/lib/bankroll/types";
import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";

function parseOdd(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 1) return null;
  return value;
}

function keepBest(current: number | undefined, next: number): number {
  return current == null || next > current ? next : current;
}

function marketKey(
  quote: ApexOddsQuote,
  selectionKey: string,
  selectionLabel: string,
): (typeof BANKROLL_MARKETS)[number] | null {
  const key = selectionKey.toLowerCase();
  const label = selectionLabel.toLowerCase();
  if (quote.market === "1x2") {
    if (key === "home" || key === "1" || label === "home") return "1X2 · Local";
    if (key === "draw" || key === "x" || label === "draw") return "1X2 · Empate";
    if (key === "away" || key === "2" || label === "away") return "1X2 · Visitante";
  }
  if (quote.market === "over_under" && (quote.line == null || quote.line === 2.5)) {
    if (key.startsWith("over") || label.includes("over")) return "Over 2.5";
    if (key.startsWith("under") || label.includes("under")) return "Under 2.5";
  }
  if (quote.market === "btts") {
    if (key === "yes" || key === "si" || key === "sí" || label === "yes") {
      return "BTTS · Sí";
    }
    if (key === "no" || label === "no") return "BTTS · No";
  }
  return null;
}

export function suggestedOddsFromQuotes(quotes: ApexOddsQuote[]): SuggestedOdds {
  const next: SuggestedOdds = {};
  for (const quote of quotes) {
    for (const selection of quote.selections) {
      const odd = parseOdd(selection.decimalOdds);
      if (odd == null) continue;
      const market = marketKey(quote, selection.key, selection.label);
      if (!market) continue;
      next[market] = keepBest(next[market], odd);
    }
  }
  return next;
}
