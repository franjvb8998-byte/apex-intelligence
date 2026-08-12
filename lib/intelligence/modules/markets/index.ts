import type { MarketsModule } from "@/lib/intelligence/contracts";
import type {
  MarketQuote,
  OutcomeProbability,
  SystemPrediction,
  UUID,
  ValueSignal,
} from "@/lib/intelligence/types";

/**
 * Stub — market odds & value detection.
 */
export class MarketsService implements MarketsModule {
  impliedFromOdds(_odds: OutcomeProbability): OutcomeProbability {
    throw new Error("MarketsService.impliedFromOdds is not implemented");
  }

  removeOverround(_implied: OutcomeProbability): OutcomeProbability {
    throw new Error("MarketsService.removeOverround is not implemented");
  }

  detectValue(
    _prediction: SystemPrediction,
    _quotes: MarketQuote[],
  ): ValueSignal[] {
    throw new Error("MarketsService.detectValue is not implemented");
  }

  async getQuotes(_matchId: UUID): Promise<MarketQuote[]> {
    throw new Error("MarketsService.getQuotes is not implemented");
  }
}

export function createMarketsModule(): MarketsModule {
  return new MarketsService();
}
