/**
 * Canonical UTC timestamps for protocol arithmetic. Local display never drives eligibility.
 */

import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";

export function toUtcIso(value: string, label = "timestamp"): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new ProspectiveIntegrityError(`${label} must be a parseable ISO timestamp`);
  }
  return new Date(ms).toISOString();
}

export function utcMillis(value: string, label = "timestamp"): number {
  return Date.parse(toUtcIso(value, label));
}

export function minutesBeforeKickoffUtc(kickoff: string, asOf: string): number {
  return (utcMillis(kickoff, "kickoff") - utcMillis(asOf, "asOf")) / 60000;
}
