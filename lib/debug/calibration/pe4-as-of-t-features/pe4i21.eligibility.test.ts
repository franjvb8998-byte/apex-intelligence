/**
 * PE-4I.21 — offline feature eligibility contract tests.
 * In-memory classification plus read-only structural audit checks.
 * Does not write research artifacts, read labels, or read dataset rows.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { isResearchHoldoutOutcomeEvidence } from "@/lib/debug/calibration/pe4-acquisition/holdout";
import { goalsG1Protocol } from "@/lib/debug/calibration/goals/g1/protocol";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import {
  assertPinnedManifestDigests,
  assertSparseAuditMatchesPinnedPartition,
  assertStructuralReadPath,
  buildPe4I21EligibilityContract,
  classifyEligibilityField,
  classifyTargetPlacement,
  competitionRowsFromSparseAudit,
  eligibilityClassHits,
  exclusiveDirectoryDecision,
  isIgnorableSlopeZeroAffine,
  manifestDigestsFromPayloads,
  summarizeCompetitionRows,
  varianceRowsFromDescriptiveStats,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-eligibility";
import {
  PE4I21_PINNED_DIGESTS,
  PE4I21_PRODUCTION_WIRING,
  PE4I21_ROWS_PER_TARGET,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-protocol";
import {
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
  PE4I20_DATASET_ARTIFACT_SUBDIR,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";
import { pe4I20NumericAllowlist } from "@/lib/debug/calibration/pe4-as-of-t-features/schema-inventory";

const auditDir = path.join(
  process.cwd(),
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I20_AUDIT_ARTIFACT_SUBDIR,
);

describe("PE-4I.21 feature eligibility contract", () => {
  it("partitions all 117 candidates into one class independent of field order", () => {
    const allowlist = pe4I20NumericAllowlist();
    const forward = buildPe4I21EligibilityContract({ allowlist });
    const reversed = buildPe4I21EligibilityContract({
      allowlist: [...allowlist].reverse(),
    });
    expect(forward.numericCandidateCount).toBe(117);
    expect(forward.classCounts).toEqual({
      INELIGIBLE_CONSTANT: 18,
      ALIAS: 19,
      DERIVED_REPRESENTATION: 20,
      COVERAGE_METADATA: 30,
      PRIMARY_NUMERIC: 30,
    });
    expect(reversed.contractDigest).toBe(forward.contractDigest);
    expect(forward.fields.map((field) => field.field)).toEqual(
      [...allowlist].sort((a, b) => a.localeCompare(b)),
    );
    expect(forward.labelsRead).toBe(false);
    expect(forward.productionWiring).toBe(false);
    for (const field of forward.fields) {
      expect(eligibilityClassHits(field.field)).toEqual([field.eligibilityClass]);
    }
  });

  it("keeps exact aliases, the possession complement, and the rest hour/day identity", () => {
    const contract = buildPe4I21EligibilityContract();
    const byId = new Map(contract.aliasGroups.map((group) => [group.groupId, group]));
    expect(byId.get("possession_complement")).toMatchObject({
      canonical: "pathA.possessionFor.mean",
      identity: "AFFINE_COMPLEMENT",
      aliases: ["pathA.possessionAgainst.mean"],
    });
    expect(byId.get("rest_hours_days")).toMatchObject({
      canonical: "scheduleRest.daysSincePreviousMatch",
      identity: "AFFINE_UNIT_SCALE",
      aliases: ["scheduleRest.hoursSincePreviousMatch"],
    });
    expect(classifyEligibilityField("opponentStrength.observationCount")).toMatchObject({
      eligibilityClass: "ALIAS",
      canonicalField: "opponentStrength.matchedCount",
    });
    expect(classifyEligibilityField("pathA.observationCount").canonicalField).toBe(
      "observationCount",
    );
    expect(classifyEligibilityField("pathA.possessionFor.mean").eligibilityClass).toBe(
      "PRIMARY_NUMERIC",
    );
    expect(classifyEligibilityField("scheduleRest.daysSincePreviousMatch").eligibilityClass).toBe(
      "PRIMARY_NUMERIC",
    );
    const possessionSum = contract.derivationBlocks.find(
      (block) => block.derived === "pathA.possessionAgainst.sum",
    );
    expect(possessionSum?.parents).toEqual([
      "pathA.possessionFor.mean",
      "pathA.shotsFor.obsCount",
    ]);
  });

  it("excludes the 18 constant-zero fields and ignores slope-zero affine pairs", () => {
    const contract = buildPe4I21EligibilityContract();
    const constants = contract.fields
      .filter((field) => field.eligibilityClass === "INELIGIBLE_CONSTANT")
      .map((field) => field.field);
    expect(constants).toContain(
      "opponentStrength.selectedHistoryRegulationAmbiguityCount",
    );
    expect(constants).toContain("pathB.coverage.xgAmbiguousSides");
    expect(constants.filter((field) => field.endsWith(".ambiguousCount"))).toHaveLength(16);
    expect(classifyEligibilityField("pathB.anyXgPresent").eligibilityClass).toBe(
      "COVERAGE_METADATA",
    );
    expect(
      isIgnorableSlopeZeroAffine({
        fieldA: "derived.goalDiffMean",
        fieldB: "opponentStrength.selectedHistoryRegulationAmbiguityCount",
        reason: "AFFINE_NEAR_PERFECT",
        detail: "y≈0.00000*x+0.00000 r2=1.000000",
      }),
    ).toBe(true);
    expect(
      isIgnorableSlopeZeroAffine({
        fieldA: "pathA.possessionAgainst.mean",
        fieldB: "pathA.possessionFor.mean",
        reason: "AFFINE_NEAR_PERFECT",
        detail: "y≈-1.00000*x+100.000 r2=1.000000",
      }),
    ).toBe(false);
  });

  it("rejects unknown fields, duplicate allowlists, and conflicting variance evidence", () => {
    expect(() =>
      buildPe4I21EligibilityContract({
        allowlist: [...pe4I20NumericAllowlist(), "pathA.notAFeature"],
      }),
    ).toThrow(/unknown numeric candidate/);
    expect(() =>
      buildPe4I21EligibilityContract({
        allowlist: [...pe4I20NumericAllowlist(), pe4I20NumericAllowlist()[0]!],
      }),
    ).toThrow(/duplicate field/);
    expect(() => classifyEligibilityField("not.a.field")).toThrow(/unknown numeric candidate/);
    expect(() =>
      buildPe4I21EligibilityContract({
        varianceEvidence: [
          {
            field: "observationCount",
            varianceClass: "CONSTANT",
            uniqueFinite: 1,
            min: 0,
            max: 0,
          },
        ],
      }),
    ).toThrow(/constant zero but classified/);
  });

  it("keeps seven windows, three venue modes, and blocks derived fields from the primary matrix", () => {
    const contract = buildPe4I21EligibilityContract();
    expect(contract.designMatrixRules.retainWindowIds).toEqual([
      "last_3",
      "last_5",
      "last_8",
      "last_10",
      "trailing_30d",
      "trailing_60d",
      "trailing_90d",
    ]);
    expect(contract.designMatrixRules.retainVenueModes).toEqual(["all", "home", "away"]);
    expect(PE4I21_ROWS_PER_TARGET).toBe(42);
    expect(
      contract.fields.some(
        (field) =>
          field.eligibilityClass === "DERIVED_REPRESENTATION" &&
          field.coEligibleInPrimaryMatrix,
      ),
    ).toBe(false);
    expect(contract.fields.find((field) => field.field === "derived.winRate")?.derivationParents)
      .toEqual(["pathA.results.wins", "pathA.results.resultObsCount"]);
  });

  it("partitions 786 primary and 183 separate-audit targets and excludes synthetic holdouts", () => {
    const population = summarizeCompetitionRows([
      { competitionId: "39", rows: 23856 },
      { competitionId: "667", rows: 7140 },
      { competitionId: "1022", rows: 378 },
      { competitionId: "15", rows: 84 },
      { competitionId: "866", rows: 42 },
      { competitionId: "937", rows: 42 },
      { competitionId: "48", rows: 2604 },
      { competitionId: "2", rows: 2268 },
      { competitionId: "45", rows: 1722 },
      { competitionId: "3", rows: 1680 },
      { competitionId: "848", rows: 882 },
    ]);
    expect(population.primaryTargets).toBe(786);
    expect(population.separateAuditTargets).toBe(183);
    expect(population.separateAuditKnownTargets).toBe(179);
    expect(population.separateAuditUnknownTargets).toBe(4);
    expect(population.totalTargets).toBe(969);
    expect(population.totalRows).toBe(40_698);
    expect(classifyTargetPlacement({
      competitionId: "39",
      kickoffUtc: "2024-08-16T19:00:00.000Z",
      providerSeason: "2024",
    })).toBe("PRIMARY");
    expect(classifyTargetPlacement({
      competitionId: "667",
      kickoffUtc: "2024-07-20T12:00:00.000Z",
      providerSeason: "2024",
    })).toBe("SEPARATE_AUDIT");
    expect(classifyTargetPlacement({
      competitionId: "1022",
      kickoffUtc: "2024-07-31T01:00:00.000Z",
      providerSeason: "2024",
    })).toBe("SEPARATE_AUDIT");
    expect(classifyTargetPlacement({
      competitionId: "15",
      kickoffUtc: "2024-01-01T12:00:00.000Z",
      providerSeason: "2024",
    })).toBe("SEPARATE_AUDIT_UNKNOWN");
    expect(classifyTargetPlacement({
      competitionId: "39",
      kickoffUtc: "2024-08-16T19:00:00.000Z",
      providerSeason: "2025",
    })).toBe("EXCLUDED_HOLDOUT");
    expect(classifyTargetPlacement({
      competitionId: "39",
      kickoffUtc: "2025-08-16T19:00:00.000Z",
      providerSeason: "2024",
    })).toBe("EXCLUDED_HOLDOUT");
    expect(() => classifyTargetPlacement({
      competitionId: "39",
      kickoffUtc: "not-a-kickoff",
      providerSeason: "2024",
    })).toThrow(/unknown kickoff/);
    expect(() => classifyTargetPlacement({
      competitionId: " ",
      kickoffUtc: "2024-08-16T19:00:00.000Z",
      providerSeason: "2024",
    })).toThrow(/invalid competition id/);
    expect(() => summarizeCompetitionRows([
      { competitionId: "39", rows: 10 },
    ])).toThrow(/not a multiple/);
    expect(() => summarizeCompetitionRows([
      { competitionId: "39", rows: 42 },
      { competitionId: "39", rows: 42 },
    ])).toThrow(/duplicate competition/);
  });

  it("reconciles the pinned structural audit without reading labels or dataset rows", () => {
    const descriptive = JSON.parse(readFileSync(path.join(auditDir, "descriptive-stats.json"), "utf8")) as unknown;
    const sparse = JSON.parse(readFileSync(path.join(auditDir, "sparse-history-audit.json"), "utf8")) as unknown;
    const auditManifest = JSON.parse(readFileSync(path.join(auditDir, "audit-manifest.json"), "utf8")) as unknown;
    const datasetManifest = JSON.parse(readFileSync(
      path.join(
        process.cwd(),
        PE4I2_CACHE_ROOT_RELATIVE,
        PE4I20_DATASET_ARTIFACT_SUBDIR,
        "dataset-manifest.json",
      ),
      "utf8",
    )) as unknown;
    const digests = manifestDigestsFromPayloads(auditManifest, datasetManifest);
    expect(digests.auditDigest).toBe(PE4I21_PINNED_DIGESTS.auditDigest);
    expect(digests.labelsRead).toBe(false);
    assertPinnedManifestDigests(digests);
    const contract = buildPe4I21EligibilityContract({
      varianceEvidence: varianceRowsFromDescriptiveStats(descriptive),
      requireCompleteVarianceEvidence: true,
    });
    const population = assertSparseAuditMatchesPinnedPartition(
      competitionRowsFromSparseAudit(sparse),
    );
    expect(contract.classCounts.INELIGIBLE_CONSTANT).toBe(18);
    expect(population.primaryTargets).toBe(786);
    expect(population.separateAuditTargets).toBe(183);
    expect(() => assertPinnedManifestDigests({
      ...digests,
      auditDigest: "0".repeat(64),
    })).toThrow(/auditDigest/);
  });

  it("refuses preserved directories, dataset rows, and label files without creating a contract directory", () => {
    const preserved = path.join(auditDir);
    const names = readdirSync(preserved);
    expect(names.length).toBeGreaterThan(0);
    expect(() => exclusiveDirectoryDecision({
      directoryPath: preserved,
      exists: true,
      entryNames: names,
    })).toThrow(/preserved research directory/);
    const absent = path.join(
      process.cwd(),
      PE4I2_CACHE_ROOT_RELATIVE,
      "stage2i21-feature-contract-v1",
    );
    expect(exclusiveDirectoryDecision({
      directoryPath: absent,
      exists: false,
      entryNames: [],
    })).toEqual({ ok: true });
    expect(() => exclusiveDirectoryDecision({
      directoryPath: absent,
      exists: true,
      entryNames: ["protocol.json"],
    })).toThrow(/refuses to overwrite existing file protocol.json/);
    expect(() => assertStructuralReadPath(
      "data/calibration/pe4-acquisition-v1/stage2i17-dev-dataset/target-labels-separated.json",
    )).toThrow(/target-label/);
    expect(() => assertStructuralReadPath(
      "data/calibration/pe4-acquisition-v1/stage2i20-strength-integrated-dev-dataset-v1/feature-dataset-path-a-strength.jsonl",
    )).toThrow(/feature dataset rows/);
  });

  it("keeps production activation, C0, G1, and holdout outcome evidence closed", () => {
    expect(PE4I21_PRODUCTION_WIRING).toBe(false);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(goalsG1Protocol(10).selectedShrinkageK).toBe(10);
    expect(isResearchHoldoutOutcomeEvidence({
      providerSeasonId: "2025",
      kickoffUtc: "2025-08-16T19:00:00.000Z",
    })).toBe(false);
    expect(PE4I21_PINNED_DIGESTS.pathBDigest).toBe(PE4I21_PINNED_DIGESTS.basePathBDigest);
  });
});
