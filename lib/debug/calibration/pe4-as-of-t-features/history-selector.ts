/**
 * PE-4I.16 — history(team, target, window) selector.
 * Enforces kickoff(M)<kickoff(T); rejects self/same/future/malformed/holdout-for-DEV.
 * Supports N=3,5,8,10 and days=30,60,90; venue filter all|home|away.
 */

import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";
import { filterEligibleHistoryForTarget } from "@/lib/debug/calibration/pe4-as-of-t-features/temporal-contract";
import {
  selectWindow,
  type Pe4I15WindowSpec,
  type Pe4I15SelectedWindow,
  type Pe4I15WindowId,
} from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import type { Pe4I16TeamPerspectiveRow } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import type { Pe4I16VenueRole } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";

export type Pe4I16VenueFilter = "all" | "home" | "away";

export type Pe4I16HistorySelection = {
  teamId: string;
  targetFixtureId: string;
  targetKickoffUtc: string;
  windowId: Pe4I15WindowId;
  venueFilter: Pe4I16VenueFilter;
  selected: Pe4I16TeamPerspectiveRow[];
  observationCount: number;
  competitionCounts: Record<string, number>;
  belowMinObservations: boolean;
  rejectedCount: number;
};

function venueRoleFilter(
  filter: Pe4I16VenueFilter,
): Pe4I16VenueRole | undefined {
  if (filter === "home") return "HOME";
  if (filter === "away") return "AWAY";
  return undefined;
}

/**
 * Select as-of-T history for a team against target T.
 * Calendar-2025 outcomes excluded from DEV/FEATURE_SELECTION pools by default.
 */
export function selectAsOfTHistory(input: {
  teamId: string;
  teamHistory: readonly Pe4I16TeamPerspectiveRow[];
  target: { fixtureId: string; kickoffUtc: string };
  window: Pe4I15WindowSpec;
  minObservations: number;
  venueFilter?: Pe4I16VenueFilter;
  /** Reject AET/PEN ambiguous rows (results/performance families). */
  rejectRegulationAmbiguous?: boolean;
  excludeCalendar2025HoldoutOutcomes?: boolean;
}): Pe4I15Result<Pe4I16HistorySelection> {
  const venueFilter = input.venueFilter ?? "all";
  const teamId = input.teamId.trim();
  if (!teamId) return pe4I15Err("malformed_teams", "empty teamId");

  const candidates = input.teamHistory
    .filter((r) => r.teamId === teamId)
    .map((r) => ({
      fixtureId: r.fixtureId,
      kickoffUtc: r.kickoffUtc,
      homeTeamId:
        r.venueRole === "HOME" ? r.teamId : r.opponentTeamId,
      awayTeamId:
        r.venueRole === "AWAY" ? r.teamId : r.opponentTeamId,
      status: r.status,
      regulationAmbiguous: r.regulationAmbiguity,
      incompleteStats: false,
      _row: r,
    }));

  const filtered = filterEligibleHistoryForTarget({
    candidates,
    target: input.target,
    excludeCalendar2025HoldoutOutcomes:
      input.excludeCalendar2025HoldoutOutcomes !== false,
    requireTeams: true,
    rejectRegulationAmbiguous: input.rejectRegulationAmbiguous === true,
    failOnDuplicates: true,
  });
  if (!filtered.ok) return filtered;

  const acceptedIds = new Set(filtered.value.accepted.map((a) => a.fixtureId));
  const eligibleRows = candidates
    .filter((c) => acceptedIds.has(c.fixtureId))
    .map((c) => c._row);

  const windowResult = selectWindow({
    eligibleChronological: eligibleRows.map((r) => ({
      fixtureId: r.fixtureId,
      kickoffUtc: r.kickoffUtc,
      competition: r.competition,
      venueRole: r.venueRole,
    })),
    targetKickoffUtc: input.target.kickoffUtc,
    window: input.window,
    minObservations: input.minObservations,
    venueRoleFilter: venueRoleFilter(venueFilter),
  });
  if (!windowResult.ok) return windowResult;

  const selectedIds = new Set(
    windowResult.value.selected.map((s) => s.fixtureId),
  );
  const selected = eligibleRows
    .filter((r) => selectedIds.has(r.fixtureId))
    .filter((r) => {
      const role = venueRoleFilter(venueFilter);
      return role == null || r.venueRole === role;
    })
    .sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });

  // Recompute competition counts from perspective rows (authoritative).
  const competitionCounts: Record<string, number> = {};
  for (const r of selected) {
    competitionCounts[r.competition] =
      (competitionCounts[r.competition] ?? 0) + 1;
  }

  return pe4I15Ok({
    teamId,
    targetFixtureId: input.target.fixtureId,
    targetKickoffUtc: input.target.kickoffUtc,
    windowId: windowResult.value.windowId,
    venueFilter,
    selected,
    observationCount: selected.length,
    competitionCounts,
    belowMinObservations: selected.length < input.minObservations,
    rejectedCount: filtered.value.rejected.length,
  });
}

/** Convenience: expose selected window metadata shape used by provenance. */
export function historySelectionToWindowMeta(
  selection: Pe4I16HistorySelection,
): Pick<
  Pe4I15SelectedWindow,
  "windowId" | "observationCount" | "competitionCounts" | "belowMinObservations"
> {
  return {
    windowId: selection.windowId,
    observationCount: selection.observationCount,
    competitionCounts: selection.competitionCounts,
    belowMinObservations: selection.belowMinObservations,
  };
}
