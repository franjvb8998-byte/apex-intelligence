/**
 * Offline collector integrity contracts.
 * Does not call API-Football. Does not modify the production client.
 *
 * Production listFixtures still discards paging.
 * The debug collector uses unpaged getFixturesByLeague(league, season).
 * In-memory reconstruction still refuses paging.total > 1.
 */

import {
  CALIBRATION_COLLECTOR_VERSION,
  CALIBRATION_RECONSTRUCTION_VERSION,
  CALIBRATION_SCHEMA_VERSION,
  type CalibrationOddsTiming,
  type CalibrationRow,
  type CollectionRunMetadata,
  type ReconstructionFixture,
  type SeasonListPaging,
} from "@/lib/debug/calibration/types";
import {
  buildCalibrationRow,
  dedupeReconstructionFixtures,
  eligibleTargetGoals,
} from "@/lib/debug/calibration/reconstruct";

export class IncompleteSeasonListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompleteSeasonListError";
  }
}

export function planFixtureListPages(totalPages: number): number[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new IncompleteSeasonListError(
      "Season list page total must be a positive integer",
    );
  }
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

/**
 * Unpaged collector requires a single complete season envelope.
 * paging.total > 1 is refused; additional fixture pages are not fetched.
 */
export function assertSeasonListCompleteForCalibration(
  paging: SeasonListPaging | null | undefined,
): void {
  if (paging == null || !Number.isFinite(paging.current) || !Number.isFinite(paging.total)) {
    throw new IncompleteSeasonListError(
      "Season list paging.current / paging.total is missing; refusing incomplete calibration source",
    );
  }
  if (paging.total > 1) {
    throw new IncompleteSeasonListError(
      `Season list paging.total=${paging.total}; unpaged collector requires a single complete season envelope`,
    );
  }
  if (paging.total !== 1 || paging.current !== 1) {
    throw new IncompleteSeasonListError(
      `Season list paging is not a complete single envelope (current=${paging.current}, total=${paging.total})`,
    );
  }
}

export function prepareCalibrationFixtures(
  fixtures: readonly ReconstructionFixture[],
  paging?: SeasonListPaging | null,
): {
  fixtures: ReconstructionFixture[];
  beforeCount: number;
  afterCount: number;
} {
  if (paging !== undefined) {
    assertSeasonListCompleteForCalibration(paging);
  }
  return dedupeReconstructionFixtures(fixtures);
}

export function buildLabeledCalibrationRows(input: {
  fixtures: readonly ReconstructionFixture[];
  paging?: SeasonListPaging | null;
  category?: CalibrationRow["category"];
}): CalibrationRow[] {
  const prepared = prepareCalibrationFixtures(input.fixtures, input.paging);
  const rows: CalibrationRow[] = [];
  const seen = new Set<string>();
  for (const target of prepared.fixtures) {
    if (!eligibleTargetGoals(target)) continue;
    if (seen.has(target.fixtureId)) continue;
    seen.add(target.fixtureId);
    rows.push(
      buildCalibrationRow({
        target,
        fixtures: prepared.fixtures,
        category: input.category,
      }),
    );
  }
  return rows;
}

export function classifyOddsTiming(
  rows: readonly CalibrationRow[],
): Record<CalibrationOddsTiming, number> {
  const counts: Record<CalibrationOddsTiming, number> = {
    unknown: 0,
    vendor_update: 0,
    fetch_time: 0,
  };
  for (const row of rows) {
    counts[row.oddsTiming] += 1;
  }
  return counts;
}

export function createCollectionRunMetadata(input: {
  selectedLeagueSeasons: CollectionRunMetadata["selectedLeagueSeasons"];
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  rows: readonly CalibrationRow[];
  collectionTimestamp?: string;
  selectionRule?: string;
  requestedTargetCount?: number;
  fixtureListLogicalCalls?: number;
  oddsLogicalCalls?: number;
  logicalCallCount?: number;
  originCallCount?: number;
  leagueName?: string;
  collectorVersion?: string;
}): CollectionRunMetadata {
  const pageCounts = input.selectedLeagueSeasons.map((item) => item.pageCount);
  const logicalCallCount = input.logicalCallCount ?? input.originCallCount;
  const fixtureListLogicalCalls = input.fixtureListLogicalCalls;
  const oddsLogicalCalls = input.oddsLogicalCalls;
  return {
    datasetSchemaVersion: CALIBRATION_SCHEMA_VERSION,
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    collectorVersion: input.collectorVersion ?? CALIBRATION_COLLECTOR_VERSION,
    collectionTimestamp:
      input.collectionTimestamp ?? "not-collected-offline-harness",
    selectedLeagueSeasons: input.selectedLeagueSeasons,
    pageCounts,
    fixtureCountBeforeDedupe: input.fixtureCountBeforeDedupe,
    fixtureCountAfterDedupe: input.fixtureCountAfterDedupe,
    requestedTargetCount: input.requestedTargetCount,
    targetRowCount: input.rows.length,
    oddsCoverageCount: input.rows.filter(
      (row) => row.homeOdds != null && row.drawOdds != null && row.awayOdds != null,
    ).length,
    oddsTimingClassification: classifyOddsTiming(input.rows),
    selectionRule: input.selectionRule,
    fixtureListLogicalCalls,
    oddsLogicalCalls,
    logicalCallCount,
    originCallCount: logicalCallCount,
    callBudgetKind: "logical_lookups_not_origin_http_attempts",
    leagueName: input.leagueName,
  };
}
