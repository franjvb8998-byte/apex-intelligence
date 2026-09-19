/**
 * Independent holdout-season collection.
 * One unpaged fixtures lookup per season. Zero odds. Does not merge PL 2024.
 */

import { buildCalibrationRow } from "@/lib/debug/calibration/reconstruct";
import { fetchCompleteSeasonFixtures } from "@/lib/debug/calibration/fetch-season";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import { eligibleTargetFixtures } from "@/lib/debug/calibration/select-targets";
import { assertMicrocollectionTargetContract } from "@/lib/debug/calibration/season-contract";
import { countEvidenceBuckets } from "@/lib/debug/calibration/select-pilot";
import {
  assertValidValidationPopulation,
  assertValidationLeakageContract,
} from "@/lib/debug/calibration/validation-5b6-integrity";
import { writeValidationSeasonArtifacts } from "@/lib/debug/calibration/validation-5b6-persist";
import {
  VALIDATION_CATEGORY,
  VALIDATION_DATASET_KIND,
  VALIDATION_DEVELOPMENT_SEASON,
  VALIDATION_HOLDOUT_SEASONS,
  VALIDATION_LEAGUE_ID,
  VALIDATION_LEAGUE_NAME,
  VALIDATION_ROLE,
  VALIDATION_VERSION,
  type ValidationHoldoutSeason,
} from "@/lib/debug/calibration/validation-5b6-shape";
import { planValidationLogicalCalls } from "@/lib/debug/calibration/live-guard";
import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import {
  CALIBRATION_RECONSTRUCTION_VERSION,
  CALIBRATION_SCHEMA_VERSION,
  type CalibrationRow,
  type ReconstructionFixture,
  type ValidationSeasonMetadata,
} from "@/lib/debug/calibration/types";

export type ValidationSeasonCollectResult = {
  season: ValidationHoldoutSeason;
  population: CalibrationRow[];
  metadata: ValidationSeasonMetadata;
  logicalCallCount: number;
  paths?: { populationPath: string; metadataPath: string };
};

function reconstructHoldoutPopulation(
  fixtures: readonly ReconstructionFixture[],
): CalibrationRow[] {
  const eligible = eligibleTargetFixtures(fixtures);
  return eligible.map((target) => {
    const row = buildCalibrationRow({
      target,
      fixtures,
      category: VALIDATION_CATEGORY,
    });
    assertValidationLeakageContract({ target, fixtures, row });
    return row;
  });
}

export function createValidationSeasonMetadata(input: {
  season: ValidationHoldoutSeason;
  population: readonly CalibrationRow[];
  fixtureCountBeforeDedupe: number;
  fixtureCountAfterDedupe: number;
  logicalCallCount: number;
  generatedAt?: string;
}): ValidationSeasonMetadata {
  if ((input.season as string) === VALIDATION_DEVELOPMENT_SEASON) {
    throw new Error("PL 2024 is development data and cannot be written as a holdout artifact");
  }
  return {
    schemaVersion: CALIBRATION_SCHEMA_VERSION,
    reconstructionVersion: CALIBRATION_RECONSTRUCTION_VERSION,
    collectorVersion: VALIDATION_VERSION,
    datasetKind: VALIDATION_DATASET_KIND,
    validationRole: VALIDATION_ROLE,
    leagueId: VALIDATION_LEAGUE_ID,
    season: input.season,
    leagueName: VALIDATION_LEAGUE_NAME,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    populationRowCount: input.population.length,
    evidenceBuckets: countEvidenceBuckets(input.population),
    fixtureCountBeforeDedupe: input.fixtureCountBeforeDedupe,
    fixtureCountAfterDedupe: input.fixtureCountAfterDedupe,
    fixtureListLogicalCalls: 1,
    logicalCallCount: input.logicalCallCount,
    callBudgetKind: "logical_lookups_not_origin_http_attempts",
    oddsRequested: false,
    oddsLogicalCalls: 0,
    leakageViolationCount: 0,
    populationArtifact: "",
  };
}

export async function collectValidationSeason(input: {
  transport: FixtureSeasonTransport;
  season: ValidationHoldoutSeason;
  writeArtifacts?: boolean;
  artifactDirectory?: string;
  generatedAt?: string;
}): Promise<ValidationSeasonCollectResult> {
  if ((input.season as string) === VALIDATION_DEVELOPMENT_SEASON) {
    throw new Error("Refusing to collect PL 2024 as a holdout season");
  }
  let logicalCallCount = 0;
  const season = await fetchCompleteSeasonFixtures({
    transport: input.transport,
    leagueId: VALIDATION_LEAGUE_ID,
    season: input.season,
    onOriginCall: () => {
      logicalCallCount += 1;
    },
  });
  const eligible = eligibleTargetFixtures(season.fixtures);
  assertMicrocollectionTargetContract({
    fixtureCount: season.afterCount,
    eligibleCount: eligible.length,
    selectedCount: eligible.length,
    expectedTargetCount: eligible.length,
  });
  const population = reconstructHoldoutPopulation(season.fixtures);
  assertValidValidationPopulation(population);
  const metadata = createValidationSeasonMetadata({
    season: input.season,
    population,
    fixtureCountBeforeDedupe: season.beforeCount,
    fixtureCountAfterDedupe: season.afterCount,
    logicalCallCount,
    generatedAt: input.generatedAt,
  });
  let paths: ValidationSeasonCollectResult["paths"];
  let writtenMetadata = metadata;
  if (input.writeArtifacts) {
    const written = writeValidationSeasonArtifacts({
      population,
      metadata,
      directory: input.artifactDirectory,
    });
    paths = {
      populationPath: written.populationPath,
      metadataPath: written.metadataPath,
    };
    writtenMetadata = written.metadata;
  }
  return {
    season: input.season,
    population,
    metadata: writtenMetadata,
    logicalCallCount,
    paths,
  };
}

export async function collectValidationHoldouts(input: {
  transport: FixtureSeasonTransport;
  seasons?: readonly ValidationHoldoutSeason[];
  writeArtifacts?: boolean;
  artifactDirectory?: string;
  generatedAt?: string;
}): Promise<{
  seasons: ValidationSeasonCollectResult[];
  logicalCallCount: number;
}> {
  const seasons = input.seasons ?? VALIDATION_HOLDOUT_SEASONS;
  planValidationLogicalCalls({ seasonCount: seasons.length, includeOdds: false });
  const collected: ValidationSeasonCollectResult[] = [];
  let logicalCallCount = 0;
  for (const season of seasons) {
    const result = await collectValidationSeason({
      transport: input.transport,
      season,
      writeArtifacts: input.writeArtifacts,
      artifactDirectory: input.artifactDirectory,
      generatedAt: input.generatedAt,
    });
    logicalCallCount += result.logicalCallCount;
    collected.push(result);
  }
  if (logicalCallCount !== seasons.length) {
    throw new Error(
      `Validation logicalCallCount ${logicalCallCount} !== season count ${seasons.length}`,
    );
  }
  return { seasons: collected, logicalCallCount };
}

export async function runAuthorizedValidation(input: {
  env: Record<string, string | undefined>;
  argv: readonly string[];
  transport: FixtureSeasonTransport;
  artifactDirectory?: string;
}): Promise<{ seasons: ValidationSeasonCollectResult[]; logicalCallCount: number }> {
  assertLiveCollectionAuthorized(input.env, input.argv);
  return collectValidationHoldouts({
    transport: input.transport,
    writeArtifacts: true,
    artifactDirectory: input.artifactDirectory,
  });
}
