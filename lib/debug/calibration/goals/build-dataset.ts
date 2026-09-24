/**
 * GOALS-1B — Offline dataset builder from calibration populations.
 */

import { createHash } from "node:crypto";
import {
  GOALS_CONFIRMATORY_SEASON,
  GOALS_DEV_SEASON,
  GOALS_EVIDENCE_BUILDER_VERSION,
  GOALS_EVIDENCE_SCHEMA_VERSION,
  GOALS_HOLDOUT_SEASON,
  GOALS_REGULATION_LABEL_POLICY,
  GOALS_TEMPORAL_RULE,
  type GoalsTargetEvidence,
} from "@/lib/debug/calibration/goals/types";
import { applyLeagueFtAssumption as assumeFt } from "@/lib/debug/calibration/goals/regulation";
import {
  calibrationRowToGoalsFixture,
  normalizeGoalsHistoricalUniverse,
} from "@/lib/debug/calibration/goals/normalize";
import { buildGoalsTargetEvidence } from "@/lib/debug/calibration/goals/build-evidence";
import { digestGoalsDataset } from "@/lib/debug/calibration/goals/digest";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

export type GoalsEvidenceDatasetManifest = {
  schemaVersion: typeof GOALS_EVIDENCE_SCHEMA_VERSION;
  evidenceVersion: typeof GOALS_EVIDENCE_BUILDER_VERSION;
  regulationLabelPolicy: typeof GOALS_REGULATION_LABEL_POLICY;
  temporalRule: typeof GOALS_TEMPORAL_RULE;
  leagueFtAssumptionApplied: boolean;
  competitionIdFilter: string;
  seasonsEmitted: string[];
  holdoutSeasonExcluded: typeof GOALS_HOLDOUT_SEASON;
  rowCount: number;
  seasonCounts: Record<string, number>;
  labelAvailableCount: number;
  labelUnavailableCount: number;
  sourceFileDigests: Record<string, string>;
  datasetDigest: string;
};

export type GoalsEvidenceDescriptive = {
  bySeason: Record<
    string,
    {
      targets: number;
      labelAvailable: number;
      labelUnavailable: number;
      teamHistoryBuckets: Record<string, number>;
      homeVenueHistoryBuckets: Record<string, number>;
      leagueHistoryBuckets: Record<string, number>;
      recentLast5Used: number;
      recentLast5PartialOrUnavailable: number;
      regulationLabelSources: Record<string, number>;
    }
  >;
};

function bucketPlayed(n: number): string {
  if (n === 0) return "0";
  if (n <= 2) return "1-2";
  if (n <= 4) return "3-4";
  if (n < 8) return "5-7";
  return "8+";
}

function fileDigest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Build research evidence rows for seasons 2023/2024 only.
 * Rejects 2025 targets. Universe for each season is same season only.
 */
