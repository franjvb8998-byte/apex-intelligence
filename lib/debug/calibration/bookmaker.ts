/**
 * External 1X2 bookmaker baseline. Never fed into the Probability Engine.
 *
 * Production mapOdds stamps capturedAt with nowIso() — that is FETCH TIME,
 * not opening, closing, or a proven pre-match snapshot.
 */

import type { CalibrationOddsTiming, OneXTwo } from "@/lib/debug/calibration/types";

export const BOOKMAKER_ODDS_TIMING_DISCLAIMER =
  "Bookmaker 1X2 is an external baseline only. Odds timing is unknown unless a vendor update timestamp is proven. Do not describe unknown or fetch-time odds as opening, closing, or known-at-kickoff. Never feed these probabilities into APEX PE or EV.";

export function oddsMayBeDescribedAsKnownAtKickoff(
  timing: CalibrationOddsTiming,
): boolean {
  void timing;
  return false;
}

export function bookmakerBaselineReportLabel(
  timing: CalibrationOddsTiming,
): string {
  if (timing === "vendor_update") {
    return "bookmaker_baseline_vendor_update_not_proven_prematch";
  }
  if (timing === "fetch_time") {
    return "bookmaker_baseline_fetch_time_not_prematch";
  }
  return "bookmaker_baseline_timing_unknown_not_prematch";
}

export function impliedProbabilitiesFromDecimalOdds(input: {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}): { raw: OneXTwo; overround: number; normalized: OneXTwo } | null {
  const { homeOdds, drawOdds, awayOdds } = input;
  if (
    !(homeOdds > 1) ||
    !(drawOdds > 1) ||
    !(awayOdds > 1) ||
    !Number.isFinite(homeOdds) ||
    !Number.isFinite(drawOdds) ||
    !Number.isFinite(awayOdds)
  ) {
    return null;
  }
  const raw = {
    home: 1 / homeOdds,
    draw: 1 / drawOdds,
    away: 1 / awayOdds,
  };
  const overround = raw.home + raw.draw + raw.away;
  if (!(overround > 0)) return null;
  return {
    raw,
    overround,
    normalized: {
      home: raw.home / overround,
      draw: raw.draw / overround,
      away: raw.away / overround,
    },
  };
}
