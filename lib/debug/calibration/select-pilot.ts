/**
 * Deterministic stratified pilot selection.
 * Does not skip the first 20%. Does not sample randomly.
 */

import {
  PILOT_EVIDENCE_BUCKETS,
  PILOT_SELECTION_ALGORITHM,
  PILOT_SELECTION_RULE,
  PILOT_TARGET_COUNT,
} from "@/lib/debug/calibration/pilot-shape";
import { compareFixturesDeterministically } from "@/lib/debug/calibration/reconstruct";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { evenlySpacedIndices } from "@/lib/debug/calibration/select-targets";
import type {
  CalibrationRow,
  EvidenceBucket,
  EvidenceBucketCounts,
} from "@/lib/debug/calibration/types";

export function emptyEvidenceBucketCounts(): EvidenceBucketCounts {
  return { "0": 0, "1-3": 0, "4-9": 0, "10+": 0 };
}

export function countEvidenceBuckets(
  rows: readonly CalibrationRow[],
): EvidenceBucketCounts {
  const counts = emptyEvidenceBucketCounts();
  for (const row of rows) {
    counts[rowEvidenceBucket(row)] += 1;
  }
  return counts;
}

/**
 * Equal shares of `requested`. Remainder 150%4=2 goes to 0 then 1-3
 * so scarce early-season buckets get the extra slots first.
 */
export function desiredPilotBucketAllocation(
  requested = PILOT_TARGET_COUNT,
): EvidenceBucketCounts {
  const desired = emptyEvidenceBucketCounts();
  const base = Math.floor(requested / PILOT_EVIDENCE_BUCKETS.length);
  const remainder = requested % PILOT_EVIDENCE_BUCKETS.length;
  for (const [index, bucket] of PILOT_EVIDENCE_BUCKETS.entries()) {
    desired[bucket] = base + (index < remainder ? 1 : 0);
  }
  return desired;
}

export function allocatedPilotBucketCounts(
  available: EvidenceBucketCounts,
  requested = PILOT_TARGET_COUNT,
): EvidenceBucketCounts {
  const desired = desiredPilotBucketAllocation(requested);
  const selected = emptyEvidenceBucketCounts();
  let leftover = 0;
  for (const bucket of PILOT_EVIDENCE_BUCKETS) {
    const take = Math.min(desired[bucket], available[bucket]);
    selected[bucket] = take;
    leftover += desired[bucket] - take;
  }
  for (const bucket of PILOT_EVIDENCE_BUCKETS) {
    if (leftover <= 0) break;
    const unused = available[bucket] - selected[bucket];
    const extra = Math.min(unused, leftover);
    selected[bucket] += extra;
    leftover -= extra;
  }
  return selected;
}

function sortPilotRows(rows: readonly CalibrationRow[]): CalibrationRow[] {
  return [...rows].sort((a, b) =>
    compareFixturesDeterministically(
      {
        fixtureId: a.fixtureId,
        kickoff: a.kickoff,
        competitionId: a.competitionId,
        season: a.season,
        homeTeamId: a.homeTeamId,
        awayTeamId: a.awayTeamId,
        status: "FT",
        goalsHome: a.actualHomeGoals,
        goalsAway: a.actualAwayGoals,
        fulltimeHome: a.actualHomeGoals,
        fulltimeAway: a.actualAwayGoals,
      },
      {
        fixtureId: b.fixtureId,
        kickoff: b.kickoff,
        competitionId: b.competitionId,
        season: b.season,
        homeTeamId: b.homeTeamId,
        awayTeamId: b.awayTeamId,
        status: "FT",
        goalsHome: b.actualHomeGoals,
        goalsAway: b.actualAwayGoals,
        fulltimeHome: b.actualHomeGoals,
        fulltimeAway: b.actualAwayGoals,
      },
    ),
  );
}

function groupByEvidenceBucket(
  rows: readonly CalibrationRow[],
): Record<EvidenceBucket, CalibrationRow[]> {
  const groups: Record<EvidenceBucket, CalibrationRow[]> = {
    "0": [],
    "1-3": [],
    "4-9": [],
    "10+": [],
  };
  for (const row of sortPilotRows(rows)) {
    groups[rowEvidenceBucket(row)].push(row);
  }
  return groups;
}

export function selectPilotRows(
  rows: readonly CalibrationRow[],
  requestedTargetCount = PILOT_TARGET_COUNT,
): {
  selected: CalibrationRow[];
  fullPopulationEvidenceBuckets: EvidenceBucketCounts;
  selectedEvidenceBuckets: EvidenceBucketCounts;
  selectionAlgorithm: string;
  selectionRule: string;
} {
  const fullPopulationEvidenceBuckets = countEvidenceBuckets(rows);
  const allocated = allocatedPilotBucketCounts(
    fullPopulationEvidenceBuckets,
    requestedTargetCount,
  );
  const groups = groupByEvidenceBucket(rows);
  const selected: CalibrationRow[] = [];
  const selectedEvidenceBuckets = emptyEvidenceBucketCounts();
  for (const bucket of PILOT_EVIDENCE_BUCKETS) {
    const pool = groups[bucket];
    const indices = evenlySpacedIndices(pool.length, allocated[bucket]);
    for (const index of indices) {
      selected.push(pool[index]!);
    }
    selectedEvidenceBuckets[bucket] = indices.length;
  }
  return {
    selected: sortPilotRows(selected),
    fullPopulationEvidenceBuckets,
    selectedEvidenceBuckets,
    selectionAlgorithm: PILOT_SELECTION_ALGORITHM,
    selectionRule: PILOT_SELECTION_RULE,
  };
}
