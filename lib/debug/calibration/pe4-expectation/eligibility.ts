/**
 * PE-4G.4 — Eligibility + holdout guards.
 */

import {
  PE4_EXPECTATION_POC_FIT_ELIGIBILITY,
  PE4_EXPECTATION_POC_HOLDOUT_SEASON,
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
  PE4_EXPECTATION_POC_TRAIN_SEASON,
  PE4_EXPECTATION_POC_VALIDATION_SEASON,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import type { Pe4ExpectationDatasetManifest } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export function assertPe4ExpectationPocDatasetIntegrity(
  manifest: Pe4ExpectationDatasetManifest,
): void {
  if (manifest.datasetDigest !== PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST) {
    throw new Error(
      `Dataset digest mismatch: got ${manifest.datasetDigest}, expected ${PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST}`,
    );
  }
  const byName = Object.fromEntries(
    manifest.splits.map((s) => [s.name, s]),
  );
  if (byName.DEVELOPMENT?.rowCount !== 380) {
    throw new Error("DEVELOPMENT split must have n=380");
  }
  if (byName.VALIDATION?.rowCount !== 380) {
    throw new Error("VALIDATION split must have n=380");
  }
  if (byName.HOLDOUT_RESERVED?.rowCount !== 380) {
    throw new Error("HOLDOUT_RESERVED split must have n=380");
  }
}

export function rejectHoldoutSeasonRows(
  rows: readonly Pe4ExpectationDatasetRow[],
): Pe4ExpectationDatasetRow[] {
  for (const row of rows) {
    if (row.season === PE4_EXPECTATION_POC_HOLDOUT_SEASON) {
      throw new Error(
        `Holdout season ${PE4_EXPECTATION_POC_HOLDOUT_SEASON} fixture ${row.fixtureId} must not enter POC train/eval path`,
      );
    }
  }
  return [...rows];
}

export function selectSeasonRows(
  rows: readonly Pe4ExpectationDatasetRow[],
  season: string,
): Pe4ExpectationDatasetRow[] {
  const selected = rows.filter((r) => r.season === season);
  if (season === PE4_EXPECTATION_POC_HOLDOUT_SEASON) {
    throw new Error("Cannot select holdout season for POC evaluation");
  }
  return rejectHoldoutSeasonRows(selected);
}

export function isFitEligible(row: Pe4ExpectationDatasetRow): boolean {
  if (PE4_EXPECTATION_POC_FIT_ELIGIBILITY === "catalogue_catalogue_only") {
    return row.qualityKind === "catalogue_catalogue";
  }
  return false;
}

export function filterFitEligible(
  rows: readonly Pe4ExpectationDatasetRow[],
): Pe4ExpectationDatasetRow[] {
  return rejectHoldoutSeasonRows(rows).filter(isFitEligible);
}

export function loadTrainValidationRows(
  allRows: readonly Pe4ExpectationDatasetRow[],
): {
  trainAll: Pe4ExpectationDatasetRow[];
  trainEligible: Pe4ExpectationDatasetRow[];
  validationAll: Pe4ExpectationDatasetRow[];
  validationCatalogue: Pe4ExpectationDatasetRow[];
  validationBothBasePrior: Pe4ExpectationDatasetRow[];
} {
  // Explicitly never select 2025.
  const trainAll = selectSeasonRows(
    allRows,
    PE4_EXPECTATION_POC_TRAIN_SEASON,
  );
  const validationAll = selectSeasonRows(
    allRows,
    PE4_EXPECTATION_POC_VALIDATION_SEASON,
  );
  return {
    trainAll,
    trainEligible: filterFitEligible(trainAll),
    validationAll,
    validationCatalogue: validationAll.filter(
      (r) => r.qualityKind === "catalogue_catalogue",
    ),
    validationBothBasePrior: validationAll.filter(
      (r) => r.lowInformationBothBasePrior,
    ),
  };
}
