/**
 * GOALS-1B — Build GoalsTargetEvidence for one fixture.
 */

import {
  GOALS_EVIDENCE_BUILDER_VERSION,
  GOALS_EVIDENCE_SCHEMA_VERSION,
  GOALS_CROSS_COMPETITION_POLICY,
  GOALS_REGULATION_LABEL_POLICY,
  GOALS_TEMPORAL_RULE,
  type GoalsCommonStrengthSeam,
  type GoalsHistoricalFixture,
  type GoalsTargetEvidence,
} from "@/lib/debug/calibration/goals/types";
import { buildTargetLabels } from "@/lib/debug/calibration/goals/regulation";
import {
  buildLeagueEnvironment,
  buildTeamHistoricalEvidence,
} from "@/lib/debug/calibration/goals/history";
import { digestGoalsTargetEvidence } from "@/lib/debug/calibration/goals/digest";

export function buildGoalsTargetEvidence(input: {
  target: GoalsHistoricalFixture;
  universe: readonly GoalsHistoricalFixture[];
  commonStrength?: {
    homeCommonStrength: number;
    awayCommonStrength: number;
    strengthDifferentialHome: number;
  } | null;
}): GoalsTargetEvidence {
  const { target } = input;
  if (target.homeTeamId === target.awayTeamId) {
    throw new Error(`identical_home_away: ${target.fixtureId}`);
  }
  if (!Number.isFinite(Date.parse(target.kickoffUtc))) {
    throw new Error(`invalid_kickoff: ${target.fixtureId}`);
  }

  const labels = buildTargetLabels(target);
  const homeEvidence = buildTeamHistoricalEvidence({
    teamId: target.homeTeamId,
    target,
    universe: input.universe,
  });
  const awayEvidence = buildTeamHistoricalEvidence({
    teamId: target.awayTeamId,
    target,
    universe: input.universe,
  });
  const leagueEnvironment = buildLeagueEnvironment({
    target,
    universe: input.universe,
  });

  const commonStrengthSeam: GoalsCommonStrengthSeam = input.commonStrength
    ? {
        semantics: "common_fixed_baseline_index_not_venue_role_elo",
        comparableToVenueSpecificC0Elo: false,
        status: "USED",
        reason: null,
        homeCommonStrength: input.commonStrength.homeCommonStrength,
        awayCommonStrength: input.commonStrength.awayCommonStrength,
        strengthDifferentialHome: input.commonStrength.strengthDifferentialHome,
      }
    : {
        semantics: "common_fixed_baseline_index_not_venue_role_elo",
        comparableToVenueSpecificC0Elo: false,
        status: "UNAVAILABLE",
        reason: "common_strength_unavailable",
        homeCommonStrength: null,
        awayCommonStrength: null,
        strengthDifferentialHome: null,
      };

  const base: Omit<GoalsTargetEvidence, "digest"> = {
    fixtureId: target.fixtureId,
    competitionId: target.competitionId,
    season: target.season,
    kickoffUtc: target.kickoffUtc,
    homeTeamId: target.homeTeamId,
    awayTeamId: target.awayTeamId,
    historicalCutoffUtc: target.kickoffUtc,
    labels,
    homeEvidence,
    awayEvidence,
    leagueEnvironment,
    commonStrengthSeam,
    opponentAdjustmentSeam: {
      status: "DEFERRED_TO_GOALS_1D",
      note: "Opponent rates as-of each prior match M are reconstructible via kickoff_lt(M) but not attached numerically in 1B.",
    },
    provenance: {
      schemaVersion: GOALS_EVIDENCE_SCHEMA_VERSION,
      evidenceVersion: GOALS_EVIDENCE_BUILDER_VERSION,
      historicalCutoffUtc: target.kickoffUtc,
      competitionId: target.competitionId,
      season: target.season,
      regulationLabelPolicy: GOALS_REGULATION_LABEL_POLICY,
      temporalRule: GOALS_TEMPORAL_RULE,
      crossCompetitionPolicy: GOALS_CROSS_COMPETITION_POLICY,
      homePlayedAll: homeEvidence.allVenues.played,
      awayPlayedAll: awayEvidence.allVenues.played,
      leagueMatchesPlayedBefore: leagueEnvironment.leagueMatchesPlayedBefore,
      regulationLabelSource: labels.regulationLabelSource,
      homeAdvantageEncoded: false,
      fittedModelPresent: false,
    },
  };

  return { ...base, digest: digestGoalsTargetEvidence(base) };
}
