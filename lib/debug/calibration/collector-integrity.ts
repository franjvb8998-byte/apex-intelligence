/**
 * Offline collector integrity contracts.
 * Does not call API-Football. Does not modify the production client.
 *
 * Production getFixturesByLeague does not send `page` and listFixtures
 * discards paging. A future collector MUST read paging from the raw
 * fixtures response and either fetch every page or fail loudly.
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
 * Option B until the production client can request page=N:
 * refuse any season list that is not a proven single complete page.
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
      `Season list paging.total=${paging.total}; fetch every page before building a dataset (page support is not in the production client)`,
    );
  }
  if (paging.total !== 1 || paging.current !== 1) {
    throw new IncompleteSeasonListError(
      `Season list paging is not a complete single page (current=${paging.current}, total=${paging.total})`,
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
}): CollectionRunMetadata {
  const pageCounts = input.selectedLeagueSeasons.map((item) => item.pageCount);
  return {
    datasetSchemaVersion: CALIBRATION_SCHEMA_VERSION,
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    collectorVersion: CALIBRATION_COLLECTOR_VERSION,
    collectionTimestamp:
      input.collectionTimestamp ?? "not-collected-offline-harness",
    selectedLeagueSeasons: input.selectedLeagueSeasons,
    pageCounts,
    fixtureCountBeforeDedupe: input.fixtureCountBeforeDedupe,
    fixtureCountAfterDedupe: input.fixtureCountAfterDedupe,
    targetRowCount: input.rows.length,
    oddsCoverageCount: input.rows.filter(
      (row) => row.homeOdds != null && row.drawOdds != null && row.awayOdds != null,
    ).length,
    oddsTimingClassification: classifyOddsTiming(input.rows),
  };
}
