/**
 * Evaluation of a frozen PrematchDecisionTicket against FinalFixtureEvidence.
 * Does not mutate the ticket. Future LiveDecisionSnapshot is a separate type.
 */

import type { PrematchTicketMarketId } from "@/lib/prematch-decision/ticket";

export const PREMATCH_DECISION_EVALUATION_SCHEMA_VERSION = "1.0.0";

export const PREMATCH_DECISION_EVALUATION_ID_PREFIX = "apex:prematch-eval:v1";

export const SETTLEMENT_POLICY_REGULATION_90_V1 =
  "apex.settlement.regulation-90.v1" as const;

export type SettlementPolicyVersion =
  typeof SETTLEMENT_POLICY_REGULATION_90_V1;

export type PrematchEvaluationState =
  | "evaluated"
  | "void_non_scoreable"
  | "rejected_missing_ticket"
  | "rejected_invalid_score"
  | "rejected_not_final"
  | "durable_unavailable";

export type SettlementScore = {
  home: number;
  away: number;
};

export type MarketEvaluationRow = {
  marketId: string;
  marketLine: number | null;
  realizedSelection: string | null;
  probabilityAssignedToRealizedOutcome: number | null;
  logLoss: number | null;
  brierScore: number | null;
  hit: boolean | null;
  voidReason: string | null;
};

export type RecommendationEvaluation = {
  selectionId: string | null;
  selectionLabel: string | null;
  recommendationTier: string | null;
  realizedSelection: string | null;
  hit: boolean | null;
};

export type PrematchDecisionEvaluation = {
  schemaVersion: typeof PREMATCH_DECISION_EVALUATION_SCHEMA_VERSION;
  evaluationId: string;
  ticketId: string;
  fixtureId: string;
  evidenceId: string;
  evidenceRevision: number;
  evaluatedAtUtc: string;
  finalStatus: string;
  settlementPolicyVersion: SettlementPolicyVersion;
  settlementScore: SettlementScore | null;
  markets: MarketEvaluationRow[];
  recommendation: RecommendationEvaluation;
  state: PrematchEvaluationState;
  reason: PrematchEvaluationState;
};

export type FrozenMarket = {
  marketId: PrematchTicketMarketId | string;
  marketLine: number | null;
  selections: Array<{
    selectionId: string;
    modelProbability: number;
  }>;
};

export type MarketSettlementAdapter = {
  marketId: string;
  settle(
    market: FrozenMarket,
    score: SettlementScore,
    policy: SettlementPolicyVersion,
  ): MarketEvaluationRow;
};

export type EvaluatePrematchDecisionResult =
  | {
      ok: true;
      created: boolean;
      state: "evaluated";
      evaluation: PrematchDecisionEvaluation;
    }
  | {
      ok: false;
      state: PrematchEvaluationState;
      evaluation: PrematchDecisionEvaluation | null;
    };

export type HistoricalPrematchView = {
  label: "HISTORICAL_PREMATCH_SNAPSHOT";
  currentlyActionable: false;
  showCurrentRecommendation: false;
  defaultRevisionPolicy: "original_revision_1";
  snapshot: import("@/lib/prematch-decision/ticket").PrematchDecisionTicket | null;
  actualResult: import("@/lib/final-evidence/types").FinalFixtureEvidence | null;
  evaluation: PrematchDecisionEvaluation | null;
};
