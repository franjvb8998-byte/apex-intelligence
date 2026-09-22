/**
 * Postgres/Supabase backend for immutable final fixture evidence.
 * Service-role server writes only. Never expose that key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FinalFixtureEvidenceDurableBackend } from "@/lib/final-evidence/store";
import type { FinalFixtureEvidence } from "@/lib/final-evidence/types";

export const FIXTURE_FINAL_EVIDENCE_TABLE = "fixture_final_evidence";

type EvidenceRow = {
  evidence_id: string;
  fixture_id: string;
  ticket_id: string | null;
  schema_version: string;
  observation_revision: number;
  observed_at_utc: string;
  source: string;
  vendor_status_short: string;
  payload: FinalFixtureEvidence;
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

function asEvidence(payload: unknown): FinalFixtureEvidence | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as FinalFixtureEvidence;
  if (!row.evidenceId || !row.fixtureId || !row.schemaVersion) return null;
  return row;
}

function toRow(evidence: FinalFixtureEvidence): EvidenceRow {
  return {
    evidence_id: evidence.evidenceId,
    fixture_id: evidence.fixtureId,
    ticket_id: evidence.ticketId,
    schema_version: evidence.schemaVersion,
    observation_revision: evidence.observationRevision,
    observed_at_utc: evidence.observedAtUtc,
    source: evidence.source,
    vendor_status_short: evidence.vendorStatusShort,
    payload: evidence,
    created_at: evidence.observedAtUtc,
  };
}

export class PostgresFinalFixtureEvidenceBackend
  implements FinalFixtureEvidenceDurableBackend
{
  constructor(private readonly clientFactory = serviceRoleClient) {}

  async getByEvidenceId(
    evidenceId: string,
  ): Promise<
    | { ok: true; evidence: FinalFixtureEvidence | null }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { data, error } = await client
        .from(FIXTURE_FINAL_EVIDENCE_TABLE)
        .select("payload")
        .eq("evidence_id", evidenceId)
        .maybeSingle();
      if (error) return { ok: false, unavailable: true };
      return { ok: true, evidence: asEvidence(data?.payload) };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async listByFixtureId(
    fixtureId: string,
  ): Promise<
    | { ok: true; rows: FinalFixtureEvidence[] }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { data, error } = await client
        .from(FIXTURE_FINAL_EVIDENCE_TABLE)
        .select("payload")
        .eq("fixture_id", fixtureId)
        .order("observation_revision", { ascending: true });
      if (error) return { ok: false, unavailable: true };
      return {
        ok: true,
        rows: (data ?? [])
          .map((row) => asEvidence(row.payload))
          .filter((row): row is FinalFixtureEvidence => row != null),
      };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async insertIfAbsent(
    evidence: FinalFixtureEvidence,
  ): Promise<
    | { ok: true; created: boolean; evidence: FinalFixtureEvidence }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { error } = await client
        .from(FIXTURE_FINAL_EVIDENCE_TABLE)
        .insert(toRow(evidence));
      if (!error) {
        return { ok: true, created: true, evidence };
      }
      if (error.code !== UNIQUE_VIOLATION) {
        return { ok: false, unavailable: true };
      }
      const existing = await this.getByEvidenceId(evidence.evidenceId);
      if (!existing.ok) return { ok: false, unavailable: true };
      if (!existing.evidence) return { ok: false, unavailable: true };
      return { ok: true, created: false, evidence: existing.evidence };
    } catch {
      return { ok: false, unavailable: true };
    }
  }
}

export function createPostgresFinalFixtureEvidenceBackend(): PostgresFinalFixtureEvidenceBackend {
  return new PostgresFinalFixtureEvidenceBackend();
}
