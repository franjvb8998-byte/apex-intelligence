/**
 * GOALS-1B — Deterministic evidence digests.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";

function rateMaterial(r: {
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
  status: string;
  reason: string | null;
}) {
  return [
    r.played,
    r.goalsFor,
    r.goalsAgainst,
    r.goalsForPerMatch,
    r.goalsAgainstPerMatch,
    r.status,
    r.reason,
  ];
}

function recentMaterial(
  windows: readonly {
    windowId: string;
    requestedN: number | null;
    actualN: number;
    played: number;
    goalsFor: number;
    goalsAgainst: number;
    goalsForPerMatch: number | null;
    goalsAgainstPerMatch: number | null;
    status: string;
    reason: string | null;
  }[],
) {
  return windows.map((w) => [
    w.windowId,
    w.requestedN,
    w.actualN,
    w.played,
    w.goalsFor,
    w.goalsAgainst,
    w.goalsForPerMatch,
    w.goalsAgainstPerMatch,
    w.status,
    w.reason,
  ]);
}

/** Material payload for hashing — no acquisition timestamps. */
export function materializeGoalsEvidenceForDigest(
  evidence: Omit<GoalsTargetEvidence, "digest">,
): string {
  const payload = {
    fixtureId: evidence.fixtureId,
    competitionId: evidence.competitionId,
    season: evidence.season,
    kickoffUtc: evidence.kickoffUtc,
    homeTeamId: evidence.homeTeamId,
    awayTeamId: evidence.awayTeamId,
    historicalCutoffUtc: evidence.historicalCutoffUtc,
    labels: evidence.labels,
    home: {
      all: rateMaterial(evidence.homeEvidence.allVenues),
      home: rateMaterial(evidence.homeEvidence.homeRole),
      away: rateMaterial(evidence.homeEvidence.awayRole),
      recentLastN: recentMaterial(evidence.homeEvidence.recentLastN),
      recentCalendar: recentMaterial(evidence.homeEvidence.recentCalendar),
      recentVenue: recentMaterial(evidence.homeEvidence.recentVenueRoleLastN),
    },
    away: {
      all: rateMaterial(evidence.awayEvidence.allVenues),
      home: rateMaterial(evidence.awayEvidence.homeRole),
      away: rateMaterial(evidence.awayEvidence.awayRole),
      recentLastN: recentMaterial(evidence.awayEvidence.recentLastN),
      recentCalendar: recentMaterial(evidence.awayEvidence.recentCalendar),
      recentVenue: recentMaterial(evidence.awayEvidence.recentVenueRoleLastN),
    },
    league: evidence.leagueEnvironment,
    commonStrength: evidence.commonStrengthSeam,
    opponentSeam: evidence.opponentAdjustmentSeam.status,
    provenance: evidence.provenance,
  };
  return JSON.stringify(payload);
}

export function digestGoalsTargetEvidence(
  evidence: Omit<GoalsTargetEvidence, "digest">,
): string {
  return createHash("sha256")
    .update(materializeGoalsEvidenceForDigest(evidence), "utf8")
    .digest("hex");
}

export function digestGoalsDataset(
  rowDigests: readonly string[],
): string {
  return createHash("sha256")
    .update(rowDigests.join("\n"), "utf8")
    .digest("hex");
}
