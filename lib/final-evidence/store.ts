/**
 * Testable final-evidence repository.
 * L1 memory + durable first-write-wins. Never UPDATE a stored row.
 */

import { isPersistableFinalStatus } from "@/lib/final-evidence/finalization";
import { buildFinalFixtureEvidence } from "@/lib/final-evidence/capture";
import { canonicalPrematchFixtureId } from "@/lib/prematch-decision/identity";
import { createPostgresFinalFixtureEvidenceBackend } from "@/lib/final-evidence/durable-postgres";
import {
  cloneFinalFixtureEvidence,
  materialFinalEvidenceKey,
} from "@/lib/final-evidence/serialize";
import type {
  FinalFixtureEvidence,
  FinalFixtureObservation,
  ObserveFinalEvidenceResult,
} from "@/lib/final-evidence/types";

export type FinalEvidenceInsertResult = {
  evidence: FinalFixtureEvidence | null;
  created: boolean;
  durable: boolean;
  unavailable: boolean;
};

export type FinalFixtureEvidenceStore = {
  getByEvidenceId(evidenceId: string): Promise<FinalFixtureEvidence | null>;
  getCanonicalByFixtureId(
    fixtureId: string,
  ): Promise<FinalFixtureEvidence | null>;
  listByFixtureId(fixtureId: string): Promise<FinalFixtureEvidence[]>;
  observe(observation: FinalFixtureObservation): Promise<ObserveFinalEvidenceResult>;
  clear(): void;
};

