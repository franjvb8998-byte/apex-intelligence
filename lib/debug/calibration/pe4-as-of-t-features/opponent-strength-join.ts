/** PE-4I.16/I.19 — fail-closed opponent-strength join as of kickoff(M). */

import {
  assertOpponentStrengthCutoffIsKickoffM,
  PE4I15_OPPONENT_STRENGTH_CONTRACT,
} from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength";
import {
  pe4I19StrengthJoinKey,
  type Pe4I19StrengthCatalogue,
  type Pe4I19StrengthJoinValue,
} from "@/lib/debug/calibration/pe4-as-of-t-features/strength-catalogue";
import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";

export const PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON =
  "no_offline_as_of_kickoff_m_strength_catalogue_in_pe4_acquisition_corpus" as const;

type JoinAudit = {
  selectedHistoryCount: number;
  matchedCount: number;
  missingCount: number;
  missingKeys: string[];
  minimumObservations: typeof PE4I15_OPPONENT_STRENGTH_CONTRACT.minObservations;
  complete: boolean;
};

export type Pe4I16OpponentStrengthJoin =
  | {
      status: "AVAILABLE";
      familyId: "opponent_strength_join";
      joins: Array<{
        historicalFixtureId: string;
        historicalKickoffUtc: string;
        opponentTeamId: string;
        strengthAsOfKickoffM: number;
        source: "catalogue" | "base_prior";
        played: number;
        cutoffUtc: string;
        semantics: Pe4I19StrengthJoinValue["semantics"];
        comparableToVenueSpecificC0Elo: false;
      }>;
      observationCount: number;
      audit: JoinAudit;
    }
  | {
      status: "UNAVAILABLE";
      familyId: "opponent_strength_join";
      reason: string;
      detail: string;
      contractCutoffRule: typeof PE4I15_OPPONENT_STRENGTH_CONTRACT.cutoffRule;
      observationCount: number;
      audit: JoinAudit;
    };

function unavailable(
  reason: string,
  detail: string,
  audit: JoinAudit,
): Pe4I16OpponentStrengthJoin {
  return {
    status: "UNAVAILABLE",
    familyId: "opponent_strength_join",
    reason,
    detail,
    contractCutoffRule: PE4I15_OPPONENT_STRENGTH_CONTRACT.cutoffRule,
    observationCount: audit.matchedCount,
    audit,
  };
}

export function joinOpponentStrengthAsOfKickoffM(input: {
  selectedHistory: readonly Pe4I16TeamPerspectiveRow[];
  targetKickoffUtc: string;
  strengthByOpponentAndKickoffM?: ReadonlyMap<string, Pe4I19StrengthJoinValue>;
}): Pe4I16OpponentStrengthJoin {
  const minimumObservations = PE4I15_OPPONENT_STRENGTH_CONTRACT.minObservations;
  const table = input.strengthByOpponentAndKickoffM;
  const emptyAudit: JoinAudit = {
    selectedHistoryCount: input.selectedHistory.length,
    matchedCount: 0,
    missingCount: input.selectedHistory.length,
    missingKeys: input.selectedHistory.map((row) =>
      pe4I19StrengthJoinKey(row.opponentTeamId, row.kickoffUtc),
    ),
    minimumObservations,
    complete: false,
  };
  if (!table || table.size === 0) {
    return unavailable(
      PE4I16_OPPONENT_STRENGTH_UNAVAILABLE_REASON,
      "No offline as-of-kickoff(M) common-baseline strength catalogue was supplied.",
      emptyAudit,
    );
  }

  const joins: Extract<Pe4I16OpponentStrengthJoin, { status: "AVAILABLE" }>["joins"] = [];
  const missingKeys: string[] = [];
  for (const row of input.selectedHistory) {
    const guard = assertOpponentStrengthCutoffIsKickoffM({
      strengthCutoffUtc: row.kickoffUtc,
      historicalKickoffUtc: row.kickoffUtc,
      targetKickoffUtc: input.targetKickoffUtc,
    });
    const key = pe4I19StrengthJoinKey(row.opponentTeamId, row.kickoffUtc);
    const strength = table.get(key);
    if (
      !guard.ok ||
      !strength ||
      strength.cutoffUtc !== row.kickoffUtc ||
      strength.teamId !== row.opponentTeamId ||
      !Number.isFinite(strength.strengthAsOfKickoffM) ||
      strength.comparableToVenueSpecificC0Elo !== false
    ) {
      missingKeys.push(key);
      continue;
    }
    joins.push({
      historicalFixtureId: row.fixtureId,
      historicalKickoffUtc: row.kickoffUtc,
      opponentTeamId: row.opponentTeamId,
      strengthAsOfKickoffM: strength.strengthAsOfKickoffM,
      source: strength.source,
      played: strength.played,
      cutoffUtc: strength.cutoffUtc,
      semantics: strength.semantics,
      comparableToVenueSpecificC0Elo: false,
    });
  }

  const audit: JoinAudit = {
    selectedHistoryCount: input.selectedHistory.length,
    matchedCount: joins.length,
    missingCount: missingKeys.length,
    missingKeys: missingKeys.sort((a, b) => a.localeCompare(b)),
    minimumObservations,
    complete: missingKeys.length === 0,
  };
  if (!audit.complete) {
    return unavailable(
      "incomplete_strength_join_coverage",
      "At least one selected historical row lacks valid common-baseline strength evidence; partial joins cannot activate the family.",
      audit,
    );
  }
  if (joins.length < minimumObservations) {
    return unavailable(
      "insufficient_strength_join_observations",
      `Complete join has ${joins.length} observations; minimum is ${minimumObservations}.`,
      audit,
    );
  }
  return {
    status: "AVAILABLE",
    familyId: "opponent_strength_join",
    joins,
    observationCount: joins.length,
    audit,
  };
}

export function joinOpponentStrengthFromPe4I19Catalogue(input: {
  selectedHistory: readonly Pe4I16TeamPerspectiveRow[];
  targetKickoffUtc: string;
  catalogue: Pe4I19StrengthCatalogue;
}): Pe4I16OpponentStrengthJoin {
  return joinOpponentStrengthAsOfKickoffM({
    selectedHistory: input.selectedHistory,
    targetKickoffUtc: input.targetKickoffUtc,
    strengthByOpponentAndKickoffM: input.catalogue.strengthByTeamAndKickoffM,
  });
}
