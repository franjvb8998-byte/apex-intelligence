import type { ApexOddsQuote } from "@/lib/data-platform/types/odds";
import type { BothTeamsToScoreProbability } from "@/lib/intelligence/modules/probability";
import type { OutcomeProbability } from "@/lib/intelligence/types";
import type { MatchCenterOddsRow } from "@/lib/match-center/types";

export function expectedValue(
  modelProbability: number,
  decimalOdds: number | null | undefined,
): number | null {
  if (
    decimalOdds == null ||
    !Number.isFinite(decimalOdds) ||
    decimalOdds <= 1 ||
    !Number.isFinite(modelProbability) ||
    modelProbability <= 0
  ) {
    return null;
  }
  return modelProbability * decimalOdds - 1;
}

function selectionProbability(
  quote: ApexOddsQuote,
  key: string,
  oneXTwo: OutcomeProbability,
  over25: { over: number; under: number },
  btts: BothTeamsToScoreProbability,
): number | null {
  const normalized = key.toLowerCase();
  if (quote.market === "1x2") {
    if (normalized === "home" || normalized === "1") return oneXTwo.home;
    if (normalized === "away" || normalized === "2") return oneXTwo.away;
    if (normalized === "draw" || normalized === "x") return oneXTwo.draw;
  }
  if (quote.market === "over_under" && (quote.line == null || quote.line === 2.5)) {
    if (normalized.startsWith("over")) return over25.over;
    if (normalized.startsWith("under")) return over25.under;
  }
  if (quote.market === "btts") {
    if (normalized === "yes" || normalized === "si" || normalized === "sí") {
      return btts.yes;
    }
    if (normalized === "no") return btts.no;
  }
  return null;
}

/**
 * Join catalogue odds with model probabilities to produce EV rows.
 * Skips markets the engine does not price (e.g. O/U lines other than 2.5).
 */
export function buildOddsEvRows(input: {
  quotes: ApexOddsQuote[];
  oneXTwo: OutcomeProbability;
  overUnder25: { over: number; under: number };
  btts: BothTeamsToScoreProbability;
}): MatchCenterOddsRow[] {
  const rows: MatchCenterOddsRow[] = [];

  for (const quote of input.quotes) {
    for (const selection of quote.selections) {
      const modelProbability = selectionProbability(
        quote,
        selection.key,
        input.oneXTwo,
        input.overUnder25,
        input.btts,
      );
      const decimalOdds = selection.decimalOdds;
      rows.push({
        id: `${quote.id}:${selection.key}`,
        market: quote.market,
        marketLabel: marketLabel(quote),
        selection: selection.key,
        label: selection.label,
        decimalOdds,
        impliedProbability: selection.impliedProbability,
        modelProbability,
        expectedValue:
          modelProbability == null
            ? null
            : expectedValue(modelProbability, decimalOdds),
        bookmaker: quote.bookmaker,
      });
    }
  }

  return rows;
}

function marketLabel(quote: ApexOddsQuote): string {
  if (quote.market === "1x2") return "1X2";
  if (quote.market === "btts") return "BTTS";
  if (quote.market === "over_under") {
    return quote.line != null ? `O/U ${quote.line}` : "Over/Under";
  }
  return quote.market;
}
