/**
 * Testable prematch ticket repository.
 *
 * Process memory is L1 only. Historical truth is the durable backend
 * (Postgres when configured). Never UPDATE a stored ticket.
 */

import { clonePrematchDecisionTicket } from "@/lib/prematch-decision/serialize";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import { prematchDecisionTicketId } from "@/lib/prematch-decision/identity";
import { createPostgresPrematchDecisionTicketBackend } from "@/lib/prematch-decision/durable-postgres";

export type PrematchTicketInsertResult = {
  ticket: PrematchDecisionTicket | null;
  created: boolean;
  durable: boolean;
  unavailable: boolean;
};

export type DurableTicketProof =
  | {
      confirmed: true;
      source: "durable_insert" | "durable_read";
      ticket: PrematchDecisionTicket;
    }
  | {
      confirmed: false;
      reason: "DURABLE_STORE_UNAVAILABLE" | "MISSING";
      ticket: null;
    };

export type PrematchTicketListResult =
  | { ok: true; tickets: PrematchDecisionTicket[] }
  | { ok: false; unavailable: true };

export type PrematchTicketListCursor = {
  kickoffUtc: string;
  ticketId: string;
};

export type PrematchDecisionTicketStore = {
  getByTicketId(ticketId: string): Promise<PrematchDecisionTicket | null>;
  getByFixtureId(fixtureId: string): Promise<PrematchDecisionTicket | null>;
  confirmDurableByTicketId(ticketId: string): Promise<DurableTicketProof>;
  listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit?: number,
    after?: PrematchTicketListCursor | null,
  ): Promise<PrematchTicketListResult>;
  insertIfAbsent(ticket: PrematchDecisionTicket): Promise<PrematchTicketInsertResult>;
  clear(): void;
};

export type PrematchDecisionTicketDurableBackend = {
  getByTicketId(ticketId: string): Promise<
    | { ok: true; ticket: PrematchDecisionTicket | null }
    | { ok: false; unavailable: true }
  >;
  listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit?: number,
    after?: PrematchTicketListCursor | null,
  ): Promise<PrematchTicketListResult>;
  insertIfAbsent(ticket: PrematchDecisionTicket): Promise<
    | { ok: true; created: boolean; ticket: PrematchDecisionTicket }
    | { ok: false; unavailable: true }
  >;
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as object)) {
      deepFreeze(child);
    }
  }
  return value;
}

function freezeTicket(ticket: PrematchDecisionTicket): PrematchDecisionTicket {
  return deepFreeze(clonePrematchDecisionTicket(ticket));
}

export function comparePrematchTicketListCursor(
  left: { kickoffUtc: string; ticketId: string },
  right: { kickoffUtc: string; ticketId: string },
): number {
  return (
    left.kickoffUtc.localeCompare(right.kickoffUtc) ||
    left.ticketId.localeCompare(right.ticketId)
  );
}

function ticketsInKickoffRange(
  rows: Iterable<PrematchDecisionTicket>,
  fromUtc: string,
  toUtc: string,
  limit = 500,
  after?: PrematchTicketListCursor | null,
): PrematchDecisionTicket[] {
  const from = Date.parse(fromUtc);
  const to = Date.parse(toUtc);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    return [];
  }
  const matched = [...rows].filter((ticket) => {
    const kickoff = Date.parse(ticket.kickoffUtc);
    if (!Number.isFinite(kickoff) || kickoff < from || kickoff > to) {
      return false;
    }
    if (!after) return true;
    return comparePrematchTicketListCursor(ticket, after) > 0;
  });
  matched.sort(comparePrematchTicketListCursor);
  return matched.slice(0, Math.max(0, limit));
}

