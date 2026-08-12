import type {
  MarketQuote,
  OutcomeProbability,
  SystemPrediction,
  UUID,
  ValueSignal,
} from "@/lib/intelligence/types";

/**
 * Markets module — odds ingestion, implied probabilities, and value detection.
 * Algorithms intentionally unimplemented.
 */
export interface MarketsModule {
  /** Convert decimal odds to implied probabilities (pre-normalization). */
  impliedFromOdds(odds: OutcomeProbability): OutcomeProbability;

  /** Remove bookmaker overround / vig. */
  removeOverround(implied: OutcomeProbability): OutcomeProbability;

  /** Compare model prediction against latest market quotes. */
  detectValue(
    prediction: SystemPrediction,
    quotes: MarketQuote[],
  ): ValueSignal[];

  /** Fetch latest quotes for a match (adapter-backed). */
  getQuotes(matchId: UUID): Promise<MarketQuote[]>;
}
