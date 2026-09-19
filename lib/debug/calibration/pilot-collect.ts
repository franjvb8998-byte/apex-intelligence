/**
 * Historical probability-calibration pilot.
 * One unpaged fixture-list lookup. Zero odds requests.
 */

import { buildCalibrationRow } from "@/lib/debug/calibration/reconstruct";
import { fetchCompleteSeasonFixtures } from "@/lib/debug/calibration/fetch-season";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import { assertReconstructionHasNoFuturePriors } from "@/lib/debug/calibration/leakage";
import {
  assertLiveCollectionAuthorized,
  planPilotLogicalCalls,
} from "@/lib/debug/calibration/live-guard";
import {
  PILOT_CATEGORY,
  PILOT_FIXTURE_LIST_LOGICAL_CALLS,
  PILOT_LEAGUE_ID,
  PILOT_LEAGUE_NAME,
  PILOT_ODDS_LOGICAL_CALLS,
  PILOT_SEASON,
  PILOT_TARGET_COUNT,
  PILOT_VERSION,
} from "@/lib/debug/calibration/pilot-shape";
import { writePilotArtifacts } from "@/lib/debug/calibration/persist";
import type { PilotArtifactPaths } from "@/lib/debug/calibration/persist";
import { eligibleTargetFixtures } from "@/lib/debug/calibration/select-targets";
import { selectPilotRows } from "@/lib/debug/calibration/select-pilot";
import { assertMicrocollectionTargetContract } from "@/lib/debug/calibration/season-contract";
import {
  CALIBRATION_RECONSTRUCTION_VERSION,
  CALIBRATION_SCHEMA_VERSION,
  type CalibrationRow,
  type PilotRunMetadata,
  type ReconstructionFixture,
} from "@/lib/debug/calibration/types";

export type PilotCollectResult = {
  rows: CalibrationRow[];
  population: CalibrationRow[];
  metadata: PilotRunMetadata;
  logicalCallCount: number;
  paths?: PilotArtifactPaths;
};

export function createPilotRunMetadata(input: {
  rows: readonly CalibrationRow[];
  fullEligiblePopulationCount: number;
  fullPopulationEvidenceBuckets: PilotRunMetadata["fullPopulationEvidenceBuckets"];
  selectedEvidenceBuckets: PilotRunMetadata["selectedEvidenceBuckets"];
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  requestedTargetCount: number;
  generatedAt?: string;
  selectionAlgorithm: string;
  selectionRule: string;
  leakageViolationCount?: number;
}): PilotRunMetadata {
  return {
    schemaVersion: CALIBRATION_SCHEMA_VERSION,
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    collectorVersion: PILOT_VERSION,
    leagueId: PILOT_LEAGUE_ID,
    season: PILOT_SEASON,
    leagueName: PILOT_LEAGUE_NAME,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requestedTargetCount: input.requestedTargetCount,
    targetRowCount: input.rows.length,
    fullEligiblePopulationCount: input.fullEligiblePopulationCount,
    fullPopulationEvidenceBuckets: input.fullPopulationEvidenceBuckets,
    selectedEvidenceBuckets: input.selectedEvidenceBuckets,
    fixtureCountBeforeDedupe: input.fixtureCountBeforeDedupe,
    fixtureCountAfterDedupe: input.fixtureCountAfterDedupe,
    fixtureListLogicalCalls: PILOT_FIXTURE_LIST_LOGICAL_CALLS,
    logicalCallCount: PILOT_FIXTURE_LIST_LOGICAL_CALLS,
    callBudgetKind: "logical_lookups_not_origin_http_attempts",
    oddsRequested: false,
    oddsLogicalCalls: PILOT_ODDS_LOGICAL_CALLS,
    leakageViolationCount: input.leakageViolationCount ?? 0,
    selectionAlgorithm: input.selectionAlgorithm,
    selectionRule: input.selectionRule,
    populationRowCount: input.fullEligiblePopulationCount,
    sampleRowCount: input.rows.length,
  };
}

