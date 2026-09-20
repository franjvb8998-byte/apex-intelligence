/**
 * Parse a Match Center URL/path fixture id into a tracked provider id.
 * Rejects empty, non-integer, and non-positive values.
 */

import { vendorFixtureId } from "@/lib/match-center/fixture-id";
import { normalizePositiveIntegerIds } from "@/lib/data-platform/providers/api-football/live-query";

export function parseTrackedFixtureId(
  raw: string | null | undefined,
): number | null {
  const vendor = vendorFixtureId(raw);
  if (!vendor) return null;
  try {
    const [id] = normalizePositiveIntegerIds([vendor], { maxCount: 1 });
    return id ?? null;
  } catch {
    return null;
  }
}
