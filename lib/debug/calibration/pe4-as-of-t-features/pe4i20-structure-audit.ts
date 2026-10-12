/** PE-4I.20 renewed, label-free structural audit. */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import type { Pe4I20DatasetResult } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-dataset";
import {
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
  PE4I20_AUDIT_PROTOCOL_VERSION,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";
import {
  extractAllowlistedNumerics,
  pe4I20NumericAllowlist,
} from "@/lib/debug/calibration/pe4-as-of-t-features/schema-inventory";
import {
  runStructureAuditOnRows,
  type LoadedRow,
} from "@/lib/debug/calibration/pe4-as-of-t-features/structure-audit-run";

export type Pe4I20StructuralAuditResult = {
  protocolVersion: typeof PE4I20_AUDIT_PROTOCOL_VERSION;
  providerCallsMade: 0;
  noFeatureVsOutcomeStats: true;
  labelsRead: false;
  datasetLineage: {
    ledgerDigest: string;
    catalogueDigest: string;
    basePathADigest: string;
    basePathBDigest: string;
    strengthPathADigest: string;
    pathBDigest: string;
    targetCount: number;
    pathARowCount: number;
    pathBRowCount: number;
  };
  schemaInventory: ReturnType<typeof runStructureAuditOnRows>["schemaInventory"];
  presenceAudit: ReturnType<typeof runStructureAuditOnRows>["presence"];
  descriptiveStats: ReturnType<typeof runStructureAuditOnRows>["descriptive"];
  exactRedundancy: ReturnType<typeof runStructureAuditOnRows>["exact"];
  correlationAudit: ReturnType<typeof runStructureAuditOnRows>["correlation"];
  windowRedundancy: ReturnType<typeof runStructureAuditOnRows>["window"];
  venueModeAudit: ReturnType<typeof runStructureAuditOnRows>["venue"];
  sparseHistoryAudit: ReturnType<typeof runStructureAuditOnRows>["sparse"];
  featureFamilyMatrix: ReturnType<typeof runStructureAuditOnRows>["familyMatrix"];
  reproducibility: {
    pass: boolean;
    pass1Digest: string;
    pass2Digest: string;
    shuffledDigest: string;
  };
  comparisons: {
    targetCountPreserved: boolean;
    pathARowCountPreserved: boolean;
    pathBRowCountPreserved: boolean;
    populationParityPreserved: boolean;
    pathBByteDigestPreservedFromPe4I17: boolean;
    strengthPathAChangedFromPe4I17: boolean;
    strengthCandidateCount: number;
  };
  auditDigest: string;
  artifactDirRelative: string;
  artifactsWritten: string[];
};

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function toLoadedRows(dataset: Pe4I20DatasetResult): LoadedRow[] {
  const allowlist = pe4I20NumericAllowlist();
  return dataset.pathARecords.map((pathA, index) => {
    const pathB = dataset.pathBRecords[index];
    if (!pathB) throw new Error(`PE-4I.20 audit missing Path B row index=${index}`);
    if (
      pathA.targetFixtureId !== pathB.targetFixtureId ||
      pathA.teamId !== pathB.teamId ||
      pathA.windowId !== pathB.windowId ||
      pathA.venueMode !== pathB.venueMode
    ) {
      throw new Error(`PE-4I.20 audit Path A/B key mismatch index=${index}`);
    }
    return {
      meta: {
        targetFixtureId: pathA.targetFixtureId,
        kickoffUtc: pathA.kickoffUtc,
        competition: pathA.competition,
        providerSeason: pathA.providerSeason,
        teamId: pathA.teamId,
        windowId: pathA.windowId,
        venueMode: pathA.venueMode,
        scheduleRestStatus: pathA.scheduleRest.status,
      },
      numerics: extractAllowlistedNumerics(
        pathA as unknown as Record<string, unknown>,
        pathB as unknown as Record<string, unknown>,
        allowlist,
      ),
    };
  });
}

function deterministicShuffle(rows: readonly LoadedRow[], seed: string): LoadedRow[] {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i--) {
    const h = createHash("sha256").update(`${seed}:${i}`, "utf8").digest();
    const j = h.readUInt32BE(0) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function buildPe4I20StructuralAuditInMemory(
  dataset: Pe4I20DatasetResult,
  expectedCorpus?: { targetCount: number; rowCountPerPath: number },
): Pe4I20StructuralAuditResult {
  const allowlist = pe4I20NumericAllowlist();
  const rows = toLoadedRows(dataset);
  const args = {
    allowlist,
    pathASample: dataset.pathARecords[0] as unknown as Record<string, unknown>,
    pathBSample: dataset.pathBRecords[0] as unknown as Record<string, unknown>,
  };
  const pass1 = runStructureAuditOnRows({ rows, ...args });
  const pass2 = runStructureAuditOnRows({ rows, ...args });
  const shuffled = runStructureAuditOnRows({
    rows: deterministicShuffle(rows, dataset.pathADigest),
    ...args,
  });
  const reproducibility = {
    pass:
      pass1.auditDigest === pass2.auditDigest &&
      pass1.auditDigest === shuffled.auditDigest,
    pass1Digest: pass1.auditDigest,
    pass2Digest: pass2.auditDigest,
    shuffledDigest: shuffled.auditDigest,
  };
  if (!reproducibility.pass) {
    throw new Error("PE-4I.20 structural audit is not shuffle deterministic");
  }

  const comparisons = {
    targetCountPreserved:
      expectedCorpus == null || dataset.targetCount === expectedCorpus.targetCount,
    pathARowCountPreserved:
      expectedCorpus == null || dataset.pathARowCount === expectedCorpus.rowCountPerPath,
    pathBRowCountPreserved:
      expectedCorpus == null || dataset.pathBRowCount === expectedCorpus.rowCountPerPath,
    populationParityPreserved: dataset.populationParity,
    pathBByteDigestPreservedFromPe4I17:
      dataset.pathBDigest === dataset.basePathBDigest,
    strengthPathAChangedFromPe4I17:
      dataset.pathADigest !== dataset.basePathADigest,
    strengthCandidateCount: allowlist.filter((key) => key.startsWith("opponentStrength."))
      .length,
  };
  if (Object.values(comparisons).some((value) => value === false)) {
    throw new Error("PE-4I.20 structural comparison acceptance failed");
  }

  const datasetLineage = {
    ledgerDigest: dataset.ledgerDigest,
    catalogueDigest: dataset.catalogueDigest,
    basePathADigest: dataset.basePathADigest,
    basePathBDigest: dataset.basePathBDigest,
    strengthPathADigest: dataset.pathADigest,
    pathBDigest: dataset.pathBDigest,
    targetCount: dataset.targetCount,
    pathARowCount: dataset.pathARowCount,
    pathBRowCount: dataset.pathBRowCount,
  };
  const auditDigest = sha({
    protocolVersion: PE4I20_AUDIT_PROTOCOL_VERSION,
    datasetLineage,
    structuralDigest: pass1.auditDigest,
    familyStatuses: pass1.familyMatrix.families.map((row) => ({
      familyId: row.familyId,
      structuralStatus: row.structuralStatus,
    })),
    comparisons,
    labelsRead: false,
  });

  return {
    protocolVersion: PE4I20_AUDIT_PROTOCOL_VERSION,
    providerCallsMade: 0,
    noFeatureVsOutcomeStats: true,
    labelsRead: false,
    datasetLineage,
    schemaInventory: pass1.schemaInventory,
    presenceAudit: pass1.presence,
    descriptiveStats: pass1.descriptive,
    exactRedundancy: pass1.exact,
    correlationAudit: pass1.correlation,
    windowRedundancy: pass1.window,
    venueModeAudit: pass1.venue,
    sparseHistoryAudit: pass1.sparse,
    featureFamilyMatrix: pass1.familyMatrix,
    reproducibility,
    comparisons,
    auditDigest,
    artifactDirRelative: path
      .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I20_AUDIT_ARTIFACT_SUBDIR)
      .replace(/\\/g, "/"),
    artifactsWritten: [],
  };
}

export function writePe4I20StructuralAuditArtifacts(
  audit: Pe4I20StructuralAuditResult,
  cwd = process.cwd(),
): Pe4I20StructuralAuditResult {
  const dir = path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I20_AUDIT_ARTIFACT_SUBDIR);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`PE-4I.20 refuses to overwrite existing audit directory: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
  const artifacts: Array<[string, unknown]> = [
    ["schema-inventory.json", audit.schemaInventory],
    ["presence-audit.json", audit.presenceAudit],
    ["descriptive-stats.json", audit.descriptiveStats],
    ["exact-redundancy.json", audit.exactRedundancy],
    ["correlation-audit.json", audit.correlationAudit],
    ["window-redundancy.json", audit.windowRedundancy],
    ["venue-mode-audit.json", audit.venueModeAudit],
    ["sparse-history-audit.json", audit.sparseHistoryAudit],
    ["feature-family-matrix.json", audit.featureFamilyMatrix],
    ["reproducibility-audit.json", audit.reproducibility],
    ["structural-comparisons.json", audit.comparisons],
  ];
  const fileDigests: Record<string, string> = {};
  for (const [name, value] of artifacts) {
    const body = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(path.join(dir, name), body, "utf8");
    fileDigests[name] = createHash("sha256").update(body, "utf8").digest("hex");
  }
  const manifestName = "audit-manifest.json";
  writeFileSync(path.join(dir, manifestName), `${JSON.stringify({
    protocolVersion: audit.protocolVersion,
    datasetLineage: audit.datasetLineage,
    auditDigest: audit.auditDigest,
    labelsRead: false,
    noFeatureVsOutcomeStats: true,
    providerCallsMade: 0,
    fileDigests,
  }, null, 2)}\n`, "utf8");
  return {
    ...audit,
    artifactsWritten: [...artifacts.map(([name]) => name), manifestName],
  };
}