export type FinalFixtureEvidenceDurableBackend = {
  getByEvidenceId(evidenceId: string): Promise<
    | { ok: true; evidence: FinalFixtureEvidence | null }
    | { ok: false; unavailable: true }
  >;
  listByFixtureId(fixtureId: string): Promise<
    | { ok: true; rows: FinalFixtureEvidence[] }
    | { ok: false; unavailable: true }
  >;
  insertIfAbsent(evidence: FinalFixtureEvidence): Promise<
    | { ok: true; created: boolean; evidence: FinalFixtureEvidence }
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

function freezeEvidence(evidence: FinalFixtureEvidence): FinalFixtureEvidence {
  return deepFreeze(cloneFinalFixtureEvidence(evidence));
}

function materialOf(
  evidence: Pick<
    FinalFixtureEvidence,
    | "fixtureId"
    | "vendorStatusShort"
    | "goalsHome"
    | "goalsAway"
    | "fulltimeHome"
    | "fulltimeAway"
    | "extratimeHome"
    | "extratimeAway"
    | "penaltyHome"
    | "penaltyAway"
    | "winnerHome"
    | "winnerAway"
  >,
): string {
  return materialFinalEvidenceKey({
    fixtureId: evidence.fixtureId,
    vendorStatusShort: evidence.vendorStatusShort,
    goalsHome: evidence.goalsHome,
    goalsAway: evidence.goalsAway,
    fulltimeHome: evidence.fulltimeHome,
    fulltimeAway: evidence.fulltimeAway,
    extratimeHome: evidence.extratimeHome,
    extratimeAway: evidence.extratimeAway,
    penaltyHome: evidence.penaltyHome,
    penaltyAway: evidence.penaltyAway,
    winnerHome: evidence.winnerHome,
    winnerAway: evidence.winnerAway,
  });
}

export class InMemoryFinalFixtureEvidenceStore
  implements FinalFixtureEvidenceStore
{
  private readonly byId = new Map<string, FinalFixtureEvidence>();
  private readonly byFixture = new Map<string, FinalFixtureEvidence[]>();

  async getByEvidenceId(
    evidenceId: string,
  ): Promise<FinalFixtureEvidence | null> {
    return this.byId.get(evidenceId) ?? null;
  }

  async getCanonicalByFixtureId(
    fixtureId: string,
  ): Promise<FinalFixtureEvidence | null> {
    const canonical = canonicalPrematchFixtureId(fixtureId);
    if (!canonical) return null;
    return (
      this.byFixture.get(canonical)?.find((row) => row.observationRevision === 1) ??
      null
    );
  }

  async listByFixtureId(fixtureId: string): Promise<FinalFixtureEvidence[]> {
    const canonical = canonicalPrematchFixtureId(fixtureId);
    if (!canonical) return [];
    return [...(this.byFixture.get(canonical) ?? [])].sort(
      (a, b) => a.observationRevision - b.observationRevision,
    );
  }

  hydrate(evidence: FinalFixtureEvidence): FinalFixtureEvidence {
    const frozen = freezeEvidence(evidence);
    this.byId.set(frozen.evidenceId, frozen);
    const list = this.byFixture.get(frozen.fixtureId) ?? [];
    const next = list.filter((row) => row.evidenceId !== frozen.evidenceId);
    next.push(frozen);
    this.byFixture.set(frozen.fixtureId, next);
    return frozen;
  }

  async observe(
    observation: FinalFixtureObservation,
  ): Promise<ObserveFinalEvidenceResult> {
    const fixtureId = canonicalPrematchFixtureId(observation.fixtureId);
    if (!fixtureId) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    if (!isPersistableFinalStatus(observation.vendorStatusShort)) {
      return { ok: false, reason: "NOT_FINAL", evidence: null };
    }
    const existing = await this.listByFixtureId(fixtureId);
    const candidate = buildFinalFixtureEvidence(
      { ...observation, fixtureId },
      1,
    );
    if (!candidate) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    const same = existing.find((row) => materialOf(row) === materialOf(candidate));
    if (same) {
      return { ok: true, created: false, evidence: same };
    }
    const revision =
      existing.length === 0
        ? 1
        : Math.max(...existing.map((row) => row.observationRevision)) + 1;
    const built = buildFinalFixtureEvidence(
      { ...observation, fixtureId },
      revision,
    );
    if (!built) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    return {
      ok: true,
      created: true,
      evidence: this.hydrate(built),
    };
  }

  clear(): void {
    this.byId.clear();
    this.byFixture.clear();
  }
}

export class LayeredFinalFixtureEvidenceStore
  implements FinalFixtureEvidenceStore
{
  constructor(
    private readonly memory: InMemoryFinalFixtureEvidenceStore,
    private readonly durable: FinalFixtureEvidenceDurableBackend,
  ) {}

  async getByEvidenceId(
    evidenceId: string,
  ): Promise<FinalFixtureEvidence | null> {
    const cached = await this.memory.getByEvidenceId(evidenceId);
    if (cached) return cached;
    const remote = await this.durable.getByEvidenceId(evidenceId);
    if (!remote.ok || !remote.evidence) return null;
    return this.memory.hydrate(remote.evidence);
  }

  async getCanonicalByFixtureId(
    fixtureId: string,
  ): Promise<FinalFixtureEvidence | null> {
    const rows = await this.listByFixtureId(fixtureId);
    return rows.find((row) => row.observationRevision === 1) ?? null;
  }

  async listByFixtureId(fixtureId: string): Promise<FinalFixtureEvidence[]> {
    const cached = await this.memory.listByFixtureId(fixtureId);
    if (cached.length > 0) return cached;
    const remote = await this.durable.listByFixtureId(fixtureId);
    if (!remote.ok) return [];
    return remote.rows.map((row) => this.memory.hydrate(row));
  }

  async observe(
    observation: FinalFixtureObservation,
  ): Promise<ObserveFinalEvidenceResult> {
    const fixtureId = canonicalPrematchFixtureId(observation.fixtureId);
    if (!fixtureId) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    if (!isPersistableFinalStatus(observation.vendorStatusShort)) {
      return { ok: false, reason: "NOT_FINAL", evidence: null };
    }
    const existing = await this.durable.listByFixtureId(fixtureId);
    if (!existing.ok) {
      return { ok: false, reason: "DURABLE_STORE_UNAVAILABLE", evidence: null };
    }
    const probe = buildFinalFixtureEvidence({ ...observation, fixtureId }, 1);
    if (!probe) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    const same = existing.rows.find((row) => materialOf(row) === materialOf(probe));
    if (same) {
      return { ok: true, created: false, evidence: this.memory.hydrate(same) };
    }
    const revision =
      existing.rows.length === 0
        ? 1
        : Math.max(...existing.rows.map((row) => row.observationRevision)) + 1;
    const built = buildFinalFixtureEvidence(
      { ...observation, fixtureId },
      revision,
    );
    if (!built) {
      return { ok: false, reason: "FIXTURE_IDENTITY_MISSING", evidence: null };
    }
    const written = await this.durable.insertIfAbsent(built);
    if (!written.ok) {
      return { ok: false, reason: "DURABLE_STORE_UNAVAILABLE", evidence: null };
    }
    return {
      ok: true,
      created: written.created,
      evidence: this.memory.hydrate(written.evidence),
    };
  }

  clear(): void {
    this.memory.clear();
  }
}

export class InMemoryFinalFixtureEvidenceBackend
  implements FinalFixtureEvidenceDurableBackend
{
  constructor(
    private readonly inner = new InMemoryFinalFixtureEvidenceStore(),
  ) {}

  store(): InMemoryFinalFixtureEvidenceStore {
    return this.inner;
  }

  async getByEvidenceId(evidenceId: string) {
    return { ok: true as const, evidence: await this.inner.getByEvidenceId(evidenceId) };
  }

  async listByFixtureId(fixtureId: string) {
    return { ok: true as const, rows: await this.inner.listByFixtureId(fixtureId) };
  }

  async insertIfAbsent(evidence: FinalFixtureEvidence) {
    const existing = await this.inner.getByEvidenceId(evidence.evidenceId);
    if (existing) {
      return { ok: true as const, created: false, evidence: existing };
    }
    return {
      ok: true as const,
      created: true,
      evidence: this.inner.hydrate(evidence),
    };
  }
}

export class UnavailableFinalFixtureEvidenceBackend
  implements FinalFixtureEvidenceDurableBackend
{
  async getByEvidenceId() {
    return { ok: false as const, unavailable: true as const };
  }
  async listByFixtureId() {
    return { ok: false as const, unavailable: true as const };
  }
  async insertIfAbsent() {
    return { ok: false as const, unavailable: true as const };
  }
}

let processMemory: InMemoryFinalFixtureEvidenceStore | null = null;
let processStore: FinalFixtureEvidenceStore | null = null;
let processDurableFactory: () => FinalFixtureEvidenceDurableBackend =
  createPostgresFinalFixtureEvidenceBackend;

function ensureProcessStore(): FinalFixtureEvidenceStore {
  if (processStore) return processStore;
  processMemory = new InMemoryFinalFixtureEvidenceStore();
  processStore = new LayeredFinalFixtureEvidenceStore(
    processMemory,
    processDurableFactory(),
  );
  return processStore;
}

export function setFinalFixtureEvidenceDurableBackendFactory(
  factory: () => FinalFixtureEvidenceDurableBackend,
): void {
  processDurableFactory = factory;
  processStore = null;
  processMemory = null;
}

export function getFinalFixtureEvidenceStore(): FinalFixtureEvidenceStore {
  return ensureProcessStore();
}

export function resetFinalFixtureEvidenceStoreForTests(): void {
  processMemory?.clear();
  processStore = null;
  processMemory = null;
}
