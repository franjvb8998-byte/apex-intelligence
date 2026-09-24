/**
 * GOALS-1B — Normalize / dedupe GoalsHistoricalFixture universe.
 */

import { applyRegulationToFixture } from "@/lib/debug/calibration/goals/regulation";
import type { GoalsHistoricalFixture } from "@/lib/debug/calibration/goals/types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export function compareGoalsFixtures(
  a: GoalsHistoricalFixture,
  b: GoalsHistoricalFixture,
): number {
  const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
  if (k !== 0) return k;
  return a.fixtureId.localeCompare(b.fixtureId);
}

function materialSignature(f: GoalsHistoricalFixture): string {
  return [
    f.kickoffUtc,
    f.competitionId,
    f.season,
    f.homeTeamId,
    f.awayTeamId,
    f.status ?? "",
    String(f.sourceGoalsHome),
    String(f.sourceGoalsAway),
    String(f.sourceFulltimeHome),
    String(f.sourceFulltimeAway),
  ].join("|");
}

export function normalizeGoalsHistoricalUniverse(
  raw: readonly GoalsHistoricalFixture[],
): {
  fixtures: GoalsHistoricalFixture[];
  beforeCount: number;
  afterCount: number;
  identicalDuplicateCount: number;
} {
  const byId = new Map<string, GoalsHistoricalFixture>();
  let identicalDuplicateCount = 0;
  for (const row of raw) {
    const normalized = applyRegulationToFixture(row);
    if (!normalized.fixtureId) {
      throw new Error("malformed_fixture: missing fixtureId");
    }
    if (!normalized.competitionId) {
      throw new Error("missing_competition");
    }
    if (!normalized.season) {
      throw new Error("missing_season");
    }
    if (
      !normalized.kickoffUtc ||
      !Number.isFinite(Date.parse(normalized.kickoffUtc))
    ) {
      throw new Error(`invalid_kickoff: ${normalized.fixtureId}`);
    }
    if (normalized.homeTeamId === normalized.awayTeamId) {
      throw new Error(`identical_home_away: ${normalized.fixtureId}`);
    }
    const existing = byId.get(normalized.fixtureId);
    if (!existing) {
      byId.set(normalized.fixtureId, normalized);
      continue;
    }
    if (materialSignature(existing) !== materialSignature(normalized)) {
      throw new Error(`conflicting_duplicate: ${normalized.fixtureId}`);
    }
    identicalDuplicateCount += 1;
  }
  const fixtures = [...byId.values()].sort(compareGoalsFixtures);
  return {
    fixtures,
    beforeCount: raw.length,
    afterCount: fixtures.length,
    identicalDuplicateCount,
  };
}

/**
 * Map CalibrationRow → GoalsHistoricalFixture without inventing status/fulltime.
 * Regulation availability remains false until league FT assumption is applied.
 */
export function calibrationRowToGoalsFixture(
  row: CalibrationRow,
): GoalsHistoricalFixture {
  return applyRegulationToFixture({
    fixtureId: row.fixtureId,
    kickoffUtc: row.kickoff,
    status: null,
    competitionId: row.competitionId,
    season: row.season,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    sourceGoalsHome: row.actualHomeGoals,
    sourceGoalsAway: row.actualAwayGoals,
    sourceFulltimeHome: null,
    sourceFulltimeAway: null,
  });
}
