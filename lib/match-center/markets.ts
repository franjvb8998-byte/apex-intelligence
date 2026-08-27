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

function selectionKey(row: MatchCenterOddsRow): string {
  return `${row.market}:${row.marketLabel}:${row.selection.toLowerCase()}`;
}

function markBestOdds(rows: MatchCenterOddsRow[]): MatchCenterOddsRow[] {
  const best = new Map<string, number>();
  for (const row of rows) {
    if (row.decimalOdds == null || !Number.isFinite(row.decimalOdds)) continue;
    const key = selectionKey(row);
    const current = best.get(key);
    if (current == null || row.decimalOdds > current) {
      best.set(key, row.decimalOdds);
    }
  }
  return rows.map((row) => ({
    ...row,
    isBest:
      row.decimalOdds != null &&
      Number.isFinite(row.decimalOdds) &&
      best.get(selectionKey(row)) === row.decimalOdds,
  }));
}

/**
 * Join catalogue odds with model probabilities to produce EV rows.
 * Skips markets the engine does not price (e.g. O/U lines other than 2.5).
 * Marks the highest decimal price per selection across bookmakers.
 */
export function buildOddsEvRows(input: {
  quotes: ApexOddsQuote[];
  oneXTwo: OutcomeProbability;
  overUnder25: { over: number; under: number };
  btts: BothTeamsToScoreProbability;
}): MatchCenterOddsRow[] {
  const rows: MatchCenterOddsRow[] = [];

  for (const quote of input.quotes) {
    if (quote.market === "over_under" && quote.line != null && quote.line !== 2.5) {
      continue;
    }
    if (quote.market === "other") continue;

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
        isBest: false,
      });
    }
  }

  return markBestOdds(rows);
}

export type PreMatchOddsBoard = {
  oneXTwo: MatchCenterOddsRow[];
  overUnder25: MatchCenterOddsRow[];
  btts: MatchCenterOddsRow[];
  bookmakerCount: number;
};

function pickBest(
  rows: MatchCenterOddsRow[],
  market: MatchCenterOddsRow["market"],
  keys: string[],
): MatchCenterOddsRow[] {
  const best = rows.filter((row) => row.market === market && row.isBest);
  return keys.flatMap((key) => {
    const match = best.find((row) => row.selection.toLowerCase() === key);
    return match ? [match] : [];
  });
}

/**
 * Compact board: best available price per 1X2 / O/U 2.5 / BTTS selection.
 */
export function preMatchOddsBoard(rows: MatchCenterOddsRow[]): PreMatchOddsBoard {
  const bookmakers = new Set(
    rows.map((row) => row.bookmaker).filter((name): name is string => Boolean(name)),
  );
  return {
    oneXTwo: pickBest(rows, "1x2", ["home", "draw", "away"]),
    overUnder25: pickBest(rows, "over_under", ["over", "under"]),
    btts: pickBest(rows, "btts", ["yes", "no"]),
    bookmakerCount: bookmakers.size,
  };
}

function marketLabel(quote: ApexOddsQuote): string {
  if (quote.market === "1x2") return "1X2";
  if (quote.market === "btts") return "BTTS";
  if (quote.market === "over_under") {
    return quote.line != null ? `O/U ${quote.line}` : "Over/Under";
  }
  return quote.market;
}
