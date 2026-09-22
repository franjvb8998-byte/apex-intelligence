/**
 * Historical product read model.
 * Snapshot = ticket only. Result = evidence only. Evaluation = evaluation only.
 * Default view uses original revision 1. Later revisions coexist and are not
 * silently promoted.
 */

import type { FinalFixtureEvidence } from "@/lib/final-evidence/types";
import type { FinalFixtureEvidenceStore } from "@/lib/final-evidence/store";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import type { PrematchDecisionTicketStore } from "@/lib/prematch-decision/store";
import { SETTLEMENT_POLICY_REGULATION_90_V1 } from "@/lib/prematch-evaluation/types";
import type { HistoricalPrematchView } from "@/lib/prematch-evaluation/types";
import type { PrematchDecisionEvaluationStore } from "@/lib/prematch-evaluation/store";

export const HISTORICAL_PREMATCH_LABEL = "HISTORICAL_PREMATCH_SNAPSHOT" as const;

export const ORIGINAL_EVALUATION_REVISION_POLICY = "original_revision_1" as const;

export function buildHistoricalPrematchView(input: {
  ticket?: PrematchDecisionTicket | null;
  evidence?: FinalFixtureEvidence | null;
  evaluation?: import("@/lib/prematch-evaluation/types").PrematchDecisionEvaluation | null;
}): HistoricalPrematchView {
  return {
    label: HISTORICAL_PREMATCH_LABEL,
    currentlyActionable: false,
    showCurrentRecommendation: false,
    defaultRevisionPolicy: ORIGINAL_EVALUATION_REVISION_POLICY,
    snapshot: input.ticket ?? null,
    actualResult: input.evidence ?? null,
    evaluation: input.evaluation ?? null,
  };
}

export async function loadHistoricalPrematchView(
  fixtureId: string,
  stores: {
    ticketStore: PrematchDecisionTicketStore;
    evidenceStore: FinalFixtureEvidenceStore;
    evaluationStore: PrematchDecisionEvaluationStore;
  },
): Promise<HistoricalPrematchView> {
  const ticket = await stores.ticketStore.getByFixtureId(fixtureId);
  const evidence = await stores.evidenceStore.getCanonicalByFixtureId(fixtureId);
  const evaluation =
    ticket && evidence
      ? await stores.evaluationStore.getByIdentity(
          ticket.ticketId,
          SETTLEMENT_POLICY_REGULATION_90_V1,
          1,
        )
      : null;
  return buildHistoricalPrematchView({ ticket, evidence, evaluation });
}