export function buildGoalsEvidenceDataset(input: {
  rowsBySource: { label: string; text: string; rows: CalibrationRow[] }[];
  /** Explicit research assumption for PL league populations lacking status. */
  applyLeagueFtAssumption: boolean;
  competitionId?: string;
}): {
  rows: GoalsTargetEvidence[];
  manifest: GoalsEvidenceDatasetManifest;
  descriptive: GoalsEvidenceDescriptive;
} {
  const competitionId = input.competitionId ?? "39";
  const sourceFileDigests: Record<string, string> = {};
  const allRows: CalibrationRow[] = [];
  for (const src of input.rowsBySource) {
    sourceFileDigests[src.label] = fileDigest(src.text);
    for (const row of src.rows) {
      if (row.season === GOALS_HOLDOUT_SEASON) continue;
      if (row.competitionId !== competitionId) continue;
      if (
        row.season !== GOALS_DEV_SEASON &&
        row.season !== GOALS_CONFIRMATORY_SEASON
      ) {
        continue;
      }
      allRows.push(row);
    }
  }

  let fixtures = normalizeGoalsHistoricalUniverse(
    allRows.map(calibrationRowToGoalsFixture),
  ).fixtures;

  if (input.applyLeagueFtAssumption) {
    fixtures = fixtures.map(assumeFt);
  }

  // Per-season universes (same-season contract)
  const bySeason = new Map<string, typeof fixtures>();
  for (const f of fixtures) {
    const list = bySeason.get(f.season) ?? [];
    list.push(f);
    bySeason.set(f.season, list);
  }

  const evidenceRows: GoalsTargetEvidence[] = [];
  for (const season of [GOALS_DEV_SEASON, GOALS_CONFIRMATORY_SEASON]) {
    const universe = bySeason.get(season) ?? [];
    for (const target of universe) {
      if (target.season === GOALS_HOLDOUT_SEASON) {
        throw new Error("holdout_season_forbidden");
      }
      evidenceRows.push(
        buildGoalsTargetEvidence({ target, universe, commonStrength: null }),
      );
    }
  }

  evidenceRows.sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  const seasonCounts: Record<string, number> = {};
  let labelAvailableCount = 0;
  let labelUnavailableCount = 0;
  const descriptive: GoalsEvidenceDescriptive = { bySeason: {} };

  for (const season of [GOALS_DEV_SEASON, GOALS_CONFIRMATORY_SEASON]) {
    const subset = evidenceRows.filter((r) => r.season === season);
    seasonCounts[season] = subset.length;
    const teamHistoryBuckets: Record<string, number> = {
      "0": 0,
      "1-2": 0,
      "3-4": 0,
      "5-7": 0,
      "8+": 0,
    };
    const homeVenueHistoryBuckets = { ...teamHistoryBuckets };
    const leagueHistoryBuckets = { ...teamHistoryBuckets };
    let labelAvailable = 0;
    let labelUnavailable = 0;
    let recentLast5Used = 0;
    let recentLast5PartialOrUnavailable = 0;
    const regulationLabelSources: Record<string, number> = {};

    for (const row of subset) {
      if (row.labels.labelStatus === "USED") labelAvailable += 1;
      else labelUnavailable += 1;
      teamHistoryBuckets[bucketPlayed(row.homeEvidence.allVenues.played)]! += 1;
      homeVenueHistoryBuckets[
        bucketPlayed(row.homeEvidence.homeRole.played)
      ]! += 1;
      leagueHistoryBuckets[
        bucketPlayed(row.leagueEnvironment.leagueMatchesPlayedBefore)
      ]! += 1;
      const last5 = row.homeEvidence.recentLastN.find(
        (w) => w.windowId === "last_5",
      );
      if (last5?.status === "USED") recentLast5Used += 1;
      else recentLast5PartialOrUnavailable += 1;
      const src = row.labels.regulationLabelSource;
      regulationLabelSources[src] = (regulationLabelSources[src] ?? 0) + 1;
    }
    labelAvailableCount += labelAvailable;
    labelUnavailableCount += labelUnavailable;
    descriptive.bySeason[season] = {
      targets: subset.length,
      labelAvailable,
      labelUnavailable,
      teamHistoryBuckets,
      homeVenueHistoryBuckets,
      leagueHistoryBuckets,
      recentLast5Used,
      recentLast5PartialOrUnavailable,
      regulationLabelSources,
    };
  }

  const datasetDigest = digestGoalsDataset(evidenceRows.map((r) => r.digest));

  return {
    rows: evidenceRows,
    manifest: {
      schemaVersion: GOALS_EVIDENCE_SCHEMA_VERSION,
      evidenceVersion: GOALS_EVIDENCE_BUILDER_VERSION,
      regulationLabelPolicy: GOALS_REGULATION_LABEL_POLICY,
      temporalRule: GOALS_TEMPORAL_RULE,
      leagueFtAssumptionApplied: input.applyLeagueFtAssumption,
      competitionIdFilter: competitionId,
      seasonsEmitted: [GOALS_DEV_SEASON, GOALS_CONFIRMATORY_SEASON],
      holdoutSeasonExcluded: GOALS_HOLDOUT_SEASON,
      rowCount: evidenceRows.length,
      seasonCounts,
      labelAvailableCount,
      labelUnavailableCount,
      sourceFileDigests,
      datasetDigest,
    },
    descriptive,
  };
}
