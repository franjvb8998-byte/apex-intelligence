/**
 * Optional pre-match odds projection. Late or invalid odds are dropped, not fatal.
 */

import { assertOddsTimestampGuard } from "@/lib/debug/calibration/prospective/capture/capture-eligibility";
import type { ProspectiveOddsSnapshot } from "@/lib/debug/calibration/prospective/capture/capture-types";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finitePositive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function projectOddsShape(raw: unknown): ProspectiveOddsSnapshot | null {
  if (raw == null) return null;
  const record = asRecord(raw);
  const capturedAt = typeof record.capturedAt === "string" ? record.capturedAt : "";
  const source = typeof record.source === "string" ? record.source.trim() : "";
  const home = finitePositive(record.home);
  const draw = finitePositive(record.draw);
  const away = finitePositive(record.away);
  if (!capturedAt || !source || home == null || draw == null || away == null) {
    return null;
  }
  return { capturedAt, source, home, draw, away };
}

export function projectOptionalOdds(
  raw: unknown,
  capturedAt: string,
  kickoffUtc: string,
): ProspectiveOddsSnapshot | null {
  const projected = projectOddsShape(raw);
  if (projected == null) return null;
  try {
    assertOddsTimestampGuard(projected, capturedAt, kickoffUtc);
    return projected;
  } catch {
    return null;
  }
}
