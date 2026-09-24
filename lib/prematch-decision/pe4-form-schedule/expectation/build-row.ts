/**
 * PE-4G.3 — Transform one CalibrationRow into a canonical expectation row.
 */

import type { CalibrationRow } from "@/lib/debug/calibration/types";
import {
  pe4ExpectationQualityKind,
  reconstructPe4CommonBaselineStrength,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/common-strength";
import {
  PE4_EXPECTATION_COMMON_BASELINE,
  PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
  type Pe4ExpectationActualOutcome,
  type Pe4ExpectationDatasetRow,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type BuildPe4ExpectationRowResult =
  | { ok: true; row: Pe4ExpectationDatasetRow }
  | { ok: false; reason: string; fixtureId?: string };

function outcomeFromGoals(
  homeGoals: number,
  awayGoals: number,
): Pe4ExpectationActualOutcome {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

function toKickoffUtc(kickoff: string): string | null {
  const ms = Date.parse(kickoff);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Pure transform. Uses only *Before stats for strength; goals solely as labels.
 */
export function buildPe4ExpectationDatasetRow(
  source: CalibrationRow,
  options?: { commonBaseline?: number },
): BuildPe4ExpectationRowResult {
  const fixtureId = String(source.fixtureId ?? "").trim();
  if (!fixtureId) {
    return { ok: false, reason: "missing_fixture_id" };
  }
  if (!source.competitionId || !source.season) {
    return { ok: false, reason: "missing_competition_or_season", fixtureId };
  }
  if (!source.homeTeamId || !source.awayTeamId) {
    return { ok: false, reason: "missing_team_ids", fixtureId };
  }
  if (source.homeTeamId === source.awayTeamId) {
    return { ok: false, reason: "identical_team_ids", fixtureId };
  }
  const kickoffUtc = toKickoffUtc(source.kickoff);
  if (kickoffUtc == null) {
    return { ok: false, reason: "invalid_kickoff", fixtureId };
  }
  if (
    source.actualHomeGoals == null ||
    source.actualAwayGoals == null ||
    !Number.isFinite(source.actualHomeGoals) ||
    !Number.isFinite(source.actualAwayGoals) ||
    source.actualHomeGoals < 0 ||
    source.actualAwayGoals < 0
  ) {
    return { ok: false, reason: "missing_or_invalid_goals", fixtureId };
  }

  const B = options?.commonBaseline ?? PE4_EXPECTATION_COMMON_BASELINE;
  let home;
  let away;
  try {
    home = reconstructPe4CommonBaselineStrength({
      played: source.homePlayedBefore,
      wins: source.homeWinsBefore,
      goalsFor: source.homeGfBefore,
      goalsAgainst: source.homeGaBefore,
      commonBaseline: B,
    });
    away = reconstructPe4CommonBaselineStrength({
      played: source.awayPlayedBefore,
      wins: source.awayWinsBefore,
      goalsFor: source.awayGfBefore,
      goalsAgainst: source.awayGaBefore,
      commonBaseline: B,
    });
  } catch {
    return { ok: false, reason: "invalid_pre_kickoff_stats", fixtureId };
  }

  const actualOutcome = outcomeFromGoals(
    source.actualHomeGoals,
    source.actualAwayGoals,
  );
  // Cross-check label consistency with stored calibration outcome when present.
  if (source.actualOutcome != null) {
    const mapped =
      source.actualOutcome === "home"
        ? "HOME"
        : source.actualOutcome === "away"
          ? "AWAY"
          : "DRAW";
    if (mapped !== actualOutcome) {
      return { ok: false, reason: "outcome_goal_conflict", fixtureId };
    }
  }

  const qualityKind = pe4ExpectationQualityKind(home.source, away.source);

  return {
    ok: true,
    row: {
      schemaVersion: PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
      fixtureId,
      competitionId: String(source.competitionId),
      season: String(source.season),
      kickoffUtc,
      homeTeamId: String(source.homeTeamId),
      awayTeamId: String(source.awayTeamId),
      homeCommonStrength: home.strength,
      awayCommonStrength: away.strength,
      strengthDifferentialHome: home.strength - away.strength,
      homeStrengthSource: home.source,
      awayStrengthSource: away.source,
      homePlayed: home.played,
      awayPlayed: away.played,
      qualityKind,
      lowInformationBothBasePrior: qualityKind === "base_prior_base_prior",
      actualHomeGoals: source.actualHomeGoals,
      actualAwayGoals: source.actualAwayGoals,
      actualOutcome,
      actualGoalDifferenceHome:
        source.actualHomeGoals - source.actualAwayGoals,
      sourceReconstructionVersion: source.reconstructionVersion,
      sourceSchemaVersion: source.schemaVersion,
    },
  };
}

export function pe4ExpectationCanonicalKey(
  row: Pick<Pe4ExpectationDatasetRow, "competitionId" | "season" | "fixtureId">,
): string {
  return `${row.competitionId}|${row.season}|${row.fixtureId}`;
}

export function comparePe4ExpectationRows(
  a: Pe4ExpectationDatasetRow,
  b: Pe4ExpectationDatasetRow,
): number {
  const kickoff = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (kickoff !== 0) return kickoff;
  return a.fixtureId.localeCompare(b.fixtureId);
}