function reconstructEligiblePopulation(
  fixtures: readonly ReconstructionFixture[],
): CalibrationRow[] {
  const eligible = eligibleTargetFixtures(fixtures);
  return eligible.map((target) => {
    assertReconstructionHasNoFuturePriors({ target, fixtures });
    return buildCalibrationRow({
      target,
      fixtures,
      category: PILOT_CATEGORY,
    });
  });
}

export async function collectPilotDataset(input: {
  transport: FixtureSeasonTransport;
  requestedTargetCount?: number;
  writeArtifacts?: boolean;
  artifactDirectory?: string;
  generatedAt?: string;
}): Promise<PilotCollectResult> {
  const requestedTargetCount = input.requestedTargetCount ?? PILOT_TARGET_COUNT;
  planPilotLogicalCalls({ includeOdds: false });
  let logicalCallCount = 0;
  const season = await fetchCompleteSeasonFixtures({
    transport: input.transport,
    leagueId: PILOT_LEAGUE_ID,
    season: PILOT_SEASON,
    onOriginCall: () => {
      logicalCallCount += 1;
    },
  });
  const eligible = eligibleTargetFixtures(season.fixtures);
  assertMicrocollectionTargetContract({
    fixtureCount: season.afterCount,
    eligibleCount: eligible.length,
    selectedCount: Math.min(requestedTargetCount, eligible.length),
    expectedTargetCount: Math.min(requestedTargetCount, eligible.length),
  });
  const population = reconstructEligiblePopulation(season.fixtures);
  const selected = selectPilotRows(population, requestedTargetCount);
  const metadata = createPilotRunMetadata({
    rows: selected.selected,
    fullEligiblePopulationCount: population.length,
    fullPopulationEvidenceBuckets: selected.fullPopulationEvidenceBuckets,
    selectedEvidenceBuckets: selected.selectedEvidenceBuckets,
    fixtureCountBeforeDedupe: season.beforeCount,
    fixtureCountAfterDedupe: season.afterCount,
    requestedTargetCount,
    generatedAt: input.generatedAt,
    selectionAlgorithm: selected.selectionAlgorithm,
    selectionRule: selected.selectionRule,
    leakageViolationCount: 0,
  });
  let paths: PilotCollectResult["paths"];
  let writtenMetadata = metadata;
  if (input.writeArtifacts) {
    const written = writePilotArtifacts({
      population,
      sample: selected.selected,
      metadata,
      directory: input.artifactDirectory,
    });
    paths = {
      populationPath: written.populationPath,
      samplePath: written.samplePath,
      metadataPath: written.metadataPath,
    };
    writtenMetadata = written.metadata;
  }
  return {
    rows: selected.selected,
    population,
    metadata: writtenMetadata,
    logicalCallCount,
    paths,
  };
}

export async function runAuthorizedPilot(input: {
  env: Record<string, string | undefined>;
  argv: readonly string[];
  transport: FixtureSeasonTransport;
  artifactDirectory?: string;
}): Promise<PilotCollectResult> {
  assertLiveCollectionAuthorized(input.env, input.argv);
  return collectPilotDataset({
    transport: input.transport,
    writeArtifacts: true,
    artifactDirectory: input.artifactDirectory,
  });
}

export async function reportPilotCliResult(
  run: () => Promise<PilotCollectResult>,
): Promise<void> {
  try {
    const result = await run();
    console.log(
      JSON.stringify(
        {
          rows: result.rows.length,
          fullEligiblePopulationCount: result.metadata.fullEligiblePopulationCount,
          fullPopulationEvidenceBuckets: result.metadata.fullPopulationEvidenceBuckets,
          selectedEvidenceBuckets: result.metadata.selectedEvidenceBuckets,
          logicalCallCount: result.logicalCallCount,
          oddsRequested: result.metadata.oddsRequested,
          oddsLogicalCalls: result.metadata.oddsLogicalCalls,
          callBudgetKind: result.metadata.callBudgetKind,
          populationPath: result.paths?.populationPath ?? null,
          samplePath: result.paths?.samplePath ?? null,
          metadataPath: result.paths?.metadataPath ?? null,
        },
        null,
        2,
      ),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
