import { PREMATCH_DECISION_EVALUATION_ID_PREFIX } from "@/lib/prematch-evaluation/types";
import type { SettlementPolicyVersion } from "@/lib/prematch-evaluation/types";

export function prematchDecisionEvaluationId(
  ticketId: string | null | undefined,
  policy: SettlementPolicyVersion,
  evidenceRevision: number,
): string | null {
  if (!ticketId || !ticketId.trim()) return null;
  if (!Number.isInteger(evidenceRevision) || evidenceRevision < 1) return null;
  return `${PREMATCH_DECISION_EVALUATION_ID_PREFIX}:${ticketId}:${policy}:${evidenceRevision}`;
}

export function evaluationIdentityKey(
  ticketId: string,
  policy: SettlementPolicyVersion,
  evidenceRevision: number,
): string {
  return `${ticketId}|${policy}|${evidenceRevision}`;
}
