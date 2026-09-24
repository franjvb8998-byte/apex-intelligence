/**
 * PE-4G.3 — Build canonical offline expectation dataset from CalibrationRow[].
 * Pure / deterministic. No network. No model fitting.
 */

import { CALIBRATION_RECONSTRUCTION_VERSION } from "@/lib/debug/calibration/types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";
import {
  buildPe4ExpectationDatasetRow,
  comparePe4ExpectationRows,
  pe4ExpectationCanonicalKey,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/build-row";
import { digestPe4ExpectationDataset } from "@/lib/prematch-decision/pe4-form-schedule/expectation/digest";
import { describePe4ExpectationDataset } from "@/lib/prematch-decision/pe4-form-schedule/expectation/descriptive";
import { buildPe4ExpectationSplitManifests } from "@/lib/prematch-decision/pe4-form-schedule/expectation/splits";
import {
  PE4_EXPECTATION_COMMON_BASELINE,
  PE4_EXPECTATION_DATASET_BUILDER_VERSION,
  PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
  type Pe4ExpectationDatasetManifest,
  type Pe4ExpectationDatasetRow,
  type Pe4ExpectationQualityKind,
  type Pe4ExpectationActualOutcome,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type BuildPe4ExpectationDatasetInput = {
  sourceRows: readonly CalibrationRow[];
  /** Basename-only source labels for manifest (no absolute paths). */
  sourceFileLabels?: readonly string[];
  commonBaseline?: number;
  /** Require kickoff_lt reconstruction version (default true). */
  requireProvenReconstruction?: boolean;
};

export type BuildPe4ExpectationDatasetResult = {
  rows: Pe4ExpectationDatasetRow[];
  manifest: Pe4ExpectationDatasetManifest;
  descriptive: ReturnType<typeof describePe4ExpectationDataset>;
  rejected: { fixtureId?: string; reason: string }[];
};

function emptyQuality(): Record<Pe4ExpectationQualityKind, number> {
  return {
    catalogue_catalogue: 0,
    catalogue_base_prior: 0,
    base_prior_catalogue: 0,
    base_prior_base_prior: 0,
    unavailable: 0,
  };
}

function emptyOutcomes(): Record<Pe4ExpectationActualOutcome, number> {
  return { HOME: 0, DRAW: 0, AWAY: 0 };
}

function materialSignature(row: Pe4ExpectationDatasetRow): string {
  return [
    row.kickoffUtc,
    row.homeTeamId,
    row.awayTeamId,
    String(row.homeCommonStrength),
    String(row.awayCommonStrength),
    row.homeStrengthSource,
    row.awayStrengthSource,
    String(row.homePlayed),
    String(row.awayPlayed),
    String(row.actualHomeGoals),
    String(row.actualAwayGoals),
    row.actualOutcome,
  ].join("|");
}

/**
 * Build deduped, sorted expectation dataset.
 * Conflicting duplicates fail closed (throw).
 */
export function buildPe4ExpectationDataset(
  input: BuildPe4ExpectationDatasetInput,
): BuildPe4ExpectationDatasetResult {
  const requireProven = input.requireProvenReconstruction !== false;
  const rejected: { fixtureId?: string; reason: string }[] = [];
  const byKey = new Map<string, Pe4ExpectationDatasetRow>();
  let identicalDuplicateCount = 0;
  let conflictingDuplicateCount = 0;

  for (const source of input.sourceRows) {
    if (
      requireProven &&
      source.reconstructionVersion !== CALIBRATION_RECONSTRUCTION_VERSION
    ) {
      rejected.push({
        fixtureId: source.fixtureId,
        reason: "unproven_reconstruction_version",
      });
      continue;
    }

    const built = buildPe4ExpectationDatasetRow(source, {
      commonBaseline: input.commonBaseline,
    });
    if (!built.ok) {
      rejected.push({ fixtureId: built.fixtureId, reason: built.reason });
      continue;
    }

    const key = pe4ExpectationCanonicalKey(built.row);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, built.row);
      continue;
    }
    if (materialSignature(existing) === materialSignature(built.row)) {
      identicalDuplicateCount += 1;
      continue;
    }
    conflictingDuplicateCount += 1;
    throw new Error(
      `Conflicting duplicate expectation row for ${key}`,
    );
  }

  const rows = [...byKey.values()].sort(comparePe4ExpectationRows);
  const qualityCounts = emptyQuality();
  const outcomeCounts = emptyOutcomes();
  const seasonCounts: Record<string, number> = {};
  let bothBasePriorCount = 0;
  for (const row of rows) {
    qualityCounts[row.qualityKind] += 1;
    outcomeCounts[row.actualOutcome] += 1;
    seasonCounts[row.season] = (seasonCounts[row.season] ?? 0) + 1;
    if (row.lowInformationBothBasePrior) bothBasePriorCount += 1;
  }

  const datasetDigest = digestPe4ExpectationDataset(rows);
  const splits = buildPe4ExpectationSplitManifests(rows);
  const descriptive = describePe4ExpectationDataset(rows);

  const manifest: Pe4ExpectationDatasetManifest = {
    schemaVersion: PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
    builderVersion: PE4_EXPECTATION_DATASET_BUILDER_VERSION,
    commonBaseline:
      (input.commonBaseline as typeof PE4_EXPECTATION_COMMON_BASELINE) ??
      PE4_EXPECTATION_COMMON_BASELINE,
    datasetDigest,
    rowCount: rows.length,
    rejectedCount: rejected.length,
    identicalDuplicateCount,
    conflictingDuplicateCount,
    qualityCounts,
    outcomeCounts,
    seasonCounts,
    bothBasePriorCount,
    kickoffMinUtc: rows[0]?.kickoffUtc ?? null,
    kickoffMaxUtc: rows[rows.length - 1]?.kickoffUtc ?? null,
    sourceFiles: [...(input.sourceFileLabels ?? [])].sort(),
    splits,
    notes: {
      competitionScope: "premier_league_39",
      temporalProvenance: "same_competition_season.kickoff_lt.v2",
      notProspectivePromotionData: true,
      noModelFitted: true,
      noBinsOptimized: true,
    },
  };

  return { rows, manifest, descriptive, rejected };
}
