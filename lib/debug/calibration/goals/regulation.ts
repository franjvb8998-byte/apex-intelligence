/**
 * GOALS-1B — REGULATION_90_ONLY label resolution.
 */

import type {
  GoalsHistoricalFixture,
  GoalsMarketActualLabels,
  GoalsRegulationLabelSource,
  GoalsTargetLabels,
} from "@/lib/debug/calibration/goals/types";

export function deriveMarketLabels90(
  home: number,
  away: number,
): GoalsMarketActualLabels {
  const total = home + away;
  return {
    totalGoals90: total,
    over05: total >= 1,
    under05: total === 0,
    over15: total >= 2,
    under15: total <= 1,
    over25: total >= 3,
    under25: total <= 2,
    over35: total >= 4,
    under35: total <= 3,
    over45: total >= 5,
    under45: total <= 4,
    bttsYes: home >= 1 && away >= 1,
    bttsNo: home === 0 || away === 0,
    homeOver05: home >= 1,
    homeUnder05: home === 0,
    homeOver15: home >= 2,
    homeUnder15: home <= 1,
    homeOver25: home >= 3,
    homeUnder25: home <= 2,
    awayOver05: away >= 1,
    awayUnder05: away === 0,
    awayOver15: away >= 2,
    awayUnder15: away <= 1,
    awayOver25: away >= 3,
    awayUnder25: away <= 2,
  };
}

/**
 * Resolve regulation-90 goals. Never substitutes AET/PEN final for missing FT.
 *
 * Priority:
 * 1) explicit fulltime fields
 * 2) status === FT with goals fields
 * 3) otherwise unavailable (including AET/PEN without fulltime)
 */
export function resolveRegulation90Goals(input: {
  status: string | null;
  goalsHome: number | null;
  goalsAway: number | null;
  fulltimeHome: number | null;
  fulltimeAway: number | null;
}): {
  home: number | null;
  away: number | null;
  available: boolean;
  source: GoalsRegulationLabelSource;
} {
  const ftH = input.fulltimeHome;
  const ftA = input.fulltimeAway;
  if (
    ftH != null &&
    ftA != null &&
    Number.isFinite(ftH) &&
    Number.isFinite(ftA) &&
    ftH >= 0 &&
    ftA >= 0
  ) {
    return {
      home: ftH,
      away: ftA,
      available: true,
      source: "explicit_fulltime_fields",
    };
  }

  if (input.status === "FT") {
    const gH = input.goalsHome;
    const gA = input.goalsAway;
    if (
      gH != null &&
      gA != null &&
      Number.isFinite(gH) &&
      Number.isFinite(gA) &&
      gH >= 0 &&
      gA >= 0
    ) {
      return {
        home: gH,
        away: gA,
        available: true,
        source: "status_ft_goals_fields",
      };
    }
  }

  return {
    home: null,
    away: null,
    available: false,
    source: "unavailable",
  };
}

export function applyRegulationToFixture(
  fixture: Omit<
    GoalsHistoricalFixture,
    | "regulationHomeGoals"
    | "regulationAwayGoals"
    | "regulationGoalsAvailable"
    | "regulationLabelSource"
  >,
): GoalsHistoricalFixture {
  const resolved = resolveRegulation90Goals({
    status: fixture.status,
    goalsHome: fixture.sourceGoalsHome,
    goalsAway: fixture.sourceGoalsAway,
    fulltimeHome: fixture.sourceFulltimeHome,
    fulltimeAway: fixture.sourceFulltimeAway,
  });
  return {
    ...fixture,
    regulationHomeGoals: resolved.home,
    regulationAwayGoals: resolved.away,
    regulationGoalsAvailable: resolved.available,
    regulationLabelSource: resolved.source,
  };
}

/**
 * Research-only: treat calibration-row actual goals as regulation for PL league
 * populations when status/fulltime were not persisted. Explicit provenance.
 */
export function applyLeagueFtAssumption(
  fixture: GoalsHistoricalFixture,
): GoalsHistoricalFixture {
  if (fixture.regulationGoalsAvailable) return fixture;
  if (
    fixture.sourceGoalsHome == null ||
    fixture.sourceGoalsAway == null ||
    !Number.isFinite(fixture.sourceGoalsHome) ||
    !Number.isFinite(fixture.sourceGoalsAway)
  ) {
    return fixture;
  }
  return {
    ...fixture,
    regulationHomeGoals: fixture.sourceGoalsHome,
    regulationAwayGoals: fixture.sourceGoalsAway,
    regulationGoalsAvailable: true,
    regulationLabelSource: "calibration_actual_under_league_ft_assumption",
    status: fixture.status ?? "FT_ASSUMED",
  };
}

export function buildTargetLabels(
  fixture: GoalsHistoricalFixture,
): GoalsTargetLabels {
  if (
    !fixture.regulationGoalsAvailable ||
    fixture.regulationHomeGoals == null ||
    fixture.regulationAwayGoals == null
  ) {
    return {
      labelStatus: "UNAVAILABLE",
      reason:
        fixture.regulationLabelSource === "unavailable"
          ? "regulation90_label_unavailable"
          : "regulation90_label_unproven",
      regulationLabelSource: fixture.regulationLabelSource,
      actualHomeGoals90: null,
      actualAwayGoals90: null,
      actualTotalGoals90: null,
      actualGoalDifference90: null,
      marketLabels: null,
    };
  }
  const h = fixture.regulationHomeGoals;
  const a = fixture.regulationAwayGoals;
  return {
    labelStatus: "USED",
    reason: null,
    regulationLabelSource: fixture.regulationLabelSource,
    actualHomeGoals90: h,
    actualAwayGoals90: a,
    actualTotalGoals90: h + a,
    actualGoalDifference90: h - a,
    marketLabels: deriveMarketLabels90(h, a),
  };
}

/** Completed evidence eligible for historical attack/defense. */
export function isCompletedRegulationEvidence(
  fixture: GoalsHistoricalFixture,
): boolean {
  return fixture.regulationGoalsAvailable;
}
