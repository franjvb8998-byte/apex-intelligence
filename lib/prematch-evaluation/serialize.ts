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

export function serializePrematchDecisionEvaluation(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function clonePrematchDecisionEvaluation<T>(value: T): T {
  return JSON.parse(serializePrematchDecisionEvaluation(value)) as T;
}
