/**
 * PE-4I.21 — deterministic, label-free feature eligibility contract.
 * Classifies the PE-4I.20 numeric allowlist. Does not fit, rank, or read outcomes.
 */

import { createHash } from "node:crypto";
import path from "node:path";

import { pe4I4PrimaryStatsInclusion } from "@/lib/debug/calibration/pe4-acquisition/competition-policy";
import { classifyHoldoutForResearch } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import {
  PE4I17_EMIT_WINDOW_IDS,
  PE4I17_VENUE_MODES,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import { pe4I20NumericAllowlist } from "@/lib/debug/calibration/pe4-as-of-t-features/schema-inventory";
import {
  PE4I21_ARTIFACT_SUBDIR,
  PE4I21_FORBIDDEN_ARTIFACT_SUBDIRS,
  PE4I21_PINNED_DIGESTS,
  PE4I21_PINNED_POPULATION,
  PE4I21_PLANNED_ARTIFACTS,
  PE4I21_PROTOCOL_VERSION,
  PE4I21_ROWS_PER_TARGET,
  pe4I21Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i21-protocol";

export const PE4I21_ELIGIBILITY_CLASSES = [
  "INELIGIBLE_CONSTANT",
  "ALIAS",
  "DERIVED_REPRESENTATION",
  "COVERAGE_METADATA",
  "PRIMARY_NUMERIC",
] as const;

export type Pe4I21EligibilityClass = (typeof PE4I21_ELIGIBILITY_CLASSES)[number];

export type Pe4I21AliasIdentity =
  | "EXACT_EQUAL"
  | "AFFINE_COMPLEMENT"
  | "AFFINE_UNIT_SCALE"
  | "CODE_ASSIGNMENT";

export type Pe4I21AliasGroup = {
  groupId: string;
  canonical: string;
  identity: Pe4I21AliasIdentity;
  detail: string;
  aliases: readonly string[];
};

export type Pe4I21FieldEligibility = {
  field: string;
  eligibilityClass: Pe4I21EligibilityClass;
  canonicalField: string | null;
  aliasGroupId: string | null;
  coEligibleInPrimaryMatrix: boolean;
  derivationParents: readonly string[];
};

export type Pe4I21CompetitionPlacement =
  | "PRIMARY"
  | "SEPARATE_AUDIT"
  | "SEPARATE_AUDIT_UNKNOWN";

export type Pe4I21TargetPlacement =
  | Pe4I21CompetitionPlacement
  | "EXCLUDED_HOLDOUT";

export type Pe4I21PopulationSummary = {
  primaryTargets: number;
  separateAuditTargets: number;
  separateAuditKnownTargets: number;
  separateAuditUnknownTargets: number;
  totalTargets: number;
  primaryRows: number;
  separateAuditRows: number;
  totalRows: number;
  rowsPerTarget: number;
  competitions: Array<{
    competitionId: string;
    rows: number;
    targets: number;
    placement: Pe4I21CompetitionPlacement;
  }>;
};

export type Pe4I21VarianceEvidence = {
  field: string;
  varianceClass: string;
  uniqueFinite: number;
  min: number;
  max: number;
};

export type Pe4I21EligibilityContract = {
  protocolVersion: typeof PE4I21_PROTOCOL_VERSION;
  labelsRead: false;
  noFeatureVsOutcomeStats: true;
  providerCallsMade: 0;
  productionWiring: false;
  numericCandidateCount: number;
  classCounts: Record<Pe4I21EligibilityClass, number>;
  fields: Pe4I21FieldEligibility[];
  aliasGroups: Pe4I21AliasGroup[];
  derivationBlocks: Array<{ derived: string; parents: string[] }>;
  designMatrixRules: Pe4I21DesignMatrixRules;
  population: Pe4I21PopulationSummary;
  contractDigest: string;
};

export type Pe4I21DesignMatrixRules = {
  retainWindowIds: readonly string[];
  retainVenueModes: readonly string[];
  atMostOneWindowIdPerMatrix: true;
  venueModesNotCollapsed: true;
  scheduleRestScope: "target_team_window_invariant";
  nestedRestCountsRemainEligible: true;
  strengthNullRemainsNull: true;
  pathBZeroFillForbidden: true;
  pathBPopulationShrinkForbidden: true;
  ignoreSlopeZeroAffineAgainstConstant: true;
  doNotCoEnterDerivedWithParents: true;
  doNotCoEnterAliasWithCanonical: true;
};

/**
 * DEV competition row counts from the PE-4I.20 sparse-history audit.
 * Placement is derived from the frozen PE-4I.4 policy, not stored here.
 */
export const PE4I21_PINNED_COMPETITION_ROWS = [
  { competitionId: "2", rows: 2268 },
  { competitionId: "3", rows: 1680 },
  { competitionId: "15", rows: 84 },
  { competitionId: "39", rows: 23856 },
  { competitionId: "45", rows: 1722 },
  { competitionId: "48", rows: 2604 },
  { competitionId: "667", rows: 7140 },
  { competitionId: "848", rows: 882 },
  { competitionId: "866", rows: 42 },
  { competitionId: "937", rows: 42 },
  { competitionId: "1022", rows: 378 },
] as const;

export const PE4I21_ALIAS_GROUPS: readonly Pe4I21AliasGroup[] = [
  {
    groupId: "window_observation_count",
    canonical: "observationCount",
    identity: "EXACT_EQUAL",
    detail: "observationCount equals pathA.observationCount on every DEV row",
    aliases: ["pathA.observationCount"],
  },
  {
    groupId: "strength_matched_count",
    canonical: "opponentStrength.matchedCount",
    identity: "EXACT_EQUAL",
    detail:
      "opponentStrength.observationCount is assigned from the join matched count",
    aliases: ["opponentStrength.observationCount"],
  },
  {
    groupId: "shot_family_observation_count",
    canonical: "pathA.shotsFor.obsCount",
    identity: "EXACT_EQUAL",
    detail:
      "shots, shots on target, corners, and possession share one observation count",
    aliases: [
      "pathA.shotsAgainst.obsCount",
      "pathA.shotsOnTargetFor.obsCount",
      "pathA.shotsOnTargetAgainst.obsCount",
      "pathA.cornersFor.obsCount",
      "pathA.cornersAgainst.obsCount",
      "pathA.possessionFor.obsCount",
      "pathA.possessionAgainst.obsCount",
    ],
  },
  {
    groupId: "result_observation_count",
    canonical: "pathA.results.resultObsCount",
    identity: "EXACT_EQUAL",
    detail: "goals-for and goals-against observation counts equal resultObsCount",
    aliases: ["pathA.goalsFor.obsCount", "pathA.goalsAgainst.obsCount"],
  },
  {
    groupId: "yellow_card_observation_count",
    canonical: "pathA.yellowCardsFor.obsCount",
    identity: "EXACT_EQUAL",
    detail: "yellow-card for and against observation counts are identical",
    aliases: ["pathA.yellowCardsAgainst.obsCount"],
  },
  {
    groupId: "red_card_observation_count",
    canonical: "pathA.redCardsFor.obsCount",
    identity: "EXACT_EQUAL",
    detail: "red-card for and against observation counts are identical",
    aliases: ["pathA.redCardsAgainst.obsCount"],
  },
  {
    groupId: "xg_observation_count",
    canonical: "pathB.expectedGoalsFor.obsCount",
    identity: "EXACT_EQUAL",
    detail: "xG for and against observation counts are identical",
    aliases: ["pathB.expectedGoalsAgainst.obsCount"],
  },
  {
    groupId: "possession_complement",
    canonical: "pathA.possessionFor.mean",
    identity: "AFFINE_COMPLEMENT",
    detail: "possessionAgainst.mean = 100 - possessionFor.mean",
    aliases: ["pathA.possessionAgainst.mean"],
  },
  {
    groupId: "rest_hours_days",
    canonical: "scheduleRest.daysSincePreviousMatch",
    identity: "AFFINE_UNIT_SCALE",
    detail: "hoursSincePreviousMatch = 24 * daysSincePreviousMatch",
    aliases: ["scheduleRest.hoursSincePreviousMatch"],
  },
  {
    groupId: "goals_missing_count_copy",
    canonical: "pathA.results.goalsMissingOrAmbiguous",
    identity: "CODE_ASSIGNMENT",
    detail:
      "missingCounts.goalsMissingOrAmbiguous is assigned from results.goalsMissingOrAmbiguous",
    aliases: ["missingCounts.goalsMissingOrAmbiguous"],
  },
  {
    groupId: "shots_for_missing_count_copy",
    canonical: "pathA.shotsFor.missingCount",
    identity: "CODE_ASSIGNMENT",
    detail: "missingCounts.shotsForMissing is assigned from shotsFor.missingCount",
    aliases: ["missingCounts.shotsForMissing"],
  },
  {
    groupId: "shots_against_missing_count_copy",
    canonical: "pathA.shotsAgainst.missingCount",
    identity: "CODE_ASSIGNMENT",
    detail:
      "missingCounts.shotsAgainstMissing is assigned from shotsAgainst.missingCount",
    aliases: ["missingCounts.shotsAgainstMissing"],
  },
];

export const PE4I21_DESIGN_MATRIX_RULES: Pe4I21DesignMatrixRules = {
  retainWindowIds: PE4I17_EMIT_WINDOW_IDS,
  retainVenueModes: PE4I17_VENUE_MODES,
  atMostOneWindowIdPerMatrix: true,
  venueModesNotCollapsed: true,
  scheduleRestScope: "target_team_window_invariant",
  nestedRestCountsRemainEligible: true,
  strengthNullRemainsNull: true,
  pathBZeroFillForbidden: true,
  pathBPopulationShrinkForbidden: true,
  ignoreSlopeZeroAffineAgainstConstant: true,
  doNotCoEnterDerivedWithParents: true,
  doNotCoEnterAliasWithCanonical: true,
};

type AliasMembership = {
  groupId: string;
  canonical: string;
  role: "canonical" | "alias";
};

const CANONICAL_ALLOWLIST = pe4I20NumericAllowlist();
const CANONICAL_ALLOWLIST_SET = new Set(CANONICAL_ALLOWLIST);

if (CANONICAL_ALLOWLIST.length !== PE4I21_PINNED_POPULATION.numericCandidateCount) {
  throw new Error(
    `PE-4I.21 fail-closed: numeric allowlist length ${CANONICAL_ALLOWLIST.length}`,
  );
}
if (CANONICAL_ALLOWLIST_SET.size !== CANONICAL_ALLOWLIST.length) {
  throw new Error("PE-4I.21 fail-closed: duplicate numeric allowlist field");
}
if (PE4I21_ROWS_PER_TARGET !== 42) {
  throw new Error(
    `PE-4I.21 fail-closed: rows per target changed to ${PE4I21_ROWS_PER_TARGET}`,
  );
}

const ALIAS_MEMBERSHIP = buildAliasMembership(PE4I21_ALIAS_GROUPS);

function fail(message: string): never {
  throw new Error(`PE-4I.21 fail-closed: ${message}`);
}

function buildAliasMembership(
  groups: readonly Pe4I21AliasGroup[],
): Map<string, AliasMembership> {
  const map = new Map<string, AliasMembership>();
  for (const group of groups) {
    if (group.aliases.length === 0) fail(`alias group ${group.groupId} is empty`);
    if (map.has(group.canonical)) {
      fail(`conflicting alias canonical ${group.canonical}`);
    }
    map.set(group.canonical, {
      groupId: group.groupId,
      canonical: group.canonical,
      role: "canonical",
    });
    const seen = new Set<string>();
    for (const alias of group.aliases) {
      if (alias === group.canonical || seen.has(alias) || map.has(alias)) {
        fail(`conflicting alias membership ${alias}`);
      }
      seen.add(alias);
      map.set(alias, {
        groupId: group.groupId,
        canonical: group.canonical,
        role: "alias",
      });
    }
  }
  return map;
}

function isConstantRaw(field: string): boolean {
  return (
    field.endsWith(".ambiguousCount") ||
    field === "pathB.coverage.xgAmbiguousSides" ||
    field === "opponentStrength.selectedHistoryRegulationAmbiguityCount"
  );
}

function isAliasRaw(field: string): boolean {
  return ALIAS_MEMBERSHIP.get(field)?.role === "alias";
}

function isDerivedRaw(field: string): boolean {
  return field.startsWith("derived.") || field.endsWith(".sum");
}

function isCoverageRaw(field: string): boolean {
  if (field.endsWith(".missingCount")) return true;
  if (field === "pathA.results.goalsMissingOrAmbiguous") return true;
  if (field === "pathB.anyXgPresent") return true;
  if (
    field.startsWith("pathB.coverage.") &&
    field !== "pathB.coverage.xgAmbiguousSides"
  ) {
    return true;
  }
  if (field === "opponentStrength.cataloguePriorRegulationAmbiguityCandidateCount") {
    return true;
  }
  if (field.startsWith("ambiguityExclusions.")) return true;
  if (field === "scheduleRest.ambiguityFlaggedPriorCount") return true;
  if (field === "scheduleRest.priorMatchCount") return true;
  return false;
}

function isPrimaryRaw(field: string): boolean {
  if (field === "observationCount") return true;
  if (field === "opponentStrength.matchedCount") return true;
  if (field === "opponentStrength.meanOpponentCommonStrengthAsOfM") return true;
  if (
    field === "pathA.results.wins" ||
    field === "pathA.results.draws" ||
    field === "pathA.results.losses" ||
    field === "pathA.results.resultObsCount"
  ) {
    return true;
  }
  if (
    field === "pathA.shotsFor.obsCount" ||
    field === "pathA.yellowCardsFor.obsCount" ||
    field === "pathA.redCardsFor.obsCount" ||
    field === "pathB.expectedGoalsFor.obsCount"
  ) {
    return true;
  }
  if (
    field === "scheduleRest.daysSincePreviousMatch" ||
    field === "scheduleRest.matchesInLast7d" ||
    field === "scheduleRest.matchesInLast14d" ||
    field === "scheduleRest.matchesInLast28d"
  ) {
    return true;
  }
  if (field.endsWith(".mean") && field !== "pathA.possessionAgainst.mean") {
    return true;
  }
  return false;
}

export function eligibilityClassHits(field: string): Pe4I21EligibilityClass[] {
  const hits: Pe4I21EligibilityClass[] = [];
  if (isConstantRaw(field)) hits.push("INELIGIBLE_CONSTANT");
  if (isAliasRaw(field)) hits.push("ALIAS");
  if (isDerivedRaw(field)) hits.push("DERIVED_REPRESENTATION");
  if (isCoverageRaw(field)) hits.push("COVERAGE_METADATA");
  if (isPrimaryRaw(field)) hits.push("PRIMARY_NUMERIC");
  return hits;
}

function canonicalOf(field: string): string {
  const member = ALIAS_MEMBERSHIP.get(field);
  return member?.role === "alias" ? member.canonical : field;
}

function derivationParents(field: string): string[] {
  if (field === "derived.winRate") {
    return ["pathA.results.wins", "pathA.results.resultObsCount"];
  }
  if (field === "derived.pointsPerMatch") {
    return [
      "pathA.results.wins",
      "pathA.results.draws",
      "pathA.results.resultObsCount",
    ];
  }
  if (field === "derived.goalDiffMean") {
    return ["pathA.goalsFor.mean", "pathA.goalsAgainst.mean"];
  }
  if (field === "derived.xgDiffMean") {
    return ["pathB.expectedGoalsFor.mean", "pathB.expectedGoalsAgainst.mean"];
  }
  if (field.endsWith(".sum")) {
    const stem = field.slice(0, -".sum".length);
    return [...new Set([canonicalOf(`${stem}.mean`), canonicalOf(`${stem}.obsCount`)])].sort(
      (a, b) => a.localeCompare(b),
    );
  }
  return [];
}

export function classifyEligibilityField(field: string): Pe4I21FieldEligibility {
  if (!CANONICAL_ALLOWLIST_SET.has(field)) {
    fail(`unknown numeric candidate ${field}`);
  }
  const hits = eligibilityClassHits(field);
  if (hits.length !== 1) {
    fail(`conflicting eligibility for ${field}: ${hits.join(",") || "none"}`);
  }
  const eligibilityClass = hits[0]!;
  const member = ALIAS_MEMBERSHIP.get(field);
  const parents = eligibilityClass === "DERIVED_REPRESENTATION" ? derivationParents(field) : [];
  if (eligibilityClass === "DERIVED_REPRESENTATION" && parents.length === 0) {
    fail(`derived field ${field} has no parents`);
  }
  if (eligibilityClass === "ALIAS" && member?.role !== "alias") {
    fail(`alias field ${field} has no canonical`);
  }
  return {
    field,
    eligibilityClass,
    canonicalField: eligibilityClass === "ALIAS" ? member!.canonical : null,
    aliasGroupId: eligibilityClass === "ALIAS" ? member!.groupId : null,
    coEligibleInPrimaryMatrix: eligibilityClass === "PRIMARY_NUMERIC",
    derivationParents: parents,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function digestContract(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function reconcileVarianceEvidence(
  fields: readonly Pe4I21FieldEligibility[],
  evidence: readonly Pe4I21VarianceEvidence[],
  requireComplete: boolean,
): void {
  const byField = new Map<string, Pe4I21VarianceEvidence>();
  for (const row of evidence) {
    if (byField.has(row.field)) fail(`duplicate variance evidence for ${row.field}`);
    if (!CANONICAL_ALLOWLIST_SET.has(row.field)) {
      fail(`variance evidence for unknown field ${row.field}`);
    }
    byField.set(row.field, row);
  }
  if (requireComplete && byField.size !== fields.length) {
    fail(
      `variance evidence covers ${byField.size} fields; expected ${fields.length}`,
    );
  }
  const classified = new Map(fields.map((field) => [field.field, field]));
  for (const row of byField.values()) {
    const field = classified.get(row.field);
    if (!field) fail(`variance evidence for unclassified field ${row.field}`);
    const constantZero =
      row.varianceClass === "CONSTANT" &&
      row.uniqueFinite === 1 &&
      row.min === 0 &&
      row.max === 0;
    if (field.eligibilityClass === "INELIGIBLE_CONSTANT" && !constantZero) {
      fail(`${row.field} is not constant zero in structural evidence`);
    }
    if (constantZero && field.eligibilityClass !== "INELIGIBLE_CONSTANT") {
      fail(`${row.field} is constant zero but classified ${field.eligibilityClass}`);
    }
  }
}

export function buildPe4I21EligibilityContract(input?: {
  allowlist?: readonly string[];
  varianceEvidence?: readonly Pe4I21VarianceEvidence[];
  requireCompleteVarianceEvidence?: boolean;
}): Pe4I21EligibilityContract {
  const allowlist = [...(input?.allowlist ?? CANONICAL_ALLOWLIST)];
  if (new Set(allowlist).size !== allowlist.length) {
    fail("duplicate field in eligibility allowlist");
  }
  for (const field of allowlist) {
    if (!CANONICAL_ALLOWLIST_SET.has(field)) fail(`unknown numeric candidate ${field}`);
  }
  if (allowlist.length !== CANONICAL_ALLOWLIST.length) {
    fail(
      `allowlist length ${allowlist.length} does not match ${CANONICAL_ALLOWLIST.length}`,
    );
  }
  for (const field of CANONICAL_ALLOWLIST) {
    if (!allowlist.includes(field)) fail(`missing numeric candidate ${field}`);
  }

  const fields = [...allowlist]
    .sort((a, b) => a.localeCompare(b))
    .map((field) => classifyEligibilityField(field));
  const classCounts = emptyClassCounts();
  for (const field of fields) classCounts[field.eligibilityClass] += 1;
  if (classCounts.INELIGIBLE_CONSTANT !== PE4I21_PINNED_POPULATION.constantZeroCount) {
    fail(
      `constant-zero count ${classCounts.INELIGIBLE_CONSTANT} does not match ${PE4I21_PINNED_POPULATION.constantZeroCount}`,
    );
  }
  const classSum = PE4I21_ELIGIBILITY_CLASSES.reduce(
    (sum, key) => sum + classCounts[key],
    0,
  );
  if (classSum !== fields.length) fail("eligibility classes do not partition the allowlist");

  for (const group of PE4I21_ALIAS_GROUPS) {
    const canonical = fields.find((field) => field.field === group.canonical);
    if (!canonical || canonical.eligibilityClass === "ALIAS") {
      fail(`alias canonical ${group.canonical} is not a retained field`);
    }
    for (const alias of group.aliases) {
      const classified = fields.find((field) => field.field === alias);
      if (
        !classified ||
        classified.eligibilityClass !== "ALIAS" ||
        classified.canonicalField !== group.canonical
      ) {
        fail(`alias ${alias} does not point at ${group.canonical}`);
      }
    }
  }

  const primaryFields = new Set(
    fields
      .filter((field) => field.coEligibleInPrimaryMatrix)
      .map((field) => field.field),
  );
  for (const field of fields) {
    if (field.eligibilityClass !== "DERIVED_REPRESENTATION") continue;
    for (const parent of field.derivationParents) {
      if (!CANONICAL_ALLOWLIST_SET.has(parent)) {
        fail(`derivation parent ${parent} is not an allowlist field`);
      }
      if (primaryFields.has(field.field)) {
        fail(`derived field ${field.field} entered the primary matrix`);
      }
    }
  }

  if (input?.varianceEvidence) {
    reconcileVarianceEvidence(
      fields,
      input.varianceEvidence,
      input.requireCompleteVarianceEvidence === true,
    );
  }

  const aliasGroups = PE4I21_ALIAS_GROUPS.map((group) => ({
    ...group,
    aliases: [...group.aliases].sort((a, b) => a.localeCompare(b)),
  })).sort((a, b) => a.groupId.localeCompare(b.groupId));
  const derivationBlocks = fields
    .filter((field) => field.eligibilityClass === "DERIVED_REPRESENTATION")
    .map((field) => ({
      derived: field.field,
      parents: [...field.derivationParents],
    }));
  const population = summarizeCompetitionRows(PE4I21_PINNED_COMPETITION_ROWS);
  assertPinnedPopulation(population);

  const contractDigest = digestContract({
    protocol: pe4I21Protocol(),
    designMatrixRules: PE4I21_DESIGN_MATRIX_RULES,
    classCounts,
    fields,
    aliasGroups,
    derivationBlocks,
    population,
    labelsRead: false,
  });

  return {
    protocolVersion: PE4I21_PROTOCOL_VERSION,
    labelsRead: false,
    noFeatureVsOutcomeStats: true,
    providerCallsMade: 0,
    productionWiring: false,
    numericCandidateCount: fields.length,
    classCounts,
    fields,
    aliasGroups,
    derivationBlocks,
    designMatrixRules: PE4I21_DESIGN_MATRIX_RULES,
    population,
    contractDigest,
  };
}

function emptyClassCounts(): Record<Pe4I21EligibilityClass, number> {
  return {
    INELIGIBLE_CONSTANT: 0,
    ALIAS: 0,
    DERIVED_REPRESENTATION: 0,
    COVERAGE_METADATA: 0,
    PRIMARY_NUMERIC: 0,
  };
}

export function classifyCompetitionId(
  competitionId: string,
): Pe4I21CompetitionPlacement {
  const id = competitionId.trim();
  if (!id || id !== competitionId) fail(`invalid competition id ${JSON.stringify(competitionId)}`);
  const inclusion = pe4I4PrimaryStatsInclusion({
    providerCompetitionId: id,
    competitionClass: "unknown_competition",
  });
  if (inclusion === "INCLUDE_PRIMARY_PERFORMANCE") return "PRIMARY";
  if (
    inclusion === "PRESERVE_RAW_EXCLUDE_PRIMARY_STATS" ||
    inclusion === "PRESERVE_RAW_SEPARATE_AUDIT"
  ) {
    return "SEPARATE_AUDIT";
  }
  if (inclusion === "PRESERVE_RAW_UNKNOWN") return "SEPARATE_AUDIT_UNKNOWN";
  const unexpected: never = inclusion;
  fail(`conflicting competition inclusion ${String(unexpected)}`);
}

export function classifyTargetPlacement(input: {
  competitionId: string;
  kickoffUtc: string;
  providerSeason: string;
}): Pe4I21TargetPlacement {
  if (!input.providerSeason.trim()) fail("empty provider season");
  const holdout = classifyHoldoutForResearch({
    kickoffUtc: input.kickoffUtc,
    providerSeasonId: input.providerSeason,
  });
  if (
    holdout === "calendar_2025_sealed_outcome" ||
    holdout === "provider_season_2025_forbidden"
  ) {
    return "EXCLUDED_HOLDOUT";
  }
  if (holdout === "unknown_kickoff") fail(`unknown kickoff ${input.kickoffUtc}`);
  if (holdout !== "dev_or_conf_eligible") {
    fail(`conflicting holdout classification ${holdout}`);
  }
  return classifyCompetitionId(input.competitionId);
}

export function summarizeCompetitionRows(
  rows: readonly { competitionId: string; rows: number }[],
): Pe4I21PopulationSummary {
  const seen = new Set<string>();
  const competitions: Pe4I21PopulationSummary["competitions"] = [];
  let primaryTargets = 0;
  let separateAuditKnownTargets = 0;
  let separateAuditUnknownTargets = 0;
  let primaryRows = 0;
  let separateAuditRows = 0;
  for (const row of rows) {
    if (seen.has(row.competitionId)) {
      fail(`duplicate competition stratum ${row.competitionId}`);
    }
    seen.add(row.competitionId);
    if (!Number.isInteger(row.rows) || row.rows <= 0) {
      fail(`invalid row count for competition ${row.competitionId}`);
    }
    if (row.rows % PE4I21_ROWS_PER_TARGET !== 0) {
      fail(
        `competition ${row.competitionId} rows ${row.rows} are not a multiple of ${PE4I21_ROWS_PER_TARGET}`,
      );
    }
    const placement = classifyCompetitionId(row.competitionId);
    const targets = row.rows / PE4I21_ROWS_PER_TARGET;
    if (placement === "PRIMARY") {
      primaryTargets += targets;
      primaryRows += row.rows;
    } else if (placement === "SEPARATE_AUDIT") {
      separateAuditKnownTargets += targets;
      separateAuditRows += row.rows;
    } else {
      separateAuditUnknownTargets += targets;
      separateAuditRows += row.rows;
    }
    competitions.push({
      competitionId: row.competitionId,
      rows: row.rows,
      targets,
      placement,
    });
  }
  competitions.sort((a, b) => a.competitionId.localeCompare(b.competitionId));
  const separateAuditTargets = separateAuditKnownTargets + separateAuditUnknownTargets;
  return {
    primaryTargets,
    separateAuditTargets,
    separateAuditKnownTargets,
    separateAuditUnknownTargets,
    totalTargets: primaryTargets + separateAuditTargets,
    primaryRows,
    separateAuditRows,
    totalRows: primaryRows + separateAuditRows,
    rowsPerTarget: PE4I21_ROWS_PER_TARGET,
    competitions,
  };
}

function assertPinnedPopulation(summary: Pe4I21PopulationSummary): void {
  if (summary.primaryTargets !== PE4I21_PINNED_POPULATION.primaryTargets) {
    fail(`primary targets ${summary.primaryTargets} are not 786`);
  }
  if (summary.separateAuditTargets !== PE4I21_PINNED_POPULATION.separateAuditTargets) {
    fail(`separate-audit targets ${summary.separateAuditTargets} are not 183`);
  }
  if (
    summary.totalTargets !== PE4I21_PINNED_POPULATION.targetCount ||
    summary.totalRows !== PE4I21_PINNED_POPULATION.rowsPerPath
  ) {
    fail("pinned population does not match 969 targets and 40,698 rows");
  }
}

export function assertSparseAuditMatchesPinnedPartition(
  rows: readonly { competitionId: string; rows: number }[],
): Pe4I21PopulationSummary {
  const summary = summarizeCompetitionRows(rows);
  assertPinnedPopulation(summary);
  if (rows.length !== PE4I21_PINNED_COMPETITION_ROWS.length) {
    fail("sparse competition inventory does not match the pinned partition");
  }
  const actual = new Map(rows.map((row) => [row.competitionId, row.rows]));
  for (const pinned of PE4I21_PINNED_COMPETITION_ROWS) {
    if (actual.get(pinned.competitionId) !== pinned.rows) {
      fail(`competition ${pinned.competitionId} row count does not match the pin`);
    }
  }
  return summary;
}

export function isIgnorableSlopeZeroAffine(input: {
  fieldA: string;
  fieldB: string;
  reason: string;
  detail: string;
}): boolean {
  if (input.reason !== "AFFINE_NEAR_PERFECT") return false;
  const constantSide =
    (CANONICAL_ALLOWLIST_SET.has(input.fieldA) &&
      classifyEligibilityField(input.fieldA).eligibilityClass === "INELIGIBLE_CONSTANT") ||
    (CANONICAL_ALLOWLIST_SET.has(input.fieldB) &&
      classifyEligibilityField(input.fieldB).eligibilityClass === "INELIGIBLE_CONSTANT");
  if (!constantSide) return false;
  return /y≈0(?:\.0+)?\*x\+0(?:\.0+)?/.test(input.detail);
}

export function varianceRowsFromDescriptiveStats(
  value: unknown,
): Pe4I21VarianceEvidence[] {
  if (value == null || typeof value !== "object") {
    fail("descriptive stats payload is not an object");
  }
  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) fail("descriptive stats fields are missing");
  return fields.map((row, index) => {
    if (row == null || typeof row !== "object") {
      fail(`descriptive stats row ${index} is not an object`);
    }
    const record = row as Record<string, unknown>;
    if (typeof record.field !== "string" || record.field.trim() === "") {
      fail(`descriptive stats row ${index} has no field`);
    }
    if (typeof record.varianceClass !== "string") {
      fail(`missing variance class for ${record.field}`);
    }
    if (
      typeof record.uniqueFinite !== "number" ||
      typeof record.min !== "number" ||
      typeof record.max !== "number"
    ) {
      fail(`non-numeric variance evidence for ${record.field}`);
    }
    return {
      field: record.field,
      varianceClass: record.varianceClass,
      uniqueFinite: record.uniqueFinite,
      min: record.min,
      max: record.max,
    };
  });
}

export function competitionRowsFromSparseAudit(
  value: unknown,
): Array<{ competitionId: string; rows: number }> {
  if (value == null || typeof value !== "object") {
    fail("sparse-history payload is not an object");
  }
  const rows = (value as { byCompetition?: unknown }).byCompetition;
  if (!Array.isArray(rows)) fail("sparse-history competitions are missing");
  return rows.map((row, index) => {
    if (row == null || typeof row !== "object") {
      fail(`sparse-history row ${index} is not an object`);
    }
    const record = row as Record<string, unknown>;
    if (typeof record.key !== "string" || record.key.trim() === "") {
      fail(`sparse-history row ${index} has no competition id`);
    }
    if (typeof record.rows !== "number" || !Number.isInteger(record.rows)) {
      fail(`sparse-history row ${record.key} has a non-integer row count`);
    }
    return { competitionId: record.key, rows: record.rows };
  });
}

export function assertPinnedManifestDigests(input: {
  auditDigest: string;
  ledgerDigest: string;
  catalogueDigest: string;
  basePathADigest: string;
  basePathBDigest: string;
  strengthPathADigest: string;
  pathBDigest: string;
  labelsRead: boolean;
}): void {
  if (input.labelsRead !== false) {
    fail("structural manifest reports labels were read");
  }
  const expected = {
    auditDigest: PE4I21_PINNED_DIGESTS.auditDigest,
    ledgerDigest: PE4I21_PINNED_DIGESTS.ledgerDigest,
    catalogueDigest: PE4I21_PINNED_DIGESTS.catalogueDigest,
    basePathADigest: PE4I21_PINNED_DIGESTS.basePathADigest,
    basePathBDigest: PE4I21_PINNED_DIGESTS.basePathBDigest,
    strengthPathADigest: PE4I21_PINNED_DIGESTS.strengthPathADigest,
    pathBDigest: PE4I21_PINNED_DIGESTS.pathBDigest,
  } as const;
  const keys = Object.keys(expected) as Array<keyof typeof expected>;
  for (const key of keys) {
    if (input[key] !== expected[key]) {
      fail(`${key} does not match the pinned PE-4I.20 digest`);
    }
  }
  if (input.pathBDigest !== input.basePathBDigest) {
    fail("Path B digest differs from the PE-4I.17 base");
  }
}

export function assertStructuralReadPath(filePath: string): void {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  if (norm.includes("target-labels") || norm.includes("outcome-label")) {
    fail("refuses to read target-label files");
  }
  if (norm.endsWith(".jsonl") || norm.includes("feature-dataset")) {
    fail("refuses to read feature dataset rows");
  }
}

export function exclusiveDirectoryDecision(input: {
  directoryPath: string;
  exists: boolean;
  entryNames: readonly string[];
}): { ok: true } {
  const parts = input.directoryPath.split(/[\\/]+/).filter((part) => part.length > 0);
  for (const forbidden of PE4I21_FORBIDDEN_ARTIFACT_SUBDIRS) {
    if (parts.includes(forbidden)) {
      fail(`refuses to write into preserved research directory ${forbidden}`);
    }
  }
  if (path.basename(input.directoryPath) !== PE4I21_ARTIFACT_SUBDIR) {
    fail(`refuses to write outside ${PE4I21_ARTIFACT_SUBDIR}`);
  }
  if (input.exists && input.entryNames.length > 0) {
    const planned = input.entryNames.find((name) =>
      (PE4I21_PLANNED_ARTIFACTS as readonly string[]).includes(name),
    );
    if (planned) fail(`refuses to overwrite existing file ${planned}`);
    fail(`refuses to overwrite existing contract directory: ${input.directoryPath}`);
  }
  return { ok: true };
}

export function manifestDigestsFromPayloads(
  auditManifest: unknown,
  datasetManifest: unknown,
): {
  auditDigest: string;
  ledgerDigest: string;
  catalogueDigest: string;
  basePathADigest: string;
  basePathBDigest: string;
  strengthPathADigest: string;
  pathBDigest: string;
  labelsRead: boolean;
} {
  const audit = requireRecord(auditManifest, "audit manifest");
  const dataset = requireRecord(datasetManifest, "dataset manifest");
  const lineage = requireRecord(audit.datasetLineage, "audit manifest lineage");
  if (typeof audit.labelsRead !== "boolean") {
    fail("audit manifest is missing labelsRead");
  }
  return {
    auditDigest: requireDigest(audit.auditDigest, "auditDigest"),
    ledgerDigest: requireDigest(lineage.ledgerDigest, "ledgerDigest"),
    catalogueDigest: requireDigest(lineage.catalogueDigest, "catalogueDigest"),
    basePathADigest: requireDigest(lineage.basePathADigest, "basePathADigest"),
    basePathBDigest: requireDigest(lineage.basePathBDigest, "basePathBDigest"),
    strengthPathADigest: requireDigest(lineage.strengthPathADigest, "strengthPathADigest"),
    pathBDigest: requireDigest(dataset.pathBDigest, "pathBDigest"),
    labelsRead: audit.labelsRead,
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function requireDigest(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} is missing`);
  }
  return value;
}
