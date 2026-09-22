/**
 * Postgres/Supabase backend for immutable prematch evaluations.
 * Service-role server writes only. Never expose that key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PrematchDecisionEvaluationDurableBackend } from "@/lib/prematch-evaluation/store";
import type { PrematchDecisionEvaluation } from "@/lib/prematch-evaluation/types";

export const PREMATCH_DECISION_EVALUATIONS_TABLE =
  "prematch_decision_evaluations";

type EvaluationRow = {
  evaluation_id: string;
  ticket_id: string;
  fixture_id: string;
  evidence_id: string;
  evidence_revision: number;
  schema_version: string;
  settlement_policy_version: string;
  evaluated_at_utc: string;
  final_status: string;
  evaluation_state: string;
  payload: PrematchDecisionEvaluation;
  created_at: string;
};

const UNIQUE_VIOLATION = "23505";

function serviceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asEvaluation(payload: unknown): PrematchDecisionEvaluation | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as PrematchDecisionEvaluation;
  if (!row.evaluationId || !row.ticketId || !row.schemaVersion) return null;
  return row;
}

function toRow(evaluation: PrematchDecisionEvaluation): EvaluationRow {
  return {
    evaluation_id: evaluation.evaluationId,
    ticket_id: evaluation.ticketId,
    fixture_id: evaluation.fixtureId,
    evidence_id: evaluation.evidenceId,
    evidence_revision: evaluation.evidenceRevision,
    schema_version: evaluation.schemaVersion,
    settlement_policy_version: evaluation.settlementPolicyVersion,
    evaluated_at_utc: evaluation.evaluatedAtUtc,
    final_status: evaluation.finalStatus,
    evaluation_state: evaluation.state,
    payload: evaluation,
    created_at: evaluation.evaluatedAtUtc,
  };
}

export class PostgresPrematchDecisionEvaluationBackend
  implements PrematchDecisionEvaluationDurableBackend
{
  constructor(private readonly clientFactory = serviceRoleClient) {}

  async getByEvaluationId(
    evaluationId: string,
  ): Promise<
    | { ok: true; evaluation: PrematchDecisionEvaluation | null }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { data, error } = await client
        .from(PREMATCH_DECISION_EVALUATIONS_TABLE)
        .select("payload")
        .eq("evaluation_id", evaluationId)
        .maybeSingle();
      if (error) return { ok: false, unavailable: true };
      return { ok: true, evaluation: asEvaluation(data?.payload) };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async insertIfAbsent(
    evaluation: PrematchDecisionEvaluation,
  ): Promise<
    | { ok: true; created: boolean; evaluation: PrematchDecisionEvaluation }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { error } = await client
        .from(PREMATCH_DECISION_EVALUATIONS_TABLE)
        .insert(toRow(evaluation));
      if (!error) {
        return { ok: true, created: true, evaluation };
      }
      if (error.code !== UNIQUE_VIOLATION) {
        return { ok: false, unavailable: true };
      }
      const existing = await this.getByEvaluationId(evaluation.evaluationId);
      if (!existing.ok || !existing.evaluation) {
        return { ok: false, unavailable: true };
      }
      return { ok: true, created: false, evaluation: existing.evaluation };
    } catch {
      return { ok: false, unavailable: true };
    }
  }
}

export function createPostgresPrematchDecisionEvaluationBackend(): PostgresPrematchDecisionEvaluationBackend {
  return new PostgresPrematchDecisionEvaluationBackend();
}