export class InMemoryPrematchDecisionTicketStore
  implements PrematchDecisionTicketStore
{
  private readonly rows = new Map<string, PrematchDecisionTicket>();

  async getByTicketId(ticketId: string): Promise<PrematchDecisionTicket | null> {
    return this.rows.get(ticketId) ?? null;
  }

  async getByFixtureId(fixtureId: string): Promise<PrematchDecisionTicket | null> {
    const ticketId = prematchDecisionTicketId(fixtureId);
    if (!ticketId) return null;
    return this.getByTicketId(ticketId);
  }

  async confirmDurableByTicketId(ticketId: string): Promise<DurableTicketProof> {
    const ticket = this.rows.get(ticketId) ?? null;
    if (!ticket) {
      return { confirmed: false, reason: "MISSING", ticket: null };
    }
    return { confirmed: true, source: "durable_read", ticket };
  }

  async listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit?: number,
    after?: PrematchTicketListCursor | null,
  ): Promise<PrematchTicketListResult> {
    return {
      ok: true,
      tickets: ticketsInKickoffRange(
        this.rows.values(),
        fromUtc,
        toUtc,
        limit,
        after,
      ),
    };
  }

  hydrate(ticket: PrematchDecisionTicket): PrematchDecisionTicket {
    const frozen = freezeTicket(ticket);
    this.rows.set(frozen.ticketId, frozen);
    return frozen;
  }

  async insertIfAbsent(
    ticket: PrematchDecisionTicket,
  ): Promise<PrematchTicketInsertResult> {
    const existing = this.rows.get(ticket.ticketId);
    if (existing) {
      return {
        ticket: existing,
        created: false,
        durable: true,
        unavailable: false,
      };
    }
    const frozen = this.hydrate(ticket);
    return {
      ticket: frozen,
      created: true,
      durable: true,
      unavailable: false,
    };
  }

  clear(): void {
    this.rows.clear();
  }
}

export class LayeredPrematchDecisionTicketStore
  implements PrematchDecisionTicketStore
{
  constructor(
    private readonly memory: InMemoryPrematchDecisionTicketStore,
    private readonly durable: PrematchDecisionTicketDurableBackend,
  ) {}

  async getByTicketId(ticketId: string): Promise<PrematchDecisionTicket | null> {
    const cached = await this.memory.getByTicketId(ticketId);
    if (cached) return cached;
    const remote = await this.durable.getByTicketId(ticketId);
    if (!remote.ok) return null;
    if (!remote.ticket) return null;
    return this.memory.hydrate(remote.ticket);
  }

  async getByFixtureId(fixtureId: string): Promise<PrematchDecisionTicket | null> {
    const ticketId = prematchDecisionTicketId(fixtureId);
    if (!ticketId) return null;
    return this.getByTicketId(ticketId);
  }

  async confirmDurableByTicketId(ticketId: string): Promise<DurableTicketProof> {
    try {
      const remote = await this.durable.getByTicketId(ticketId);
      if (!remote.ok) {
        return { confirmed: false, reason: "DURABLE_STORE_UNAVAILABLE", ticket: null };
      }
      if (!remote.ticket) {
        return { confirmed: false, reason: "MISSING", ticket: null };
      }
      return {
        confirmed: true,
        source: "durable_read",
        ticket: this.memory.hydrate(remote.ticket),
      };
    } catch {
      return { confirmed: false, reason: "DURABLE_STORE_UNAVAILABLE", ticket: null };
    }
  }

  async listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit?: number,
    after?: PrematchTicketListCursor | null,
  ): Promise<PrematchTicketListResult> {
    try {
      const remote = await this.durable.listByKickoffRange(
        fromUtc,
        toUtc,
        limit,
        after,
      );
      if (!remote.ok) return { ok: false, unavailable: true };
      return {
        ok: true,
        tickets: remote.tickets.map((ticket) => this.memory.hydrate(ticket)),
      };
    } catch {
      return { ok: false, unavailable: true };
    }
  }

  async insertIfAbsent(
    ticket: PrematchDecisionTicket,
  ): Promise<PrematchTicketInsertResult> {
    let written: Awaited<
      ReturnType<PrematchDecisionTicketDurableBackend["insertIfAbsent"]>
    >;
    try {
      written = await this.durable.insertIfAbsent(ticket);
    } catch {
      return {
        ticket: null,
        created: false,
        durable: false,
        unavailable: true,
      };
    }
    if (!written.ok) {
      return {
        ticket: null,
        created: false,
        durable: false,
        unavailable: true,
      };
    }
    const frozen = this.memory.hydrate(written.ticket);
    return {
      ticket: frozen,
      created: written.created,
      durable: true,
      unavailable: false,
    };
  }

  clear(): void {
    this.memory.clear();
  }
}

