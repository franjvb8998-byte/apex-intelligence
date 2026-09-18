/**
 * Request-safe reuse of the default Opportunity Scanner board.
 *
 * Share only when semantic inputs match: no injected provider, no custom env,
 * no profiler session. Result is cloned so one consumer cannot mutate another.
 * In-flight only — this is not a TTL cache.
 */

import type { ApexOpportunitiesBoard } from "@/lib/apex-opportunities/types";

const SLOT = Symbol.for("apex.opportunities.sharedBoard");

type ShareGlobal = typeof globalThis & {
  [SLOT]?: Map<string, Promise<ApexOpportunitiesBoard>>;
};

function flights(): Map<string, Promise<ApexOpportunitiesBoard>> {
  const g = globalThis as ShareGlobal;
  if (!g[SLOT]) g[SLOT] = new Map();
  return g[SLOT];
}

export function defaultApexOpportunitiesShareKey(now = () => new Date()): string {
  return `apex:scan:${now().toISOString().slice(0, 10)}`;
}

export function snapshotApexOpportunitiesBoard(
  board: ApexOpportunitiesBoard,
): ApexOpportunitiesBoard {
  return structuredClone(board);
}

export function shareApexOpportunitiesBoard(
  key: string,
  load: () => Promise<ApexOpportunitiesBoard>,
): Promise<ApexOpportunitiesBoard> {
  const map = flights();
  const existing = map.get(key);
  if (existing) {
    return existing.then(snapshotApexOpportunitiesBoard);
  }
  const pending = load().finally(() => {
    if (map.get(key) === pending) map.delete(key);
  });
  map.set(key, pending);
  return pending.then(snapshotApexOpportunitiesBoard);
}

export function resetApexOpportunitiesShareForTests(): void {
  flights().clear();
}
