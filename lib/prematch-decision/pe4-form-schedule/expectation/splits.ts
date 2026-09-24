/**
 * PE-4G.3 — Temporal split manifests (no random shuffle).
 * All PE-4G.3 PL seasons are development/POC — not prospective promotion.
 */

import { digestPe4ExpectationFixtureIds } from "@/lib/prematch-decision/pe4-form-schedule/expectation/digest";
import type {
  Pe4ExpectationDatasetRow,
  Pe4ExpectationSplitManifest,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

/**
 * Season-based research partitions for PL 2023/2024/2025 populations.
 * Explicitly not untouched final promotion evidence.
 */
export const PE4_EXPECTATION_DEFAULT_SEASON_SPLITS = {
  DEVELOPMENT: ["2023"],
  VALIDATION: ["2024"],
  HOLDOUT_RESERVED: ["2025"],
} as const;

export function assignPe4ExpectationSplitName(
  season: string,
): Pe4ExpectationSplitManifest["name"] | null {
  if (
    (PE4_EXPECTATION_DEFAULT_SEASON_SPLITS.DEVELOPMENT as readonly string[]).includes(
      season,
    )
  ) {
    return "DEVELOPMENT";
  }
  if (
    (PE4_EXPECTATION_DEFAULT_SEASON_SPLITS.VALIDATION as readonly string[]).includes(
      season,
    )
  ) {
    return "VALIDATION";
  }
  if (
    (
      PE4_EXPECTATION_DEFAULT_SEASON_SPLITS.HOLDOUT_RESERVED as readonly string[]
    ).includes(season)
  ) {
    return "HOLDOUT_RESERVED";
  }
  return null;
}

export function buildPe4ExpectationSplitManifests(
  rows: readonly Pe4ExpectationDatasetRow[],
): Pe4ExpectationSplitManifest[] {
  const byName = new Map<
    Pe4ExpectationSplitManifest["name"],
    Pe4ExpectationDatasetRow[]
  >();
  for (const name of [
    "DEVELOPMENT",
    "VALIDATION",
    "HOLDOUT_RESERVED",
  ] as const) {
    byName.set(name, []);
  }
  for (const row of rows) {
    const name = assignPe4ExpectationSplitName(row.season);
    if (name == null) continue;
    byName.get(name)!.push(row);
  }

  const manifests: Pe4ExpectationSplitManifest[] = [];
  for (const name of [
    "DEVELOPMENT",
    "VALIDATION",
    "HOLDOUT_RESERVED",
  ] as const) {
    const splitRows = byName.get(name)!;
    if (splitRows.length === 0) continue;
    const kickoffs = splitRows.map((r) => r.kickoffUtc).sort();
    const seasons = [...new Set(splitRows.map((r) => r.season))].sort();
    manifests.push({
      name,
      promotionEligible: false,
      firstKickoffUtc: kickoffs[0]!,
      lastKickoffUtc: kickoffs[kickoffs.length - 1]!,
      rowCount: splitRows.length,
      fixtureIdDigest: digestPe4ExpectationFixtureIds(
        splitRows.map((r) => r.fixtureId),
      ),
      seasons,
    });
  }
  return manifests;
}

/**
 * Documented rolling-origin plan for PE-4G.4 (not executed here).
 */
export const PE4_EXPECTATION_ROLLING_ORIGIN_PLAN = {
  version: "pe4.expectation.rolling_origin.v1",
  description:
    "Train on chronologically earlier blocks; evaluate the next untouched block; expand training; repeat. Prefer season or mid-season blocks over random CV to avoid regime leakage across time.",
  proposedBlocks: [
    { trainSeasons: ["2023"], evalSeasons: ["2024"] },
    { trainSeasons: ["2023", "2024"], evalSeasons: ["2025"] },
  ],
  reducesTemporalLeakageVsRandomCv: true,
  notExecutedInPe4g3: true,
} as const;
