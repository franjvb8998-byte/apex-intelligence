/**
 * Create a canonical prematch decision ticket from published output.
 *
 * Fail closed unless Phase 1A is actionable AND the T-120..T-1 window holds.
 * Durable insert-if-absent is the cross-instance lock. Memory is L1 only.
 */

import {
  evaluatePrematchActionability,
  type InjectedClock,
  type PrematchActionability,
  type PrematchActionabilityReason,
} from "@/lib/prematch-decision/actionability";
import { snapshotPrematchDecisionTicket } from "@/lib/prematch-decision/capture";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import {
  getPrematchDecisionTicketStore,
  type PrematchDecisionTicketStore,
} from "@/lib/prematch-decision/store";
import type {
  PrematchDecisionTicket,
  PrematchPublishedSnapshot,
} from "@/lib/prematch-decision/ticket";
import {
  evaluatePrematchCaptureWindow,
  type PrematchCaptureWindowReason,
} from "@/lib/prematch-decision/window";

export type CreatePrematchDecisionTicketInput = {
  published: PrematchPublishedSnapshot;
  clock?: InjectedClock;
  store?: PrematchDecisionTicketStore;
};

export type CreatePrematchDecisionTicketReason =
  | PrematchActionabilityReason
  | PrematchCaptureWindowReason
  | "TICKET_IDENTITY_MISSING"
  | "DURABLE_STORE_UNAVAILABLE";

export type CreatePrematchDecisionTicketResult =
  | {
      ok: true;
      status: "created";
      ticket: PrematchDecisionTicket;
      actionability: PrematchActionability;
    }
  | {
      ok: true;
      status: "idempotent";
      ticket: PrematchDecisionTicket;
      actionability: PrematchActionability;
    }
  | {
      ok: false;
      status: "rejected";
      ticket: null;
      reason: CreatePrematchDecisionTicketReason;
      actionability: PrematchActionability | null;
    }
  | {
      ok: false;
      status: "durable_unavailable";
      ticket: null;
      reason: "DURABLE_STORE_UNAVAILABLE";
      actionability: PrematchActionability | null;
    };

export async function createPrematchDecisionTicket(
  input: CreatePrematchDecisionTicketInput,
): Promise<CreatePrematchDecisionTicketResult> {
  const actionability = evaluatePrematchActionability({
    vendorStatusShort: input.published.vendorStatusShort,
    kickoffUtc: input.published.kickoffUtc,
    nowUtc: input.clock,
  });

  if (!actionability.isCurrentlyActionable) {
    return {
      ok: false,
      status: "rejected",
      ticket: null,
      reason: actionability.reason,
      actionability,
    };
  }

  const ticketId = prematchDecisionTicketId(input.published.fixtureId);
  if (!ticketId) {
    return {
      ok: false,
      status: "rejected",
      ticket: null,
      reason: "TICKET_IDENTITY_MISSING",
      actionability,
    };
  }

  const window = evaluatePrematchCaptureWindow({
    kickoffUtc: input.published.kickoffUtc,
    nowUtc: input.clock,
  });
  if (!window.inWindow) {
    return {
      ok: false,
      status: "rejected",
      ticket: null,
      reason: window.reason,
      actionability,
    };
  }

  const store = input.store ?? getPrematchDecisionTicketStore();
  const existing = await store.confirmDurableByTicketId(ticketId);
  if (existing.confirmed) {
    return {
      ok: true,
      status: "idempotent",
      ticket: existing.ticket,
      actionability,
    };
  }
  if (existing.reason === "DURABLE_STORE_UNAVAILABLE") {
    return {
      ok: false,
      status: "durable_unavailable",
      ticket: null,
      reason: "DURABLE_STORE_UNAVAILABLE",
      actionability,
    };
  }

  const snapshot = snapshotPrematchDecisionTicket(
    input.published,
    actionability,
  );
  const inserted = await store.insertIfAbsent(snapshot);
  if (inserted.unavailable || !inserted.ticket || !inserted.durable) {
    return {
      ok: false,
      status: "durable_unavailable",
      ticket: null,
      reason: "DURABLE_STORE_UNAVAILABLE",
      actionability,
    };
  }
  return {
    ok: true,
    status: inserted.created ? "created" : "idempotent",
    ticket: inserted.ticket,
    actionability,
  };
}

export async function lookupPrematchDecisionTicket(
  fixtureId: string,
  store?: PrematchDecisionTicketStore,
): Promise<PrematchDecisionTicket | null> {
  return (store ?? getPrematchDecisionTicketStore()).getByFixtureId(fixtureId);
}
