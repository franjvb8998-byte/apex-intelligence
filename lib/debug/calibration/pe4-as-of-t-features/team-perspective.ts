/**
 * PE-4I.16 — Fixture ledger → team-perspective history rows (both sides).
 */

import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import type { Pe4I15HoldoutClassification } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import type { Pe4I15PresenceNumeric } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

export type Pe4I16VenueRole = "HOME" | "AWAY";

export type Pe4I16TeamPerspectiveRow = {
  teamId: string;
  fixtureId: string;
  kickoffUtc: string;
  venueRole: Pe4I16VenueRole;
  opponentTeamId: string;
  competition: string;
  providerSeason: string;
  status: string;
  regulationAmbiguity: boolean;
  holdoutClassification: Pe4I15HoldoutClassification;
  goalsFor: Pe4I15PresenceNumeric;
  goalsAgainst: Pe4I15PresenceNumeric;
  expectedGoalsFor: Pe4I15PresenceNumeric;
  expectedGoalsAgainst: Pe4I15PresenceNumeric;
  shotsFor: Pe4I15PresenceNumeric;
  shotsAgainst: Pe4I15PresenceNumeric;
  shotsOnTargetFor: Pe4I15PresenceNumeric;
  shotsOnTargetAgainst: Pe4I15PresenceNumeric;
  possessionFor: Pe4I15PresenceNumeric;
  possessionAgainst: Pe4I15PresenceNumeric;
  cornersFor: Pe4I15PresenceNumeric;
  cornersAgainst: Pe4I15PresenceNumeric;
  yellowCardsFor: Pe4I15PresenceNumeric;
  yellowCardsAgainst: Pe4I15PresenceNumeric;
  redCardsFor: Pe4I15PresenceNumeric;
  redCardsAgainst: Pe4I15PresenceNumeric;
};

function sidePerspective(
  row: Pe4I15HistoricalMatchLedgerRow,
  venueRole: Pe4I16VenueRole,
): Pe4I16TeamPerspectiveRow {
  const self = venueRole === "HOME" ? row.home : row.away;
  const opp = venueRole === "HOME" ? row.away : row.home;
  return {
    teamId: self.teamId,
    fixtureId: row.fixtureId,
    kickoffUtc: row.kickoffUtc,
    venueRole,
    opponentTeamId: opp.teamId,
    competition: row.competition,
    providerSeason: row.providerSeason,
    status: row.status,
    regulationAmbiguity: row.regulationAmbiguity,
    holdoutClassification: row.holdoutClassification,
    goalsFor: self.goals,
    goalsAgainst: opp.goals,
    expectedGoalsFor: self.expectedGoals,
    expectedGoalsAgainst: opp.expectedGoals,
    shotsFor: self.shots,
    shotsAgainst: opp.shots,
    shotsOnTargetFor: self.shotsOnTarget,
    shotsOnTargetAgainst: opp.shotsOnTarget,
    possessionFor: self.possession,
    possessionAgainst: opp.possession,
    cornersFor: self.corners,
    cornersAgainst: opp.corners,
    yellowCardsFor: self.yellowCards,
    yellowCardsAgainst: opp.yellowCards,
    redCardsFor: self.redCards,
    redCardsAgainst: opp.redCards,
  };
}

/**
 * Expand fixture ledger rows into two team-perspective rows each.
 * Deterministic: sorted by kickoff asc, fixtureId asc, then HOME before AWAY.
 */
export function expandTeamPerspectiveHistory(
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[],
): Pe4I16TeamPerspectiveRow[] {
  const out: Pe4I16TeamPerspectiveRow[] = [];
  const sorted = [...ledger].sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });
  for (const row of sorted) {
    out.push(sidePerspective(row, "HOME"));
    out.push(sidePerspective(row, "AWAY"));
  }
  return out;
}

export type Pe4I16TeamPerspectiveCounts = {
  ledgerRows: number;
  teamPerspectiveRows: number;
  uniqueTeams: number;
  byVenueRole: { HOME: number; AWAY: number };
  calendar2025Rows: number;
  regulationAmbiguousRows: number;
};

export function countTeamPerspective(
  rows: readonly Pe4I16TeamPerspectiveRow[],
  ledgerRowCount: number,
): Pe4I16TeamPerspectiveCounts {
  const teams = new Set<string>();
  let home = 0;
  let away = 0;
  let calendar2025Rows = 0;
  let regulationAmbiguousRows = 0;
  for (const r of rows) {
    teams.add(r.teamId);
    if (r.venueRole === "HOME") home += 1;
    else away += 1;
    if (r.holdoutClassification === "calendar_2025_sealed_outcome") {
      calendar2025Rows += 1;
    }
    if (r.regulationAmbiguity) regulationAmbiguousRows += 1;
  }
  return {
    ledgerRows: ledgerRowCount,
    teamPerspectiveRows: rows.length,
    uniqueTeams: teams.size,
    byVenueRole: { HOME: home, AWAY: away },
    calendar2025Rows,
    regulationAmbiguousRows,
  };
}

/** Filter perspective rows for a single team (chronological). */
export function teamHistoryFor(
  rows: readonly Pe4I16TeamPerspectiveRow[],
  teamId: string,
): Pe4I16TeamPerspectiveRow[] {
  return rows
    .filter((r) => r.teamId === teamId)
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });
}