export class InMemoryPrematchDecisionTicketBackend
  implements PrematchDecisionTicketDurableBackend
{
  constructor(
    private readonly inner = new InMemoryPrematchDecisionTicketStore(),
  ) {}

  store(): InMemoryPrematchDecisionTicketStore {
    return this.inner;
  }

  async getByTicketId(
    ticketId: string,
  ): Promise<
    | { ok: true; ticket: PrematchDecisionTicket | null }
    | { ok: false; unavailable: true }
  > {
    return { ok: true, ticket: await this.inner.getByTicketId(ticketId) };
  }

  async listByKickoffRange(
    fromUtc: string,
    toUtc: string,
    limit?: number,
    after?: PrematchTicketListCursor | null,
  ): Promise<PrematchTicketListResult> {
    return this.inner.listByKickoffRange(fromUtc, toUtc, limit, after);
  }

  async insertIfAbsent(
    ticket: PrematchDecisionTicket,
  ): Promise<
    | { ok: true; created: boolean; ticket: PrematchDecisionTicket }
    | { ok: false; unavailable: true }
  > {
    const inserted = await this.inner.insertIfAbsent(ticket);
    if (!inserted.ticket) {
      return { ok: false, unavailable: true };
    }
    return {
      ok: true,
      created: inserted.created,
      ticket: inserted.ticket,
    };
  }
}

export class UnavailablePrematchDecisionTicketBackend
  implements PrematchDecisionTicketDurableBackend
{
  async getByTicketId(): Promise<{ ok: false; unavailable: true }> {
    return { ok: false, unavailable: true };
  }

  async listByKickoffRange(): Promise<{ ok: false; unavailable: true }> {
    return { ok: false, unavailable: true };
  }

  async insertIfAbsent(): Promise<{ ok: false; unavailable: true }> {
    return { ok: false, unavailable: true };
  }
}

let processMemory: InMemoryPrematchDecisionTicketStore | null = null;
let processStore: PrematchDecisionTicketStore | null = null;
let processDurableFactory: () => PrematchDecisionTicketDurableBackend =
  createPostgresPrematchDecisionTicketBackend;

function ensureProcessStore(): PrematchDecisionTicketStore {
  if (processStore) return processStore;
  processMemory = new InMemoryPrematchDecisionTicketStore();
  processStore = new LayeredPrematchDecisionTicketStore(
    processMemory,
    processDurableFactory(),
  );
  return processStore;
}

export function setPrematchDecisionDurableBackendFactory(
  factory: () => PrematchDecisionTicketDurableBackend,
): void {
  processDurableFactory = factory;
  processStore = null;
  processMemory = null;
}

export function getPrematchDecisionTicketStore(): PrematchDecisionTicketStore {
  return ensureProcessStore();
}

export async function confirmDurableByFixtureId(
  store: PrematchDecisionTicketStore,
  fixtureId: string,
): Promise<DurableTicketProof> {
  const ticketId = prematchDecisionTicketId(fixtureId);
  if (!ticketId) {
    return { confirmed: false, reason: "MISSING", ticket: null };
  }
  return store.confirmDurableByTicketId(ticketId);
}

export function resetPrematchDecisionTicketStoreForTests(): void {
  processMemory?.clear();
  processStore = null;
  processMemory = null;
}
