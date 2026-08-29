/**
 * Pairwise correlation flags for accumulator risk.
 * Does not invent a covariance model beyond published structural links.
 */

import type {
  ComboCorrelationKind,
  ComboCorrelationReport,
  ComboLeg,
  ComboPairCorrelation,
} from "@/lib/smart-combos/types";

const RHO: Record<ComboCorrelationKind, number> = {
  same_fixture_conflict: 1,
  same_fixture_duplicate: 1,
  same_team: 0.42,
  same_league: 0.16,
  same_kickoff_window: 0.08,
};

const KICKOFF_WINDOW_MS = 3 * 60 * 60 * 1000;

function teamNames(leg: ComboLeg): string[] {
  return [leg.home.name, leg.away.name].map((name) => name.trim().toLowerCase());
}

function classifyPair(left: ComboLeg, right: ComboLeg): ComboPairCorrelation | null {
  if (left.fixtureId === right.fixtureId) {
    const kind: ComboCorrelationKind =
      left.predicted === right.predicted
        ? "same_fixture_duplicate"
        : "same_fixture_conflict";
    return {
      leftFixtureId: left.fixtureId,
      rightFixtureId: right.fixtureId,
      kind,
      rho: RHO[kind],
      detail:
        kind === "same_fixture_duplicate"
          ? `${left.selectionLabel} is listed twice on the same fixture.`
          : `${left.selectionLabel} and ${right.selectionLabel} cannot both win the same 1X2 market.`,
    };
  }

  const leftTeams = new Set(teamNames(left));
  if (teamNames(right).some((name) => leftTeams.has(name))) {
    return {
      leftFixtureId: left.fixtureId,
      rightFixtureId: right.fixtureId,
      kind: "same_team",
      rho: RHO.same_team,
      detail: `A club appears on both ${left.home.shortName}–${left.away.shortName} and ${right.home.shortName}–${right.away.shortName}.`,
    };
  }

  if (left.leagueName === right.leagueName) {
    return {
      leftFixtureId: left.fixtureId,
      rightFixtureId: right.fixtureId,
      kind: "same_league",
      rho: RHO.same_league,
      detail: `Both selections sit in ${left.leagueName}, so form and scheduling shocks can move together.`,
    };
  }

  const t0 = Date.parse(left.kickoffAt);
  const t1 = Date.parse(right.kickoffAt);
  if (
    Number.isFinite(t0) &&
    Number.isFinite(t1) &&
    Math.abs(t0 - t1) <= KICKOFF_WINDOW_MS
  ) {
    return {
      leftFixtureId: left.fixtureId,
      rightFixtureId: right.fixtureId,
      kind: "same_kickoff_window",
      rho: RHO.same_kickoff_window,
      detail: "Kickoffs fall inside a three-hour window, so broadcast and weather clustering is possible.",
    };
  }

  return null;
}

export function correlationMatrix(legs: ComboLeg[]): number[][] {
  const n = legs.length;
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j): number => (i === j ? 1 : 0)),
  );
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const pair = classifyPair(legs[i]!, legs[j]!);
      const rho = pair?.rho ?? 0;
      matrix[i]![j] = rho;
      matrix[j]![i] = rho;
    }
  }
  return matrix;
}

export function analyzeCorrelation(legs: ComboLeg[]): ComboCorrelationReport {
  const pairs: ComboPairCorrelation[] = [];
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const pair = classifyPair(legs[i]!, legs[j]!);
      if (pair) pairs.push(pair);
    }
  }

  const hasConflict = pairs.some((pair) => pair.kind === "same_fixture_conflict");
  const hasDuplicate = pairs.some((pair) => pair.kind === "same_fixture_duplicate");
  const maxRho = pairs.reduce((max, pair) => Math.max(max, pair.rho), 0);
  const meanRho =
    pairs.length === 0
      ? 0
      : pairs.reduce((sum, pair) => sum + pair.rho, 0) / pairs.length;
  const penalty = hasConflict || hasDuplicate ? 1 : Math.min(0.45, meanRho * 0.85 + maxRho * 0.25);

  let summary = "No structural correlation detected between these selections.";
  if (hasConflict) {
    summary =
      "This slip contains mutually exclusive 1X2 outcomes. Combined probability is zero.";
  } else if (hasDuplicate) {
    summary = "A selection is duplicated. Remove the extra leg before pricing the combo.";
  } else if (pairs.length === 1) {
    summary = pairs[0]!.detail;
  } else if (pairs.length > 1) {
    summary = `${pairs.length} correlated pairs. Independence overstates the chance of hitting every leg.`;
  }

  return {
    pairs,
    maxRho,
    hasConflict,
    hasDuplicate,
    penalty,
    summary,
  };
}
