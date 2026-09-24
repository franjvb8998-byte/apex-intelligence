/**
 * PE-4G.1 — Generic historical common-baseline strength reconstruction.
 *
 * Reconstructs a team's C0 catalogue/base_prior index using only evidence
 * with kickoff < historicalCutoffUtc. Same common fixed baseline (1580) for
 * all teams so pairwise differentials are comparable.
 *
 * NOT venue-role ticket Elo (1580 home / 1520 away).
 */

import { PRODUCTION_HOME_ELO_BASE } from "@/lib/match-center/catalogue-elo";
import { resolvePrematchStrengthFromUniverse } from "@/lib/match-center/prematch-strength/resolve-prematch-strength";
import type { PrematchStrengthEloSource } from "@/lib/match-center/prematch-strength/types";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import {
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  type Pe4CommonBaselineStrengthSemantics,
} from "@/lib/prematch-decision/pe4-form-schedule/types";

/** Synthetic counterparty so the subject is always reconstructed as HOME @ 1580. */
export const PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID =
  "apex:pe4c:synthetic-away" as const;

export const PE4_COMMON_BASELINE_RECONSTRUCTION_BASE =
  PRODUCTION_HOME_ELO_BASE;

export type Pe4HistoricalStrengthUnavailableReason =
  | "invalid_team_id"
  | "reconstruction_failed";

export type Pe4HistoricalCommonBaselineStrength = {
  teamId: string;
  strengthAsOfCutoff: number | null;
  source: PrematchStrengthEloSource | null;
  played: number | null;
  cutoffUtc: string;
  available: boolean;
  unavailableReason: Pe4HistoricalStrengthUnavailableReason | null;
  reconstructionBase: number;
  semantics: Pe4CommonBaselineStrengthSemantics;
  comparableToVenueSpecificC0Elo: false;
};

export type Pe4HistoricalStrengthMemo = Map<
  string,
  Pe4HistoricalCommonBaselineStrength
>;

export function createPe4HistoricalStrengthMemo(): Pe4HistoricalStrengthMemo {
  return new Map();
}

export function pe4HistoricalStrengthMemoKey(input: {
  teamId: string;
  historicalCutoffUtc: string;
  competitionId: string;
  season: string;
  excludeFixtureId: string;
  commonBaseline: number;
}): string {
  return [
    input.teamId,
    input.historicalCutoffUtc,
    input.competitionId,
    input.season,
    input.excludeFixtureId,
    String(input.commonBaseline),
  ].join("\0");
}

function withSemantics(
  partial: Omit<
    Pe4HistoricalCommonBaselineStrength,
    "semantics" | "comparableToVenueSpecificC0Elo"
  >,
): Pe4HistoricalCommonBaselineStrength {
  return {
    ...partial,
    semantics: PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
    comparableToVenueSpecificC0Elo: false,
  };
}

/**
 * Reconstruct team strength strictly before historicalCutoffUtc.
 * Excludes excludeFixtureId (match M) via PE-3 target.fixtureId semantics.
 */
export function resolveHistoricalCommonBaselineStrength(input: {
  teamId: string;
  matchFixtureId: string;
  matchKickoffUtc: string;
  competitionId: string;
  season: string;
  universe: readonly PrematchStrengthUniverseFixture[];
  memo?: Pe4HistoricalStrengthMemo;
}): Pe4HistoricalCommonBaselineStrength {
  const commonBaseline = PE4_COMMON_BASELINE_RECONSTRUCTION_BASE;
  const key = pe4HistoricalStrengthMemoKey({
    teamId: input.teamId,
    historicalCutoffUtc: input.matchKickoffUtc,
    competitionId: input.competitionId,
    season: input.season,
    excludeFixtureId: input.matchFixtureId,
    commonBaseline,
  });
  if (input.memo?.has(key)) {
    return input.memo.get(key)!;
  }

  if (
    !input.teamId ||
    input.teamId === PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID
  ) {
    const unavailable = withSemantics({
      teamId: input.teamId || "",
      strengthAsOfCutoff: null,
      source: null,
      played: null,
      cutoffUtc: input.matchKickoffUtc,
      available: false,
      unavailableReason: "invalid_team_id",
      reconstructionBase: commonBaseline,
    });
    input.memo?.set(key, unavailable);
    return unavailable;
  }

  try {
    const strength = resolvePrematchStrengthFromUniverse({
      target: {
        fixtureId: input.matchFixtureId,
        kickoffUtc: input.matchKickoffUtc,
        homeTeamId: input.teamId,
        awayTeamId: PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID,
        competitionId: input.competitionId,
        season: input.season,
      },
      universe: input.universe,
      evidenceAcquiredAtUtc: null,
    });

    const side = strength.home;
    const evidence = withSemantics({
      teamId: input.teamId,
      strengthAsOfCutoff: side.elo,
      source: side.source,
      played: side.evidence.played,
      cutoffUtc: input.matchKickoffUtc,
      available: true,
      unavailableReason: null,
      reconstructionBase: side.base,
    });
    input.memo?.set(key, evidence);
    return evidence;
  } catch {
    const unavailable = withSemantics({
      teamId: input.teamId,
      strengthAsOfCutoff: null,
      source: null,
      played: null,
      cutoffUtc: input.matchKickoffUtc,
      available: false,
      unavailableReason: "reconstruction_failed",
      reconstructionBase: commonBaseline,
    });
    input.memo?.set(key, unavailable);
    return unavailable;
  }
}
