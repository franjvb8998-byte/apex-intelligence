/**
 * PE-4I.4 — Competition inclusion policy for future form/performance features.
 * Raw acquisition still preserves all fixtures.
 */

import {
  PE4I2_COMPETITION_ID_REGISTRY,
  type Pe4I2CompetitionClass,
} from "@/lib/debug/calibration/pe4-acquisition/competition-registry";

export type Pe4I4PerformanceInclusion =
  | "INCLUDE_PRIMARY_PERFORMANCE"
  | "PRESERVE_RAW_EXCLUDE_PRIMARY_STATS"
  | "PRESERVE_RAW_SEPARATE_AUDIT"
  | "PRESERVE_RAW_UNKNOWN";

/**
 * Policy for CURRENT-FORM / PERFORMANCE history modeling (not raw cache).
 */
export function pe4I4PerformanceInclusion(
  competitionClass: Pe4I2CompetitionClass,
): Pe4I4PerformanceInclusion {
  switch (competitionClass) {
    case "target_domestic_league":
    case "domestic_cup":
    case "domestic_league_cup":
    case "uefa_champions_league":
    case "uefa_europa_league":
    case "uefa_conference_league":
      return "INCLUDE_PRIMARY_PERFORMANCE";
    case "other_known_competition":
      // Community Shield / friendlies / summer series are other_known in registry.
      // Distinguish by leaving caller to use id-specific policy below.
      return "PRESERVE_RAW_SEPARATE_AUDIT";
    case "unknown_competition":
      return "PRESERVE_RAW_UNKNOWN";
    default:
      return "PRESERVE_RAW_UNKNOWN";
  }
}

/** Id-level overrides for other_known pins from PE-4I.3. */
export const PE4I4_OTHER_KNOWN_STATS_POLICY: Readonly<
  Record<string, Pe4I4PerformanceInclusion>
> = {
  /** Community Shield — preserve raw; not equal weight to PL. */
  "528": "PRESERVE_RAW_SEPARATE_AUDIT",
  /** Friendlies Clubs — exclude from primary stats queue. */
  "667": "PRESERVE_RAW_EXCLUDE_PRIMARY_STATS",
  /** Premier League Summer Series — exclude from primary stats queue. */
  "1022": "PRESERVE_RAW_EXCLUDE_PRIMARY_STATS",
};

/**
 * Prefer registry id when present so stale cached class labels
 * (e.g. smoke envelopes written before I.3 pins) still classify correctly.
 */
export function resolveCompetitionClassForPolicy(input: {
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
}): Pe4I2CompetitionClass {
  const id = input.providerCompetitionId?.trim() ?? null;
  if (id && PE4I2_COMPETITION_ID_REGISTRY[id]) {
    return PE4I2_COMPETITION_ID_REGISTRY[id]!;
  }
  return input.competitionClass;
}

export function pe4I4PrimaryStatsInclusion(input: {
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
}): Pe4I4PerformanceInclusion {
  const id = input.providerCompetitionId?.trim() ?? null;
  if (id && PE4I4_OTHER_KNOWN_STATS_POLICY[id]) {
    return PE4I4_OTHER_KNOWN_STATS_POLICY[id]!;
  }
  const resolved = resolveCompetitionClassForPolicy(input);
  return pe4I4PerformanceInclusion(resolved);
}

export function isPrimaryStatisticsCompetition(input: {
  providerCompetitionId: string | null;
  competitionClass: Pe4I2CompetitionClass;
}): boolean {
  return (
    pe4I4PrimaryStatsInclusion(input) === "INCLUDE_PRIMARY_PERFORMANCE"
  );
}
