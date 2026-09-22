/**
 * Regulation-time settlement for published prematch markets.
 * Policy: apex.settlement.regulation-90.v1
 * Extra time and shootouts never settle 1X2 / O/U 2.5 / BTTS.
 */

import {
  isValidGoalCount,
} from "@/lib/final-evidence/finalization";
import type { FinalFixtureEvidence } from "@/lib/final-evidence/types";
import {
  brierOneXTwo,
  logLoss,
  logLossOneXTwo,
  probabilityOnOutcome,
  twoClassBrier,
} from "@/lib/prematch-evaluation/metrics";
import {
  SETTLEMENT_POLICY_REGULATION_90_V1,
  type FrozenMarket,
  type MarketEvaluationRow,
  type MarketSettlementAdapter,
  type SettlementPolicyVersion,
  type SettlementScore,
} from "@/lib/prematch-evaluation/types";

export function regulationSettlementScore(
  evidence: FinalFixtureEvidence,
): SettlementScore | null {
  if (
    !isValidGoalCount(evidence.fulltimeHome) ||
    !isValidGoalCount(evidence.fulltimeAway)
  ) {
    return null;
  }
  return { home: evidence.fulltimeHome, away: evidence.fulltimeAway };
}

export function settleOneXTwoFromScore(score: SettlementScore): "home" | "draw" | "away" {
  if (score.home > score.away) return "home";
  if (score.away > score.home) return "away";
  return "draw";
}

export function settleOverUnder25(score: SettlementScore): "over" | "under" {
  return score.home + score.away > 2.5 ? "over" : "under";
}

export function settleBtts(score: SettlementScore): "yes" | "no" {
  return score.home >= 1 && score.away >= 1 ? "yes" : "no";
}

function selectionProbability(
  market: FrozenMarket,
  selectionId: string,
): number | null {
  const row = market.selections.find((item) => item.selectionId === selectionId);
  if (!row || !Number.isFinite(row.modelProbability)) return null;
  return row.modelProbability;
}

function argmaxSelection(market: FrozenMarket): string | null {
  let best: { selectionId: string; modelProbability: number } | null = null;
  for (const row of market.selections) {
    if (!Number.isFinite(row.modelProbability)) continue;
    if (!best || row.modelProbability > best.modelProbability) {
      best = row;
    }
  }
  return best?.selectionId ?? null;
}

const oneXTwoAdapter: MarketSettlementAdapter = {
  marketId: "1x2",
  settle(market, score) {
    const realized = settleOneXTwoFromScore(score);
    const home = selectionProbability(market, "home");
    const draw = selectionProbability(market, "draw");
    const away = selectionProbability(market, "away");
    if (home == null || draw == null || away == null) {
      return {
        marketId: "1x2",
        marketLine: market.marketLine,
        realizedSelection: realized,
        probabilityAssignedToRealizedOutcome: null,
        logLoss: null,
        brierScore: null,
        hit: null,
        voidReason: "missing_1x2_probabilities",
      };
    }
    const predicted = { home, draw, away };
    return {
      marketId: "1x2",
      marketLine: market.marketLine,
      realizedSelection: realized,
      probabilityAssignedToRealizedOutcome: probabilityOnOutcome(
        predicted,
        realized,
      ),
      logLoss: logLossOneXTwo(predicted, realized),
      brierScore: brierOneXTwo(predicted, realized),
      hit: argmaxSelection(market) === realized,
      voidReason: null,
    };
  },
};

const overUnderAdapter: MarketSettlementAdapter = {
  marketId: "over_under",
  settle(market, score) {
    if (market.marketLine !== 2.5) {
      return {
        marketId: market.marketId,
        marketLine: market.marketLine,
        realizedSelection: null,
        probabilityAssignedToRealizedOutcome: null,
        logLoss: null,
        brierScore: null,
        hit: null,
        voidReason: "unsupported_market_line",
      };
    }
    const realized = settleOverUnder25(score);
    const probability = selectionProbability(market, realized);
    const over = selectionProbability(market, "over");
    if (probability == null) {
      return {
        marketId: "over_under",
        marketLine: 2.5,
        realizedSelection: realized,
        probabilityAssignedToRealizedOutcome: null,
        logLoss: null,
        brierScore: null,
        hit: null,
        voidReason: "missing_over_under_probability",
      };
    }
    return {
      marketId: "over_under",
      marketLine: 2.5,
      realizedSelection: realized,
      probabilityAssignedToRealizedOutcome: probability,
      logLoss: logLoss(probability),
      brierScore:
        over != null ? twoClassBrier(over, realized === "over") : null,
      hit: argmaxSelection(market) === realized,
      voidReason: null,
    };
  },
};

const bttsAdapter: MarketSettlementAdapter = {
  marketId: "btts",
  settle(market, score) {
    const realized = settleBtts(score);
    const probability = selectionProbability(market, realized);
    const yes = selectionProbability(market, "yes");
    if (probability == null) {
      return {
        marketId: "btts",
        marketLine: market.marketLine,
        realizedSelection: realized,
        probabilityAssignedToRealizedOutcome: null,
        logLoss: null,
        brierScore: null,
        hit: null,
        voidReason: "missing_btts_probability",
      };
    }
    return {
      marketId: "btts",
      marketLine: market.marketLine,
      realizedSelection: realized,
      probabilityAssignedToRealizedOutcome: probability,
      logLoss: logLoss(probability),
      brierScore: yes != null ? twoClassBrier(yes, realized === "yes") : null,
      hit: argmaxSelection(market) === realized,
      voidReason: null,
    };
  },
};

const builtIn = new Map<string, MarketSettlementAdapter>([
  [oneXTwoAdapter.marketId, oneXTwoAdapter],
  [overUnderAdapter.marketId, overUnderAdapter],
  [bttsAdapter.marketId, bttsAdapter],
]);

const extra = new Map<string, MarketSettlementAdapter>();

export function registerMarketSettlementAdapter(
  adapter: MarketSettlementAdapter,
): void {
  extra.set(adapter.marketId, adapter);
}

export function resetMarketSettlementAdaptersForTests(): void {
  extra.clear();
}

export function settleMarket(
  market: FrozenMarket,
  evidence: FinalFixtureEvidence,
  policy: SettlementPolicyVersion = SETTLEMENT_POLICY_REGULATION_90_V1,
): MarketEvaluationRow {
  if (policy !== SETTLEMENT_POLICY_REGULATION_90_V1) {
    return {
      marketId: market.marketId,
      marketLine: market.marketLine,
      realizedSelection: null,
      probabilityAssignedToRealizedOutcome: null,
      logLoss: null,
      brierScore: null,
      hit: null,
      voidReason: "unsupported_settlement_policy",
    };
  }
  const score = regulationSettlementScore(evidence);
  if (!score) {
    return {
      marketId: market.marketId,
      marketLine: market.marketLine,
      realizedSelection: null,
      probabilityAssignedToRealizedOutcome: null,
      logLoss: null,
      brierScore: null,
      hit: null,
      voidReason: "rejected_invalid_score",
    };
  }
  const adapter = extra.get(market.marketId) ?? builtIn.get(market.marketId);
  if (!adapter) {
    return {
      marketId: market.marketId,
      marketLine: market.marketLine,
      realizedSelection: null,
      probabilityAssignedToRealizedOutcome: null,
      logLoss: null,
      brierScore: null,
      hit: null,
      voidReason: "no_settlement_adapter",
    };
  }
  return adapter.settle(market, score, policy);
}
