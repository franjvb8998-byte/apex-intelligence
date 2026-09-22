/**
 * Build an immutable PrematchDecisionEvaluation from a frozen ticket + evidence.
 * Never calls PE. Never mutates the ticket.
 */

import type { FinalFixtureEvidence } from "@/lib/final-evidence/types";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import { prematchDecisionEvaluationId } from "@/lib/prematch-evaluation/identity";
import {
  regulationSettlementScore,
  settleMarket,
  settleOneXTwoFromScore,
} from "@/lib/prematch-evaluation/settlement";
import {
  PREMATCH_DECISION_EVALUATION_SCHEMA_VERSION,
  SETTLEMENT_POLICY_REGULATION_90_V1,
  type FrozenMarket,
  type PrematchDecisionEvaluation,
  type PrematchEvaluationState,
} from "@/lib/prematch-evaluation/types";

function groupFrozenMarkets(ticket: PrematchDecisionTicket): FrozenMarket[] {
  const groups = new Map<string, FrozenMarket>();
  for (const row of ticket.selections) {
    const key = `${row.marketId}:${row.marketLine ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.selections.push({
        selectionId: row.selectionId,
        modelProbability: row.modelProbability,
      });
      continue;
    }
    groups.set(key, {
      marketId: row.marketId,
      marketLine: row.marketLine,
      selections: [
        {
          selectionId: row.selectionId,
          modelProbability: row.modelProbability,
        },
      ],
    });
  }
  return [...groups.values()];
}

export function buildPrematchDecisionEvaluation(input: {
  ticket: PrematchDecisionTicket;
  evidence: FinalFixtureEvidence;
  clock?: string;
  state?: PrematchEvaluationState;
}): PrematchDecisionEvaluation | null {
  const policy = SETTLEMENT_POLICY_REGULATION_90_V1;
  const evaluationId = prematchDecisionEvaluationId(
    input.ticket.ticketId,
    policy,
    input.evidence.observationRevision,
  );
  if (!evaluationId) return null;

  const state = input.state ?? "evaluated";
  const score =
    state === "evaluated" ? regulationSettlementScore(input.evidence) : null;
  const realized = score ? settleOneXTwoFromScore(score) : null;
  const markets =
    state === "evaluated"
      ? groupFrozenMarkets(input.ticket).map((market) =>
          settleMarket(market, input.evidence, policy),
        )
      : [];

  return {
    schemaVersion: PREMATCH_DECISION_EVALUATION_SCHEMA_VERSION,
    evaluationId,
    ticketId: input.ticket.ticketId,
    fixtureId: input.ticket.fixtureId,
    evidenceId: input.evidence.evidenceId,
    evidenceRevision: input.evidence.observationRevision,
    evaluatedAtUtc: input.clock ?? new Date().toISOString(),
    finalStatus: input.evidence.vendorStatusShort,
    settlementPolicyVersion: policy,
    settlementScore: score,
    markets,
    recommendation: {
      selectionId: input.ticket.scoring?.selectionId ?? null,
      selectionLabel: input.ticket.scoring?.selectionLabel ?? null,
      recommendationTier: input.ticket.scoring?.recommendationTier ?? null,
      realizedSelection: realized,
      hit:
        realized != null && input.ticket.scoring?.selectionId != null
          ? input.ticket.scoring.selectionId === realized
          : null,
    },
    state,
    reason: state,
  };
}
