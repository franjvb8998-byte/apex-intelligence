import type {
  ActualMatchResult,
  LearningCase,
  MarketEvaluation,
  PredictionRecord,
} from "@/lib/learning-engine/types/case";

function brierScore(
  probabilities: PredictionRecord["probabilities"],
  outcome: ActualMatchResult["outcome"],
): number {
  const targets = {
    home: outcome === "home" ? 1 : 0,
    draw: outcome === "draw" ? 1 : 0,
    away: outcome === "away" ? 1 : 0,
  };
  return (
    (probabilities.home - targets.home) ** 2 +
    (probabilities.draw - targets.draw) ** 2 +
    (probabilities.away - targets.away) ** 2
  );
}

function evaluateMarkets(
  prediction: PredictionRecord,
  actual: ActualMatchResult,
): MarketEvaluation[] {
  return prediction.markets.map((market) => {
    const result = actual.marketResults.find((row) => row.market === market.market);
    const winningSelection = result?.winningSelection ?? "unknown";
    return {
      market: market.market,
      selection: market.selection,
      probability: market.probability,
      winningSelection,
      hit: winningSelection !== "unknown" && market.selection === winningSelection,
    };
  });
}

/**
 * Builds a LearningCase from prediction + actual result (pure).
 */
export function buildLearningCase(input: {
  prediction: PredictionRecord;
  actual: ActualMatchResult;
  id?: string;
  recordedAt?: string;
}): LearningCase {
  if (input.prediction.matchId !== input.actual.matchId) {
    throw new Error(
      `Prediction matchId (${input.prediction.matchId}) does not match actual (${input.actual.matchId})`,
    );
  }

  const outcomeCorrect =
    input.prediction.predictedOutcome === input.actual.outcome;
  const winningProb = input.prediction.probabilities[input.actual.outcome];
  const markets = evaluateMarkets(input.prediction, input.actual);

  return {
    id:
      input.id ??
      `case:${input.prediction.id}:${input.actual.finishedAt}`,
    prediction: input.prediction,
    actual: input.actual,
    outcomeCorrect,
    error: {
      outcomeError: outcomeCorrect ? 0 : 1,
      brierScore: brierScore(
        input.prediction.probabilities,
        input.actual.outcome,
      ),
      probabilityResidual: Math.abs(winningProb - 1),
    },
    marketsHit: markets.filter((m) => m.hit),
    marketsMissed: markets.filter((m) => !m.hit),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}
