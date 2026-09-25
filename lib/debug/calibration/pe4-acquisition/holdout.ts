/**
 * PE-4I.4 — Holdout firewall: provider season ≠ calendar year ≠ research split.
 */

import { PE4I2_HOLDOUT_SEASON } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";

export type Pe4I4SeasonAxes = {
  /** API-Football season query parameter (e.g. "2024"). */
  providerSeasonId: string;
  /** UTC calendar year of kickoff, if parseable. */
  calendarKickoffYear: number | null;
  /**
   * Research development / confirmatory / holdout axis.
   * Holdout remains "2025" and is sealed for outcome evaluation.
   */
  researchSeasonAxis: "2023" | "2024" | "2025_holdout_sealed" | "other";
};

export function calendarKickoffYear(kickoffUtc: string): number | null {
  const ms = parseKickoffUtcMillis(kickoffUtc);
  if (ms == null) return null;
  return new Date(ms).getUTCFullYear();
}

export function classifySeasonAxes(input: {
  providerSeasonId: string;
  kickoffUtc: string;
}): Pe4I4SeasonAxes {
  const cal = calendarKickoffYear(input.kickoffUtc);
  let research: Pe4I4SeasonAxes["researchSeasonAxis"] = "other";
  if (input.providerSeasonId === PE4I2_HOLDOUT_SEASON) {
    research = "2025_holdout_sealed";
  } else if (input.providerSeasonId === "2023") {
    research = "2023";
  } else if (input.providerSeasonId === "2024") {
    research = "2024";
  }
  return {
    providerSeasonId: input.providerSeasonId,
    calendarKickoffYear: cal,
    researchSeasonAxis: research,
  };
}

/**
 * A provider-season=2024 fixture with calendar kickoff in 2025 is NOT
 * automatically research holdout-2025 evidence.
 */
export function isResearchHoldoutOutcomeEvidence(input: {
  providerSeasonId: string;
  kickoffUtc: string;
}): false {
  void input;
  // Explicit: this protocol never promotes calendar-2025 kickoffs into
  // holdout outcome evaluation merely because kickoff year is 2025.
  // Holdout outcome use requires an authorized holdout protocol.
  return false;
}

export function assertNoProviderSeason2025Request(season: string): void {
  if (season === PE4I2_HOLDOUT_SEASON) {
    throw new Error(
      "PE-4I.4 holdout firewall: provider season 2025 requests are forbidden",
    );
  }
}
