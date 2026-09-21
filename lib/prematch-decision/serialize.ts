/**
 * Deterministic JSON for immutable ticket identity / comparison.
 * Object keys are sorted; array order is preserved as captured.
 */

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = sortKeys(record[key]);
    }
    return out;
  }
  return value;
}

export function canonicalPrematchDecisionPayload(value: unknown): unknown {
  return sortKeys(value);
}

export function serializePrematchDecisionTicket(value: unknown): string {
  return JSON.stringify(canonicalPrematchDecisionPayload(value));
}

export function clonePrematchDecisionTicket<T>(value: T): T {
  return JSON.parse(serializePrematchDecisionTicket(value)) as T;
}
