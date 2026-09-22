/**
 * Vendor-status finalization classes for Phase 1C.
 * Past kickoff is never treated as completion.
 */

import { normalizeVendorStatusShort } from "@/lib/prematch-decision/actionability";
import type { FinalizationClass } from "@/lib/final-evidence/types";

export const SCOREABLE_FINAL_STATUSES = ["FT", "AET", "PEN"] as const;
export const NON_SCOREABLE_TERMINAL_STATUSES = [
  "CANC",
  "ABD",
  "AWD",
  "WO",
] as const;

const SCOREABLE = new Set<string>(SCOREABLE_FINAL_STATUSES);
const NON_SCOREABLE = new Set<string>(NON_SCOREABLE_TERMINAL_STATUSES);

export function classifyVendorFinalization(
  vendorStatusShort: string | null | undefined,
): FinalizationClass {
  const status = normalizeVendorStatusShort(vendorStatusShort);
  if (!status) return "NOT_FINAL";
  if (SCOREABLE.has(status)) return "SCOREABLE_FINAL";
  if (NON_SCOREABLE.has(status)) return "NON_SCOREABLE_TERMINAL";
  return "NOT_FINAL";
}

export function isScoreableFinalStatus(
  vendorStatusShort: string | null | undefined,
): boolean {
  return classifyVendorFinalization(vendorStatusShort) === "SCOREABLE_FINAL";
}

export function isNonScoreableTerminalStatus(
  vendorStatusShort: string | null | undefined,
): boolean {
  return (
    classifyVendorFinalization(vendorStatusShort) === "NON_SCOREABLE_TERMINAL"
  );
}

export function isPersistableFinalStatus(
  vendorStatusShort: string | null | undefined,
): boolean {
  const klass = classifyVendorFinalization(vendorStatusShort);
  return klass === "SCOREABLE_FINAL" || klass === "NON_SCOREABLE_TERMINAL";
}

/** Integer goal count. Null is invalid. Never coerce null to 0. */
export function isValidGoalCount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
