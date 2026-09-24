/**
 * PE-4G.3 — Deterministic dataset digest (order-independent of input shuffle).
 */

import { createHash } from "node:crypto";
import {
  comparePe4ExpectationRows,
  pe4ExpectationCanonicalKey,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/build-row";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import { PE4_EXPECTATION_DATASET_SCHEMA_VERSION } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export const PE4_EXPECTATION_DATASET_DIGEST_VERSION = "1" as const;

function rowMaterialLine(row: Pe4ExpectationDatasetRow): string {
  return [
    pe4ExpectationCanonicalKey(row),
    row.kickoffUtc,
    row.homeTeamId,
    row.awayTeamId,
    String(row.homeCommonStrength),
    String(row.awayCommonStrength),
    String(row.strengthDifferentialHome),
    row.homeStrengthSource,
    row.awayStrengthSource,
    String(row.homePlayed),
    String(row.awayPlayed),
    row.qualityKind,
    String(row.actualHomeGoals),
    String(row.actualAwayGoals),
    row.actualOutcome,
    String(row.actualGoalDifferenceHome),
    row.sourceReconstructionVersion,
  ].join("|");
}

export function digestPe4ExpectationDataset(
  rows: readonly Pe4ExpectationDatasetRow[],
): string {
  const sorted = [...rows].sort(comparePe4ExpectationRows);
  const payload = [
    `v${PE4_EXPECTATION_DATASET_DIGEST_VERSION}`,
    `schema=${PE4_EXPECTATION_DATASET_SCHEMA_VERSION}`,
    `n=${sorted.length}`,
    ...sorted.map(rowMaterialLine),
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function digestPe4ExpectationFixtureIds(
  fixtureIds: readonly string[],
): string {
  const sorted = [...fixtureIds].sort((a, b) => a.localeCompare(b));
  return createHash("sha256")
    .update(sorted.join("\n"), "utf8")
    .digest("hex");
}
