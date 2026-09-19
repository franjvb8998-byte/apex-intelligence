/**
 * Injected capture clock. Tests must not depend on wall-clock time.
 */

import type { CaptureClock } from "@/lib/debug/calibration/prospective/capture/capture-types";
import { ProspectiveIntegrityError } from "@/lib/debug/calibration/prospective/candidate-integrity";

export function assertIsoTimestamp(value: string, label: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new ProspectiveIntegrityError(`${label} must be a parseable ISO timestamp`);
  }
  return ms;
}

export function createFixedClock(iso: string): CaptureClock {
  assertIsoTimestamp(iso, "clock");
  return {
    now: () => iso,
  };
}

export function createInjectedClock(now: () => string): CaptureClock {
  return {
    now: () => {
      const value = now();
      assertIsoTimestamp(value, "clock");
      return value;
    },
  };
}

export function minutesBeforeKickoff(kickoff: string, capturedAt: string): number {
  const kickoffMs = assertIsoTimestamp(kickoff, "kickoff");
  const capturedMs = assertIsoTimestamp(capturedAt, "capturedAt");
  return (kickoffMs - capturedMs) / 60000;
}
