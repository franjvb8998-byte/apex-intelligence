/**
 * Assemble and persist the offline 5B.5 experiment artifact.
 */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";
import {
  EXPERIMENT_HA_CONFIGS,
  productionHaConstants,
} from "@/lib/debug/calibration/experiment-5b5-ha";
import {
  evaluateFactorialExperiment,
  type FactorialExperimentResult,
} from "@/lib/debug/calibration/experiment-5b5-evaluate";
import {
  verifyFrozenNaturalPopulation,
  type FrozenPopulationVerification,
} from "@/lib/debug/calibration/experiment-5b5-dataset";
import { createDefaultEloPolicies } from "@/lib/debug/calibration/policies";
import { NATURAL_FULL_POPULATION_LABEL } from "@/lib/debug/calibration/pilot-diagnostics";
import type { CalibrationRow, PilotRunMetadata } from "@/lib/debug/calibration/types";

export const EXPERIMENT_5B5_VERSION = "apex.calibration.experiment.5b5.v1";

export type Experiment5b5Report = {
  experimentVersion: string;
  datasetKind: typeof NATURAL_FULL_POPULATION_LABEL;
  datasetIdentity: {
    populationPath?: string;
    metadataPath?: string;
    generatedAt: string;
    leagueId: string;
    season: string;
    collectorVersion?: string;
    reconstructionVersion?: string;
    leakageViolationCount: number;
  };
  datasetRowCount: number;
  observedOutcomeDistribution: FrozenPopulationVerification["observed"] & {
    rates: FrozenPopulationVerification["observedRates"];
  };
  productionConstants: ReturnType<typeof productionHaConstants>;
  experimentalConfigurations: typeof EXPERIMENT_HA_CONFIGS;
  combinationCount: number;
  methodologyNote: string;
  verification: FrozenPopulationVerification;
  results: FactorialExperimentResult;
};

export function buildExperiment5b5Report(input: {
  rows: readonly CalibrationRow[];
  metadata?: PilotRunMetadata;
  populationPath?: string;
  metadataPath?: string;
  generatedAt?: string;
}): Experiment5b5Report {
  const verification = verifyFrozenNaturalPopulation({
    rows: input.rows,
    metadata: input.metadata,
  });
  const results = evaluateFactorialExperiment(input.rows, createDefaultEloPolicies());
  return {
    experimentVersion: EXPERIMENT_5B5_VERSION,
    datasetKind: NATURAL_FULL_POPULATION_LABEL,
    datasetIdentity: {
      populationPath: input.populationPath,
      metadataPath: input.metadataPath,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      leagueId: verification.leagueId,
      season: verification.season,
      collectorVersion: input.metadata?.collectorVersion,
      reconstructionVersion: input.metadata?.reconstructionVersion,
      leakageViolationCount: verification.leakageViolationCount,
    },
    datasetRowCount: verification.n,
    observedOutcomeDistribution: {
      ...verification.observed,
      rates: verification.observedRates,
    },
    productionConstants: productionHaConstants(),
    experimentalConfigurations: EXPERIMENT_HA_CONFIGS,
    combinationCount: results.combinationCount,
    methodologyNote:
      "Exploratory/calibration-development only. Do not select a production Elo policy or HA configuration from these same observations. A later sprint must define train/validation or cross-season validation.",
    verification,
    results,
  };
}

export function writeExperiment5b5Artifact(input: {
  report: Experiment5b5Report;
  directory?: string;
  generatedAt?: string;
}): { path: string } {
  const serialized = JSON.stringify(input.report);
  if (/api[_-]?key|x-apisports-key/i.test(serialized)) {
    throw new Error("Refusing to write an experiment report that looks like it contains an API key");
  }
  const directory = input.directory ?? CALIBRATION_ARTIFACT_DIR;
  mkdirSync(directory, { recursive: true });
  const stamp = (input.generatedAt ?? input.report.datasetIdentity.generatedAt).replace(
    /[:.]/g,
    "-",
  );
  const path = join(directory, `experiment-5b5-${stamp}.json`);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(input.report, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
  return { path };
}
