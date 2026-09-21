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

export type PrematchDecisionTicketStore = {
  getByTicketId(ticketId: string): Promise<PrematchDecisionTicket | null>;
  getByFixtureId(fixtureId: string): Promise<PrematchDecisionTicket | null>;
  insertIfAbsent(ticket: PrematchDecisionTicket): Promise<PrematchTicketInsertResult>;
  clear(): void;
};

export type PrematchDecisionTicketDurableBackend = {
  getByTicketId(ticketId: string): Promise<
    | { ok: true; ticket: PrematchDecisionTicket | null }
    | { ok: false; unavailable: true }
  >;
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

  async insertIfAbsent(
    ticket: PrematchDecisionTicket,
  ): Promise<PrematchTicketInsertResult> {
    const written = await this.durable.insertIfAbsent(ticket);
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

export function resetPrematchDecisionTicketStoreForTests(): void {
  processMemory?.clear();
  processStore = null;
  processMemory = null;
}
