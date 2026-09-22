/**
 * Testable evaluation repository. L1 + durable first-write-wins.
 * Identity: ticket + settlementPolicyVersion + evidenceRevision.
 * Never UPDATE.
 */

import { createPostgresPrematchDecisionEvaluationBackend } from "@/lib/prematch-evaluation/durable-postgres";
import {
  evaluationIdentityKey,
  prematchDecisionEvaluationId,
} from "@/lib/prematch-evaluation/identity";
import { clonePrematchDecisionEvaluation } from "@/lib/prematch-evaluation/serialize";
import type { PrematchDecisionEvaluation } from "@/lib/prematch-evaluation/types";
import type { SettlementPolicyVersion } from "@/lib/prematch-evaluation/types";

export type EvaluationInsertResult = {
  evaluation: PrematchDecisionEvaluation | null;
  created: boolean;
  durable: boolean;
  unavailable: boolean;
};

export type PrematchDecisionEvaluationStore = {
  getByEvaluationId(
    evaluationId: string,
  ): Promise<PrematchDecisionEvaluation | null>;
  getByIdentity(
    ticketId: string,
    policy: SettlementPolicyVersion,
    evidenceRevision: number,
  ): Promise<PrematchDecisionEvaluation | null>;
  insertIfAbsent(
    evaluation: PrematchDecisionEvaluation,
  ): Promise<EvaluationInsertResult>;
  clear(): void;
};

export type PrematchDecisionEvaluationDurableBackend = {
  getByEvaluationId(evaluationId: string): Promise<
    | { ok: true; evaluation: PrematchDecisionEvaluation | null }
    | { ok: false; unavailable: true }
  >;
  insertIfAbsent(evaluation: PrematchDecisionEvaluation): Promise<
    | { ok: true; created: boolean; evaluation: PrematchDecisionEvaluation }
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

function freezeEvaluation(
  evaluation: PrematchDecisionEvaluation,
): PrematchDecisionEvaluation {
  return deepFreeze(clonePrematchDecisionEvaluation(evaluation));
}

export class InMemoryPrematchDecisionEvaluationStore
  implements PrematchDecisionEvaluationStore
{
  private readonly rows = new Map<string, PrematchDecisionEvaluation>();

  async getByEvaluationId(
    evaluationId: string,
  ): Promise<PrematchDecisionEvaluation | null> {
    return this.rows.get(evaluationId) ?? null;
  }

  async getByIdentity(
    ticketId: string,
    policy: SettlementPolicyVersion,
    evidenceRevision: number,
  ): Promise<PrematchDecisionEvaluation | null> {
    const key = evaluationIdentityKey(ticketId, policy, evidenceRevision);
    for (const row of this.rows.values()) {
      if (
        evaluationIdentityKey(
          row.ticketId,
          row.settlementPolicyVersion,
          row.evidenceRevision,
        ) === key
      ) {
        return row;
      }
    }
    return null;
  }

  hydrate(evaluation: PrematchDecisionEvaluation): PrematchDecisionEvaluation {
    const frozen = freezeEvaluation(evaluation);
    this.rows.set(frozen.evaluationId, frozen);
    return frozen;
  }

  async insertIfAbsent(
    evaluation: PrematchDecisionEvaluation,
  ): Promise<EvaluationInsertResult> {
    const existing = this.rows.get(evaluation.evaluationId);
    if (existing) {
      return {
        evaluation: existing,
        created: false,
        durable: true,
        unavailable: false,
      };
    }
    return {
      evaluation: this.hydrate(evaluation),
      created: true,
      durable: true,
      unavailable: false,
    };
  }

  clear(): void {
    this.rows.clear();
  }
}

export class LayeredPrematchDecisionEvaluationStore
  implements PrematchDecisionEvaluationStore
{
  constructor(
    private readonly memory: InMemoryPrematchDecisionEvaluationStore,
    private readonly durable: PrematchDecisionEvaluationDurableBackend,
  ) {}

  async getByEvaluationId(
    evaluationId: string,
  ): Promise<PrematchDecisionEvaluation | null> {
    const cached = await this.memory.getByEvaluationId(evaluationId);
    if (cached) return cached;
    const remote = await this.durable.getByEvaluationId(evaluationId);
    if (!remote.ok || !remote.evaluation) return null;
    return this.memory.hydrate(remote.evaluation);
  }

  async getByIdentity(
    ticketId: string,
    policy: SettlementPolicyVersion,
    evidenceRevision: number,
  ): Promise<PrematchDecisionEvaluation | null> {
    const cached = await this.memory.getByIdentity(
      ticketId,
      policy,
      evidenceRevision,
    );
    if (cached) return cached;
    const id = prematchDecisionEvaluationId(ticketId, policy, evidenceRevision);
    if (!id) return null;
    return this.getByEvaluationId(id);
  }

  async insertIfAbsent(
    evaluation: PrematchDecisionEvaluation,
  ): Promise<EvaluationInsertResult> {
    const written = await this.durable.insertIfAbsent(evaluation);
    if (!written.ok) {
      return {
        evaluation: null,
        created: false,
        durable: false,
        unavailable: true,
      };
    }
    return {
      evaluation: this.memory.hydrate(written.evaluation),
      created: written.created,
      durable: true,
      unavailable: false,
    };
  }

  clear(): void {
    this.memory.clear();
  }
}

export class InMemoryPrematchDecisionEvaluationBackend
  implements PrematchDecisionEvaluationDurableBackend
{
  constructor(
    private readonly inner = new InMemoryPrematchDecisionEvaluationStore(),
  ) {}

  store(): InMemoryPrematchDecisionEvaluationStore {
    return this.inner;
  }

  async getByEvaluationId(evaluationId: string) {
    return {
      ok: true as const,
      evaluation: await this.inner.getByEvaluationId(evaluationId),
    };
  }

  async insertIfAbsent(evaluation: PrematchDecisionEvaluation) {
    const inserted = await this.inner.insertIfAbsent(evaluation);
    if (!inserted.evaluation) {
      return { ok: false as const, unavailable: true as const };
    }
    return {
      ok: true as const,
      created: inserted.created,
      evaluation: inserted.evaluation,
    };
  }
}

export class UnavailablePrematchDecisionEvaluationBackend
  implements PrematchDecisionEvaluationDurableBackend
{
  async getByEvaluationId() {
    return { ok: false as const, unavailable: true as const };
  }
  async insertIfAbsent() {
    return { ok: false as const, unavailable: true as const };
  }
}

let processMemory: InMemoryPrematchDecisionEvaluationStore | null = null;
let processStore: PrematchDecisionEvaluationStore | null = null;
let processDurableFactory: () => PrematchDecisionEvaluationDurableBackend =
  createPostgresPrematchDecisionEvaluationBackend;

function ensureProcessStore(): PrematchDecisionEvaluationStore {
  if (processStore) return processStore;
  processMemory = new InMemoryPrematchDecisionEvaluationStore();
  processStore = new LayeredPrematchDecisionEvaluationStore(
    processMemory,
    processDurableFactory(),
  );
  return processStore;
}

export function setPrematchDecisionEvaluationDurableBackendFactory(
  factory: () => PrematchDecisionEvaluationDurableBackend,
): void {
  processDurableFactory = factory;
  processStore = null;
  processMemory = null;
}

export function getPrematchDecisionEvaluationStore(): PrematchDecisionEvaluationStore {
  return ensureProcessStore();
}

export function resetPrematchDecisionEvaluationStoreForTests(): void {
  processMemory?.clear();
  processStore = null;
  processMemory = null;
}
