import type { IntelligenceLearningStore } from "@/lib/intelligence-learning/contracts";
import { round4 } from "@/lib/intelligence-learning/math";
import type {
  RecommendationRecord,
  ResultRecord,
  SettlementInput,
} from "@/lib/intelligence-learning/types";

const ACTIONABLE = new Set(["Elite", "Strong Bet", "Value Bet"]);

export function selectionHitFromOutcome(
  rec: RecommendationRecord,
  marketOutcome: string,
): boolean {
  if (rec.market === "combo") {
    return marketOutcome === "hit";
  }
  return rec.predicted === marketOutcome;
}

export function recommendationWasCorrect(
  rec: RecommendationRecord,
  selectionHit: boolean,
): boolean {
  if (ACTIONABLE.has(rec.recommendation)) return selectionHit;
  return !selectionHit;
}

export function buildResultRecord(
  rec: RecommendationRecord,
  input: SettlementInput,
): ResultRecord {
  const selectionHit = selectionHitFromOutcome(rec, input.marketOutcome);
  const win = selectionHit;
  const odds = rec.odds != null && rec.odds > 1 ? rec.odds : null;
  const stake = 1;
  const payout = win && odds != null ? round4(odds * stake) : 0;
  const roi =
    odds == null && !win ? -1 : odds == null && win ? null : round4(payout - stake);
  const evRealized = roi;
  const sizedStake = round4((rec.stakePct || 0) / 100);
  const sizedPayout =
    win && odds != null ? round4(odds * (sizedStake || 0)) : 0;
  const sizedRoi =
    sizedStake > 0 ? round4((sizedPayout - sizedStake) / sizedStake) : null;

  return {
    recommendationId: rec.id,
    settlementDate: input.settlementDate,
    homeScore: input.homeScore ?? null,
    awayScore: input.awayScore ?? null,
    marketOutcome: input.marketOutcome,
    selectionHit,
    recommendationCorrect: recommendationWasCorrect(rec, selectionHit),
    win,
    loss: !win,
    stake,
    payout,
    roi,
    evRealized,
    sizedStake,
    sizedPayout,
    sizedRoi,
  };
}

export function settleRecommendation(
  store: IntelligenceLearningStore,
  input: SettlementInput,
): ResultRecord {
  const rec = store.getRecommendation(input.recommendationId);
  if (!rec) {
    throw new Error(
      `Cannot settle unknown recommendation ${input.recommendationId}.`,
    );
  }
  const result = buildResultRecord(rec, input);
  store.saveResult(result);
  store.saveRecommendation({ ...rec, status: "settled" });
  return result;
}

export function createResultRegistry(store: IntelligenceLearningStore) {
  return {
    settle(input: SettlementInput): ResultRecord {
      return settleRecommendation(store, input);
    },
    getByRecommendationId(id: string) {
      return store.getResult(id);
    },
    list() {
      return store.listResults();
    },
  };
}
