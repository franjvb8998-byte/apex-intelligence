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

export function serializeFinalFixtureEvidence(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function cloneFinalFixtureEvidence<T>(value: T): T {
  return JSON.parse(serializeFinalFixtureEvidence(value)) as T;
}

export function materialFinalEvidenceKey(input: {
  fixtureId: string;
  vendorStatusShort: string;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
  extratimeHome: number | null;
  extratimeAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerHome: boolean | null;
  winnerAway: boolean | null;
}): string {
  return serializeFinalFixtureEvidence(input);
}
