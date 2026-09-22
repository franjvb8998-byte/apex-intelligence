/**
 * Postgres/Supabase backend for immutable prematch tickets.
 *
 * Trusted writes require a server-only service-role key. If that key is
 * missing, this backend reports unavailable instead of inserting with the
 * anon/browser client. Never expose service-role credentials.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import type { PrematchDecisionTicketDurableBackend } from "@/lib/prematch-decision/store";

export const PREMATCH_DECISION_TICKETS_TABLE = "prematch_decision_tickets";

type TicketRow = {
  ticket_id: string;
  fixture_id: string;
  schema_version: string;
  kickoff_utc: string;
  captured_at_utc: string;
  payload: PrematchDecisionTicket;
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

function asTicket(payload: unknown): PrematchDecisionTicket | null {
  if (!payload || typeof payload !== "object") return null;
  const ticket = payload as PrematchDecisionTicket;
  if (!ticket.ticketId || !ticket.fixtureId || !ticket.schemaVersion) {
    return null;
  }
  return ticket;
}

function toRow(ticket: PrematchDecisionTicket): TicketRow {
  return {
    ticket_id: ticket.ticketId,
    fixture_id: ticket.fixtureId,
    schema_version: ticket.schemaVersion,
    kickoff_utc: ticket.kickoffUtc,
    captured_at_utc: ticket.capturedAtUtc,
    payload: ticket,
    created_at: ticket.capturedAtUtc,
  };
}

export class PostgresPrematchDecisionTicketBackend
  implements PrematchDecisionTicketDurableBackend
{
  constructor(private readonly clientFactory = serviceRoleClient) {}

  async getByTicketId(
    ticketId: string,
  ): Promise<
    | { ok: true; ticket: PrematchDecisionTicket | null }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { data, error } = await client
        .from(PREMATCH_DECISION_TICKETS_TABLE)
        .select("payload")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      if (error) return { ok: false, unavailable: true };
      return { ok: true, ticket: asTicket(data?.payload) };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit = 500,
    after?: { kickoffUtc: string; ticketId: string } | null,
  ): Promise<
    | { ok: true; tickets: PrematchDecisionTicket[] }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    const from = Date.parse(fromUtc);
    const to = Date.parse(toUtc);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      return { ok: true, tickets: [] };
    }
    try {
      let query = client
        .from(PREMATCH_DECISION_TICKETS_TABLE)
        .select("payload")
        .gte("kickoff_utc", new Date(from).toISOString())
        .lte("kickoff_utc", new Date(to).toISOString());
      if (after) {
        const kickoff = JSON.stringify(after.kickoffUtc);
        const ticketId = JSON.stringify(after.ticketId);
        query = query.or(
          `kickoff_utc.gt.${kickoff},and(kickoff_utc.eq.${kickoff},ticket_id.gt.${ticketId})`,
        );
      }
      const { data, error } = await query
        .order("kickoff_utc", { ascending: true })
        .order("ticket_id", { ascending: true })
        .limit(Math.max(0, limit));
      if (error) return { ok: false, unavailable: true };
      return {
        ok: true,
        tickets: (data ?? [])
          .map((row) => asTicket(row.payload))
          .filter((ticket): ticket is PrematchDecisionTicket => ticket != null),
      };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async insertIfAbsent(
    ticket: PrematchDecisionTicket,
  ): Promise<
    | { ok: true; created: boolean; ticket: PrematchDecisionTicket }
    | { ok: false; unavailable: true }
  > {
    const client = this.clientFactory();
    if (!client) return { ok: false, unavailable: true };
    try {
      const { error } = await client
        .from(PREMATCH_DECISION_TICKETS_TABLE)
        .insert(toRow(ticket));
      if (!error) {
        return { ok: true, created: true, ticket };
      }
      if (error.code !== UNIQUE_VIOLATION) {
        return { ok: false, unavailable: true };
      }
      const existing = await this.getByTicketId(ticket.ticketId);
      if (!existing.ok) return { ok: false, unavailable: true };
      if (!existing.ticket) return { ok: false, unavailable: true };
      return { ok: true, created: false, ticket: existing.ticket };
    } catch {
      return { ok: false, unavailable: true };
    }
  }
}

export function createPostgresPrematchDecisionTicketBackend(): PostgresPrematchDecisionTicketBackend {
  return new PostgresPrematchDecisionTicketBackend();
}
