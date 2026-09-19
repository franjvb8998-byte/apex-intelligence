/**
 * Freeze and verify the persisted natural 380. Offline only.
 */

import { existsSync, readFileSync } from "node:fs";
import { loadCalibrationDataset } from "@/lib/debug/calibration/persist";
import { rowEvidenceBucket } from "@/lib/debug/calibration/reconstruct";
import { countEvidenceBuckets } from "@/lib/debug/calibration/select-pilot";
import {
  PILOT_LEAGUE_ID,
  PILOT_SEASON,
} from "@/lib/debug/calibration/pilot-shape";
import type {
  CalibrationRow,
  EvidenceBucketCounts,
  PilotRunMetadata,
} from "@/lib/debug/calibration/types";
import { NATURAL_FULL_POPULATION_LABEL } from "@/lib/debug/calibration/pilot-diagnostics";

export const SPRINT_5B5_POPULATION_PATH =
  "data/calibration/pilot-2026-09-19T05-52-08-473Z.population.jsonl";
export const SPRINT_5B5_META_PATH =
  "data/calibration/pilot-2026-09-19T05-52-08-473Z.meta.json";

export type FrozenPopulationVerification = {
  datasetKind: typeof NATURAL_FULL_POPULATION_LABEL;
  n: number;
  uniqueFixtureIds: number;
  leagueId: string;
  season: string;
  leakageViolationCount: number;
  evidenceBuckets: EvidenceBucketCounts;
  observed: { n: number; home: number; draw: number; away: number };
  observedRates: { home: number; draw: number; away: number };
};

export type FrozenNaturalPopulation = {
  path: string;
  metadataPath: string;
  rows: CalibrationRow[];
  metadata: PilotRunMetadata;
  verification: FrozenPopulationVerification;
};

function observedOutcomes(rows: readonly CalibrationRow[]) {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const row of rows) {
    if (row.actualOutcome === "home") home += 1;
    else if (row.actualOutcome === "draw") draw += 1;
    else if (row.actualOutcome === "away") away += 1;
  }
  const n = home + draw + away;
  return {
    n,
    home,
    draw,
    away,
    rates: {
      home: n === 0 ? 0 : home / n,
      draw: n === 0 ? 0 : draw / n,
      away: n === 0 ? 0 : away / n,
    },
  };
}

export function verifyFrozenNaturalPopulation(input: {
  rows: readonly CalibrationRow[];
  metadata?: PilotRunMetadata;
}): FrozenPopulationVerification {
  const ids = input.rows.map((row) => row.fixtureId);
  const unique = new Set(ids);
  if (unique.size !== input.rows.length) {
    throw new Error(
      `Natural population fixture IDs are not unique (${unique.size}/${input.rows.length})`,
    );
  }
  const leagues = new Set(input.rows.map((row) => row.competitionId));
  const seasons = new Set(input.rows.map((row) => row.season));
  const leagueId = input.metadata?.leagueId ?? [...leagues][0] ?? "";
  const season = input.metadata?.season ?? [...seasons][0] ?? "";
  if (leagues.size !== 1 || leagueId !== PILOT_LEAGUE_ID) {
    throw new Error(`Expected league ${PILOT_LEAGUE_ID}, found ${[...leagues].join(",")}`);
  }
  if (seasons.size !== 1 || season !== PILOT_SEASON) {
    throw new Error(`Expected season ${PILOT_SEASON}, found ${[...seasons].join(",")}`);
  }
  const buckets = countEvidenceBuckets(input.rows);
  const observed = observedOutcomes(input.rows);
  if (observed.n !== input.rows.length) {
    throw new Error("Natural population contains unlabeled outcomes");
  }
  for (const row of input.rows) {
    rowEvidenceBucket(row);
  }
  return {
    datasetKind: NATURAL_FULL_POPULATION_LABEL,
    n: input.rows.length,
    uniqueFixtureIds: unique.size,
    leagueId,
    season,
    leakageViolationCount: input.metadata?.leakageViolationCount ?? 0,
    evidenceBuckets: buckets,
    observed: {
      n: observed.n,
      home: observed.home,
      draw: observed.draw,
      away: observed.away,
    },
    observedRates: observed.rates,
  };
}

export function persistedNatural380Exists(): boolean {
  return existsSync(SPRINT_5B5_POPULATION_PATH) && existsSync(SPRINT_5B5_META_PATH);
}

export function loadFrozenNaturalPopulation(
  populationPath = SPRINT_5B5_POPULATION_PATH,
  metadataPath = SPRINT_5B5_META_PATH,
): FrozenNaturalPopulation {
  const rows = loadCalibrationDataset(populationPath);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as PilotRunMetadata;
  const verification = verifyFrozenNaturalPopulation({ rows, metadata });
  if (verification.n !== 380) {
    throw new Error(`Expected 380 natural rows, found ${verification.n}`);
  }
  if (verification.leakageViolationCount !== 0) {
    throw new Error(`Expected leakageViolationCount=0, found ${verification.leakageViolationCount}`);
  }
  const expected = { "0": 10, "1-3": 30, "4-9": 60, "10+": 280 };
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (verification.evidenceBuckets[key] !== expected[key]) {
      throw new Error(
        `Unexpected ${key} bucket ${verification.evidenceBuckets[key]} (expected ${expected[key]})`,
      );
    }
  }
  return { path: populationPath, metadataPath, rows, metadata, verification };
}
