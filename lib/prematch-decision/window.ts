/**
 * Canonical prematch ticket capture window.
 *
 * T-120 minutes through immediately before kickoff:
 *   kickoff - 120m <= now < kickoff
 *
 * Phase 1A actionability is applied separately. This module does not
 * change NS / kickoff fail-closed rules.
 */

import type { InjectedClock } from "@/lib/prematch-decision/actionability";

export const CANONICAL_CAPTURE_WINDOW_MINUTES = 120;

export type PrematchCaptureWindowReason =
  | "WITHIN_CANONICAL_CAPTURE_WINDOW"
  | "TOO_EARLY_FOR_CANONICAL_CAPTURE"
  | "KICKOFF_REACHED"
  | "KICKOFF_MISSING_OR_INVALID";

export type PrematchCaptureWindowInput = {
  kickoffUtc?: string | null;
  nowUtc?: InjectedClock;
  asOf?: InjectedClock;
};

export type PrematchCaptureWindow = {
  inWindow: boolean;
  reason: PrematchCaptureWindowReason;
  kickoffUtc: string | null;
  nowUtc: string;
  windowOpensUtc: string | null;
};

function resolveClock(clock: InjectedClock | undefined): Date {
  if (clock === undefined) return new Date();
  if (clock instanceof Date) return clock;
  return new Date(clock);
}

function parseKickoffUtc(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function evaluatePrematchCaptureWindow(
  input: PrematchCaptureWindowInput,
): PrematchCaptureWindow {
  const now = resolveClock(input.nowUtc ?? input.asOf);
  const kickoff = parseKickoffUtc(input.kickoffUtc);
  const kickoffUtc = kickoff ? kickoff.toISOString() : null;
  const nowUtc = now.toISOString();

  if (!kickoff) {
    return {
      inWindow: false,
      reason: "KICKOFF_MISSING_OR_INVALID",
      kickoffUtc,
      nowUtc,
      windowOpensUtc: null,
    };
  }

  const windowOpens = new Date(
    kickoff.getTime() - CANONICAL_CAPTURE_WINDOW_MINUTES * 60 * 1000,
  );
  const windowOpensUtc = windowOpens.toISOString();

  if (now.getTime() >= kickoff.getTime()) {
    return {
      inWindow: false,
      reason: "KICKOFF_REACHED",
      kickoffUtc,
      nowUtc,
      windowOpensUtc,
    };
  }

  if (now.getTime() < windowOpens.getTime()) {
    return {
      inWindow: false,
      reason: "TOO_EARLY_FOR_CANONICAL_CAPTURE",
      kickoffUtc,
      nowUtc,
      windowOpensUtc,
    };
  }

  return {
    inWindow: true,
    reason: "WITHIN_CANONICAL_CAPTURE_WINDOW",
    kickoffUtc,
    nowUtc,
    windowOpensUtc,
  };
}

export function isWithinCanonicalCaptureWindow(
  input: PrematchCaptureWindowInput,
): boolean {
  return evaluatePrematchCaptureWindow(input).inWindow;
}
