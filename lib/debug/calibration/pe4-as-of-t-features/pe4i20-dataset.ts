/**
 * PE-4I.20 — enrich the PE-4I.17 DEV population with PE-4I.19 strength.
 * Research-only. No labels are read or emitted by this module.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  buildDevFeatureDatasetInMemory,
  loadOrMaterializeLedger,
  type Pe4I17PathARecord,
  type Pe4I17PathBRecord,
} from "@/lib/debug/calibration/pe4-as-of-t-features/dataset-emit";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import {
  joinOpponentStrengthFromPe4I19Catalogue,
  type Pe4I16OpponentStrengthJoin,
} from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";
import {
  digestPe4I20Protocol,
  PE4I20_DATASET_ARTIFACT_SUBDIR,
  PE4I20_PROTOCOL_VERSION,
  PE4I20_PRODUCTION_WIRING,
  pe4I20Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";
import {
  materializePe4I19StrengthCatalogue,
  pe4I19StrengthJoinKey,
  type Pe4I19StrengthCatalogue,
} from "@/lib/debug/calibration/pe4-as-of-t-features/strength-catalogue";
import {
  expandTeamPerspectiveHistory,
  type Pe4I16TeamPerspectiveRow,
} from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";

export type Pe4I20OpponentStrengthFeature = {
  status: Pe4I16OpponentStrengthJoin["status"];
  meanOpponentCommonStrengthAsOfM: number | null;
  observationCount: number;
  matchedCount: number;
  missingCount: number;
  missingKeys: string[];
  unavailableReason: string | null;
  selectedHistoryRegulationAmbiguityCount: number;
  cataloguePriorRegulationAmbiguityCandidateCount: number;
  reconstructionBase: 1580;
  semantics: "common_baseline_not_venue_specific";
  comparableToVenueSpecificC0Elo: false;
  partialMeanComputed: false;
  zeroFillUsed: false;
};

export type Pe4I20PathARecord = Pe4I17PathARecord & {
  pe4i20ProtocolVersion: typeof PE4I20_PROTOCOL_VERSION;
  opponentStrength: Pe4I20OpponentStrengthFeature;
};

export type Pe4I20StrengthCoverageAudit = {
  emittedRecordCount: number;
  availableRecordCount: number;
  unavailableRecordCount: number;
  unavailableByReason: Record<string, number>;
  uniqueMissingKeysInEmittedRows: string[];
  conflictedStrengthKeyCount: number;
  devPerspectiveJoinCandidateCount: number;
  devPerspectiveJoinMatchedCount: number;
  devPerspectiveJoinMissingCount: number;
  expectedConflictedStrengthKeyCount: number;
  expectedDevPerspectiveJoinMissingCount: number;
  conflictCountsPreserved: boolean;
  noPartialMeans: true;
  noZeroFill: true;
};

export type Pe4I20DatasetResult = {
  protocol: ReturnType<typeof pe4I20Protocol>;
  protocolDigest: string;
  providerCallsMade: 0;
  productionWiring: false;
  ledgerDigest: string;
  catalogueDigest: string;
  basePathADigest: string;
  basePathBDigest: string;
  pathADigest: string;
  pathBDigest: string;
  targetCount: number;
  pathARowCount: number;
  pathBRowCount: number;
  pathARecords: Pe4I20PathARecord[];
  pathBRecords: Pe4I17PathBRecord[];
  strengthCoverage: Pe4I20StrengthCoverageAudit;
  holdoutFirewall: {
    calendar2025TargetsOrHistory: number;
    providerSeason2025TargetsOrHistory: number;
    pass: boolean;
  };
  populationParity: boolean;
  artifactDirRelative: string;
  artifactsWritten: string[];
};

function shaBody(records: readonly unknown[]): string {
  const body = records.map((row) => JSON.stringify(row)).join("\n") +
    (records.length > 0 ? "\n" : "");
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function populationKey(row: {
  targetFixtureId: string;
  teamId: string;
  windowId: string;
  venueMode: string;
}): string {
  return [row.targetFixtureId, row.teamId, row.windowId, row.venueMode].join("|");
}

function perspectiveKey(teamId: string, fixtureId: string): string {
  return `${teamId}\0${fixtureId}`;
}

function selectedHistoryForRecord(
  record: Pe4I17PathARecord,
  perspectiveByTeamAndFixture: ReadonlyMap<string, Pe4I16TeamPerspectiveRow>,
): Pe4I16TeamPerspectiveRow[] {
  return record.historyFixtureIds.map((fixtureId) => {
    const row = perspectiveByTeamAndFixture.get(
      perspectiveKey(record.teamId, fixtureId),
    );
    if (!row) {
      throw new Error(
        `PE-4I.20 fail-closed: missing team perspective team=${record.teamId} fixture=${fixtureId}`,
      );
    }
    if (!(row.kickoffUtc < record.kickoffUtc)) {
      throw new Error(
        `PE-4I.20 temporal breach: history=${fixtureId} M=${row.kickoffUtc} T=${record.kickoffUtc}`,
      );
    }
    if (row.holdoutClassification !== "dev_or_conf_eligible") {
      throw new Error(
        `PE-4I.20 holdout breach: history=${fixtureId} classification=${row.holdoutClassification}`,
      );
    }
    return row;
  });
}

function strengthFeature(input: {
  join: Pe4I16OpponentStrengthJoin;
  selectedHistory: readonly Pe4I16TeamPerspectiveRow[];
  catalogue: Pe4I19StrengthCatalogue;
}): Pe4I20OpponentStrengthFeature {
  const priorAmbiguityByFixture = new Map(
    input.catalogue.rows.map((row) => [
      row.fixtureId,
      row.priorRegulationAmbiguityCandidateCount,
    ]),
  );
  const selectedHistoryRegulationAmbiguityCount = input.selectedHistory.filter(
    (row) => row.regulationAmbiguity,
  ).length;
  const cataloguePriorRegulationAmbiguityCandidateCount =
    input.selectedHistory.reduce(
      (sum, row) => sum + (priorAmbiguityByFixture.get(row.fixtureId) ?? 0),
      0,
    );

  if (input.join.status === "UNAVAILABLE") {
    return {
      status: "UNAVAILABLE",
      meanOpponentCommonStrengthAsOfM: null,
      observationCount: input.join.observationCount,
      matchedCount: input.join.audit.matchedCount,
      missingCount: input.join.audit.missingCount,
      missingKeys: [...input.join.audit.missingKeys],
      unavailableReason: input.join.reason,
      selectedHistoryRegulationAmbiguityCount,
      cataloguePriorRegulationAmbiguityCandidateCount,
      reconstructionBase: 1580,
      semantics: "common_baseline_not_venue_specific",
      comparableToVenueSpecificC0Elo: false,
      partialMeanComputed: false,
      zeroFillUsed: false,
    };
  }

  const mean =
    input.join.joins.reduce((sum, row) => sum + row.strengthAsOfKickoffM, 0) /
    input.join.joins.length;
  return {
    status: "AVAILABLE",
    meanOpponentCommonStrengthAsOfM: mean,
    observationCount: input.join.observationCount,
    matchedCount: input.join.audit.matchedCount,
    missingCount: 0,
    missingKeys: [],
    unavailableReason: null,
    selectedHistoryRegulationAmbiguityCount,
    cataloguePriorRegulationAmbiguityCandidateCount,
    reconstructionBase: 1580,
    semantics: "common_baseline_not_venue_specific",
    comparableToVenueSpecificC0Elo: false,
    partialMeanComputed: false,
    zeroFillUsed: false,
  };
}

export function buildPe4I20DatasetInMemory(input: {
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[];
  ledgerDigest: string;
  targetLimit?: number;
  expectedConflictCounts?: { conflictedKeys: number; missingPerspectives: number };
}): Pe4I20DatasetResult {
  const base = buildDevFeatureDatasetInMemory({
    ledger: input.ledger,
    targetLimit: input.targetLimit,
  });
  const catalogue = materializePe4I19StrengthCatalogue(input.ledger);
  const perspectives = expandTeamPerspectiveHistory(input.ledger);
  const perspectiveByTeamAndFixture = new Map<string, Pe4I16TeamPerspectiveRow>();
  for (const row of perspectives) {
    const key = perspectiveKey(row.teamId, row.fixtureId);
    if (perspectiveByTeamAndFixture.has(key)) {
      throw new Error(`PE-4I.20 duplicate team perspective ${key}`);
    }
    perspectiveByTeamAndFixture.set(key, row);
  }

  const pathARecords = base.pathARecords.map((record): Pe4I20PathARecord => {
    const selectedHistory = selectedHistoryForRecord(
      record,
      perspectiveByTeamAndFixture,
    );
    const join = joinOpponentStrengthFromPe4I19Catalogue({
      selectedHistory,
      targetKickoffUtc: record.kickoffUtc,
      catalogue,
    });
    return {
      ...record,
      pe4i20ProtocolVersion: PE4I20_PROTOCOL_VERSION,
      opponentStrength: strengthFeature({ join, selectedHistory, catalogue }),
    };
  });
  const pathBRecords = base.pathBRecords;

  const devPerspectives = perspectives.filter(
    (row) => row.holdoutClassification === "dev_or_conf_eligible",
  );
  const missingPerspectiveRows = devPerspectives.filter(
    (row) =>
      !catalogue.strengthByTeamAndKickoffM.has(
        pe4I19StrengthJoinKey(row.opponentTeamId, row.kickoffUtc),
      ),
  );
  const unavailableByReason: Record<string, number> = {};
  const uniqueMissingKeys = new Set<string>();
  let availableRecordCount = 0;
  for (const row of pathARecords) {
    if (row.opponentStrength.status === "AVAILABLE") {
      availableRecordCount += 1;
    } else {
      const reason = row.opponentStrength.unavailableReason ?? "unknown";
      unavailableByReason[reason] = (unavailableByReason[reason] ?? 0) + 1;
      for (const key of row.opponentStrength.missingKeys) uniqueMissingKeys.add(key);
    }
  }

  const expectedConflicts = input.expectedConflictCounts;
  const conflictCountsPreserved =
    expectedConflicts == null ||
    (catalogue.conflictedStrengthKeyCount === expectedConflicts.conflictedKeys &&
      missingPerspectiveRows.length === expectedConflicts.missingPerspectives);
  if (!conflictCountsPreserved) {
    throw new Error(
      `PE-4I.20 conflict lineage mismatch: keys=${catalogue.conflictedStrengthKeyCount} perspectives=${missingPerspectiveRows.length}`,
    );
  }

  const keysA = pathARecords.map(populationKey);
  const keysB = pathBRecords.map(populationKey);
  const populationParity =
    keysA.length === keysB.length && keysA.every((key, index) => key === keysB[index]);
  if (!populationParity) {
    throw new Error("PE-4I.20 fail-closed: Path A/B population mismatch");
  }

  const calendar2025TargetsOrHistory = pathARecords.filter((row) =>
    row.kickoffUtc.startsWith("2025-"),
  ).length;
  const providerSeason2025TargetsOrHistory = pathARecords.filter(
    (row) => row.providerSeason === "2025",
  ).length;
  const holdoutPass =
    calendar2025TargetsOrHistory === 0 && providerSeason2025TargetsOrHistory === 0;
  if (!holdoutPass) {
    throw new Error("PE-4I.20 fail-closed: 2025 holdout firewall breached");
  }

  return {
    protocol: pe4I20Protocol(),
    protocolDigest: digestPe4I20Protocol(),
    providerCallsMade: 0,
    productionWiring: PE4I20_PRODUCTION_WIRING,
    ledgerDigest: input.ledgerDigest,
    catalogueDigest: catalogue.digest,
    basePathADigest: base.pathADigest,
    basePathBDigest: base.pathBDigest,
    pathADigest: shaBody(pathARecords),
    pathBDigest: shaBody(pathBRecords),
    targetCount: base.eligibility.eligibleCount,
    pathARowCount: pathARecords.length,
    pathBRowCount: pathBRecords.length,
    pathARecords,
    pathBRecords,
    strengthCoverage: {
      emittedRecordCount: pathARecords.length,
      availableRecordCount,
      unavailableRecordCount: pathARecords.length - availableRecordCount,
      unavailableByReason,
      uniqueMissingKeysInEmittedRows: [...uniqueMissingKeys].sort(),
      conflictedStrengthKeyCount: catalogue.conflictedStrengthKeyCount,
      devPerspectiveJoinCandidateCount: devPerspectives.length,
      devPerspectiveJoinMatchedCount:
        devPerspectives.length - missingPerspectiveRows.length,
      devPerspectiveJoinMissingCount: missingPerspectiveRows.length,
      expectedConflictedStrengthKeyCount:
        expectedConflicts?.conflictedKeys ?? catalogue.conflictedStrengthKeyCount,
      expectedDevPerspectiveJoinMissingCount:
        expectedConflicts?.missingPerspectives ?? missingPerspectiveRows.length,
      conflictCountsPreserved,
      noPartialMeans: true,
      noZeroFill: true,
    },
    holdoutFirewall: {
      calendar2025TargetsOrHistory,
      providerSeason2025TargetsOrHistory,
      pass: holdoutPass,
    },
    populationParity,
    artifactDirRelative: path
      .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I20_DATASET_ARTIFACT_SUBDIR)
      .replace(/\\/g, "/"),
    artifactsWritten: [],
  };
}

function writeExclusiveDirectory(dir: string): void {
  if (existsSync(dir)) {
    const entries = readdirSync(dir);
    if (entries.length > 0) {
      throw new Error(`PE-4I.20 refuses to overwrite existing artifact directory: ${dir}`);
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function bodyDigest(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function writePe4I20DatasetArtifacts(
  result: Pe4I20DatasetResult,
  cwd = process.cwd(),
): Pe4I20DatasetResult {
  const dir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I20_DATASET_ARTIFACT_SUBDIR);
  writeExclusiveDirectory(dir);
  const files = [
    "feature-dataset-path-a-strength.jsonl",
    "feature-dataset-path-b-xg.jsonl",
    "strength-coverage-audit.json",
    "holdout-firewall-audit.json",
    "dataset-manifest.json",
  ];
  const pathABody = result.pathARecords.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const pathBBody = result.pathBRecords.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const strengthBody = `${JSON.stringify(result.strengthCoverage, null, 2)}\n`;
  const holdoutBody = `${JSON.stringify(result.holdoutFirewall, null, 2)}\n`;
  writeFileSync(path.join(dir, files[0]), pathABody, "utf8");
  writeFileSync(path.join(dir, files[1]), pathBBody, "utf8");
  writeFileSync(path.join(dir, files[2]), strengthBody, "utf8");
  writeFileSync(path.join(dir, files[3]), holdoutBody, "utf8");
  writeJson(path.join(dir, files[4]), {
    protocol: result.protocol,
    protocolDigest: result.protocolDigest,
    ledgerDigest: result.ledgerDigest,
    catalogueDigest: result.catalogueDigest,
    basePathADigest: result.basePathADigest,
    basePathBDigest: result.basePathBDigest,
    pathADigest: result.pathADigest,
    pathBDigest: result.pathBDigest,
    targetCount: result.targetCount,
    pathARowCount: result.pathARowCount,
    pathBRowCount: result.pathBRowCount,
    providerCallsMade: 0,
    productionWiring: false,
    labelsEmitted: false,
    fileDigests: {
      [files[0]]: bodyDigest(pathABody),
      [files[1]]: bodyDigest(pathBBody),
      [files[2]]: bodyDigest(strengthBody),
      [files[3]]: bodyDigest(holdoutBody),
    },
  });
  return { ...result, artifactsWritten: files };
}

export function buildPe4I20DatasetFromLocalLedger(input?: {
  cwd?: string;
  targetLimit?: number;
}): Pe4I20DatasetResult {
  const cwd = input?.cwd ?? process.cwd();
  const loaded = loadOrMaterializeLedger({ cwd, writeI16Artifacts: false });
  return buildPe4I20DatasetInMemory({
    ledger: loaded.rows,
    ledgerDigest: loaded.ledgerDigest,
    targetLimit: input?.targetLimit,
    expectedConflictCounts: { conflictedKeys: 8, missingPerspectives: 16 },
  });
}
