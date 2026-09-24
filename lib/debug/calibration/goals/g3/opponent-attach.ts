/**
 * GOALS-1E — Attach PE-4 common-baseline opponent strength as-of historical M.
 *
 * Uses resolveHistoricalCommonBaselineStrength unchanged:
 * kickoff < kickoff(M), M excluded, same-kickoff excluded.
 */

import { createHash } from "node:crypto";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import {
  createPe4HistoricalStrengthMemo,
  resolveHistoricalCommonBaselineStrength,
  type Pe4HistoricalStrengthMemo,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import { priorFixturesForTarget } from "@/lib/debug/calibration/goals/history";
import { isCompletedRegulationEvidence } from "@/lib/debug/calibration/goals/regulation";

export type GoalsG3OpponentStrengthSource =
  | "catalogue"
  | "base_prior"
  | "unavailable";

export type GoalsG3HistoricalMatchContribution = {
  fixtureId: string;
  kickoffUtc: string;
  venue: "HOME" | "AWAY";
  opponentTeamId: string;
  rawGoalsFor: number;
  rawGoalsAgainst: number;
  opponentCommonStrengthAsOfM: number | null;
  opponentStrengthSource: GoalsG3OpponentStrengthSource;
  opponentStrengthPlayed: number | null;
  opponentStrengthCutoffUtc: string;
  opponentStrengthQuality: GoalsG3OpponentStrengthSource;
  attackAdjustment: number;
  defenseAdjustment: number;
  adjustedGoalsFor: number;
  adjustedGoalsAgainst: number;
};

export function goalsFixtureToStrengthUniverse(
  fixtures: readonly GoalsHistoricalFixture[],
): PrematchStrengthUniverseFixture[] {
  return fixtures.map((f) => {
    // PE-3 completed-status accepts only FT/AET/PEN. Research league FT
    // assumption uses FT_ASSUMED on GoalsHistoricalFixture — map to FT for
    // strength reconstruction when regulation goals are available under that
    // explicit assumption (does not change Goals label provenance).
    const statusForStrength = f.regulationGoalsAvailable
      ? f.status === "AET" || f.status === "PEN"
        ? f.status
        : "FT"
      : (f.status ?? "NS");
    return {
      fixtureId: f.fixtureId,
      kickoffUtc: f.kickoffUtc,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      competitionId: f.competitionId,
      season: f.season,
      status: statusForStrength,
      homeGoals: f.regulationHomeGoals,
      awayGoals: f.regulationAwayGoals,
    };
  });
}

function teamPerspective(
  fixture: GoalsHistoricalFixture,
  teamId: string,
): {
  goalsFor: number;
  goalsAgainst: number;
  venue: "HOME" | "AWAY";
  opponentTeamId: string;
} | null {
  if (!fixture.regulationGoalsAvailable) return null;
  if (fixture.homeTeamId === teamId) {
    return {
      goalsFor: fixture.regulationHomeGoals!,
      goalsAgainst: fixture.regulationAwayGoals!,
      venue: "HOME",
      opponentTeamId: fixture.awayTeamId,
    };
  }
  if (fixture.awayTeamId === teamId) {
    return {
      goalsFor: fixture.regulationAwayGoals!,
      goalsAgainst: fixture.regulationHomeGoals!,
      venue: "AWAY",
      opponentTeamId: fixture.homeTeamId,
    };
  }
  return null;
}

export function listVenueRolePriorsWithOpponents(input: {
  teamId: string;
  venue: "HOME" | "AWAY";
  target: GoalsHistoricalFixture;
  goalsUniverse: readonly GoalsHistoricalFixture[];
  strengthUniverse: readonly PrematchStrengthUniverseFixture[];
  memo?: Pe4HistoricalStrengthMemo;
  attackAdjustmentFn: (opp: {
    strength: number | null;
    source: GoalsG3OpponentStrengthSource;
  }) => number;
  defenseAdjustmentFn: (opp: {
    strength: number | null;
    source: GoalsG3OpponentStrengthSource;
  }) => number;
}): GoalsG3HistoricalMatchContribution[] {
  const memo = input.memo ?? createPe4HistoricalStrengthMemo();
  const priors = priorFixturesForTarget(input.target, input.goalsUniverse);
  const out: GoalsG3HistoricalMatchContribution[] = [];

  for (const f of priors) {
    if (!isCompletedRegulationEvidence(f)) continue;
    const persp = teamPerspective(f, input.teamId);
    if (!persp || persp.venue !== input.venue) continue;

    const raw = resolveHistoricalCommonBaselineStrength({
      teamId: persp.opponentTeamId,
      matchFixtureId: f.fixtureId,
      matchKickoffUtc: f.kickoffUtc,
      competitionId: f.competitionId,
      season: f.season,
      universe: input.strengthUniverse,
      memo,
    });

    let source: GoalsG3OpponentStrengthSource = "unavailable";
    if (raw.available && raw.source === "catalogue") source = "catalogue";
    else if (raw.available && raw.source === "base_prior") source = "base_prior";

    const opp = {
      strength: raw.available ? raw.strengthAsOfCutoff : null,
      source,
    };
    const attackAdjustment = input.attackAdjustmentFn(opp);
    const defenseAdjustment = input.defenseAdjustmentFn(opp);

    out.push({
      fixtureId: f.fixtureId,
      kickoffUtc: f.kickoffUtc,
      venue: persp.venue,
      opponentTeamId: persp.opponentTeamId,
      rawGoalsFor: persp.goalsFor,
      rawGoalsAgainst: persp.goalsAgainst,
      opponentCommonStrengthAsOfM: opp.strength,
      opponentStrengthSource: source,
      opponentStrengthPlayed: raw.played,
      opponentStrengthCutoffUtc: f.kickoffUtc,
      opponentStrengthQuality: source,
      attackAdjustment,
      defenseAdjustment,
      adjustedGoalsFor: persp.goalsFor * attackAdjustment,
      adjustedGoalsAgainst: persp.goalsAgainst * defenseAdjustment,
    });
  }
  return out;
}

export function digestG3Contributions(
  contributions: readonly GoalsG3HistoricalMatchContribution[],
): string {
  const material = contributions.map((c) => ({
    fixtureId: c.fixtureId,
    kickoffUtc: c.kickoffUtc,
    venue: c.venue,
    opponentTeamId: c.opponentTeamId,
    rawGoalsFor: c.rawGoalsFor,
    rawGoalsAgainst: c.rawGoalsAgainst,
    opponentCommonStrengthAsOfM: c.opponentCommonStrengthAsOfM,
    opponentStrengthSource: c.opponentStrengthSource,
    opponentStrengthPlayed: c.opponentStrengthPlayed,
    attackAdjustment: c.attackAdjustment,
    defenseAdjustment: c.defenseAdjustment,
    adjustedGoalsFor: c.adjustedGoalsFor,
    adjustedGoalsAgainst: c.adjustedGoalsAgainst,
  }));
  return createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");
}
