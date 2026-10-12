/**
 * PE-4I.18 — Schema inventory + numeric allowlist for structural audit.
 * Walks a sample record, classifies fields, excludes IDs/digests/kickoffs.
 */

import type {
  Pe4I18SchemaClass,
  Pe4I18StructuralStatus,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";

export type Pe4I18FieldInventoryEntry = {
  path: string;
  schemaClass: Pe4I18SchemaClass;
  inAllowlist: boolean;
  excludeReason: string | null;
  notes: string;
};

export type Pe4I18SchemaInventory = {
  sampleSource: "path_a_first_record" | "synthetic";
  totalFlattenedPaths: number;
  byClass: Record<Pe4I18SchemaClass, number>;
  identifiersExcluded: string[];
  allowlist: string[];
  fields: Pe4I18FieldInventoryEntry[];
  derivedCandidates: string[];
  opponentStrengthStatus: Pe4I18StructuralStatus;
};

/** Paths excluded from numeric allowlist (identity / provenance / digests / kickoffs). */
export const PE4I18_IDENTIFIER_PATH_PREFIXES = [
  "targetFixtureId",
  "kickoffUtc",
  "teamId",
  "opponentId",
  "historyFixtureIds",
  "provenanceDigest",
  "populationKey",
  "scheduleRest.targetKickoffUtc",
] as const;

const PRESENCE_AGG_SUFFIXES = [
  "mean",
  "sum",
  "obsCount",
  "missingCount",
  "ambiguousCount",
] as const;

const PATH_A_AGG_FIELDS = [
  "goalsFor",
  "goalsAgainst",
  "shotsFor",
  "shotsAgainst",
  "shotsOnTargetFor",
  "shotsOnTargetAgainst",
  "possessionFor",
  "possessionAgainst",
  "cornersFor",
  "cornersAgainst",
  "yellowCardsFor",
  "yellowCardsAgainst",
  "redCardsFor",
  "redCardsAgainst",
] as const;

/** Deterministic derived numeric fields (structural identities only). */
export const PE4I18_DERIVED_FIELD_SPECS = [
  {
    path: "derived.winRate",
    reason: "DETERMINISTIC_WIN_RATE",
    formula: "wins / resultObsCount",
  },
  {
    path: "derived.pointsPerMatch",
    reason: "DETERMINISTIC_POINTS_PER_MATCH",
    formula: "(3*wins + draws) / resultObsCount",
  },
  {
    path: "derived.goalDiffMean",
    reason: "DETERMINISTIC_GOAL_DIFF",
    formula: "goalsFor.mean - goalsAgainst.mean",
  },
  {
    path: "derived.xgDiffMean",
    reason: "DETERMINISTIC_XG_DIFF",
    formula: "expectedGoalsFor.mean - expectedGoalsAgainst.mean",
  },
] as const;

function isIdentifierPath(path: string): boolean {
  for (const p of PE4I18_IDENTIFIER_PATH_PREFIXES) {
    if (path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[`)) {
      return true;
    }
  }
  if (path.includes("Digest") || path.endsWith("digest")) return true;
  if (path.toLowerCase().includes("fixtureid")) return true;
  if (path === "kickoffUtc" || path.endsWith(".kickoffUtc")) return true;
  return false;
}

function flattenKeys(
  value: unknown,
  prefix: string,
  out: Map<string, unknown>,
): void {
  if (value === null || value === undefined) {
    out.set(prefix, value);
    return;
  }
  if (Array.isArray(value)) {
    out.set(prefix, `[array:len=${value.length}]`);
    if (value.length > 0 && typeof value[0] === "object" && value[0] != null) {
      flattenKeys(value[0], `${prefix}[]`, out);
    }
    return;
  }
  if (typeof value !== "object") {
    out.set(prefix, value);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flattenKeys(v, next, out);
  }
}

function classifyPath(
  path: string,
  sampleValue: unknown,
): Omit<Pe4I18FieldInventoryEntry, "path"> {
  if (isIdentifierPath(path)) {
    return {
      schemaClass: path.includes("Digest") || path.includes("digest")
        ? "PROVENANCE"
        : "IDENTITY",
      inAllowlist: false,
      excludeReason: "identifier_or_provenance_or_kickoff",
      notes: "Excluded from numeric allowlist",
    };
  }

  if (
    path === "competition" ||
    path === "providerSeason" ||
    path === "targetVenueRole" ||
    path === "windowId" ||
    path === "venueMode" ||
    path === "pathA.path" ||
    path === "pathB.path"
  ) {
    return {
      schemaClass: "CATEGORICAL",
      inAllowlist: false,
      excludeReason: "categorical_stratifier",
      notes: "Used for breakdowns only",
    };
  }

  if (path.startsWith("availability")) {
    return {
      schemaClass: "AVAILABILITY",
      inAllowlist: false,
      excludeReason: "availability_status_metadata",
      notes: "Family availability status / counts metadata",
    };
  }

  if (path.startsWith("scheduleRest.")) {
    if (
      path === "scheduleRest.status" ||
      path === "scheduleRest.unavailableReason" ||
      path === "scheduleRest.familyId" ||
      path === "scheduleRest.futureScheduleAnticipation" ||
      path === "scheduleRest.noFatigueMultiplier"
    ) {
      return {
        schemaClass:
          path === "scheduleRest.noFatigueMultiplier"
            ? "PROVENANCE"
            : "SCHEDULE_REST",
        inAllowlist: false,
        excludeReason:
          path === "scheduleRest.noFatigueMultiplier"
            ? "constant_flag"
            : "schedule_rest_status_or_flag",
        notes: "Schedule/rest non-numeric or flag",
      };
    }
    if (typeof sampleValue === "number" || sampleValue === null) {
      return {
        schemaClass: "SCHEDULE_REST",
        inAllowlist: true,
        excludeReason: null,
        notes: "Schedule/rest numeric candidate",
      };
    }
    return {
      schemaClass: "SCHEDULE_REST",
      inAllowlist: false,
      excludeReason: "non_numeric_schedule_rest",
      notes: "Non-numeric schedule/rest field",
    };
  }

  if (path.startsWith("pathB.") || path.startsWith("optionalXg.")) {
    if (
      path === "pathB.zeroFillUsed" ||
      path === "pathB.imputationUsed" ||
      path === "pathB.populationShifted" ||
      path === "pathB.anyXgPresent"
    ) {
      return {
        schemaClass: "OPTIONAL_XG",
        inAllowlist: path === "pathB.anyXgPresent",
        excludeReason:
          path === "pathB.anyXgPresent" ? null : "constant_contract_flag",
        notes: "Path B contract flag or presence indicator",
      };
    }
    if (
      typeof sampleValue === "number" ||
      sampleValue === null ||
      sampleValue === false ||
      sampleValue === true
    ) {
      const numericLike =
        typeof sampleValue === "number" || sampleValue === null;
      return {
        schemaClass: "OPTIONAL_XG",
        inAllowlist: numericLike && !path.endsWith(".path"),
        excludeReason: numericLike ? null : "non_numeric_xg",
        notes: "Optional xG numeric or null",
      };
    }
  }

  if (
    path === "pathA.noScoreWeightsMultiplier" ||
    path === "providerCallsMade"
  ) {
    return {
      schemaClass: "PROVENANCE",
      inAllowlist: false,
      excludeReason: "constant_contract_flag",
      notes: "Contract / provider-call flag",
    };
  }

  if (
    typeof sampleValue === "number" ||
    sampleValue === null
  ) {
    return {
      schemaClass: "NUMERIC",
      inAllowlist: true,
      excludeReason: null,
      notes: "Numeric / nullable numeric candidate",
    };
  }

  if (typeof sampleValue === "boolean") {
    return {
      schemaClass: "CATEGORICAL",
      inAllowlist: false,
      excludeReason: "boolean_flag",
      notes: "Boolean flag excluded from Pearson allowlist",
    };
  }

  if (typeof sampleValue === "string") {
    return {
      schemaClass: "CATEGORICAL",
      inAllowlist: false,
      excludeReason: "string_categorical",
      notes: "String categorical",
    };
  }

  return {
    schemaClass: "UNAVAILABLE",
    inAllowlist: false,
    excludeReason: "unclassified_or_structural_only",
    notes: "Not a numeric allowlist candidate",
  };
}

/**
 * Build inventory from a Path A (+ optional Path B) sample record.
 */
export function buildSchemaInventory(input: {
  pathASample: Record<string, unknown>;
  pathBSample?: Record<string, unknown> | null;
}): Pe4I18SchemaInventory {
  const flat = new Map<string, unknown>();
  flattenKeys(input.pathASample, "", flat);
  if (input.pathBSample) {
    // Merge Path B under pathB.* without duplicating shared identity keys.
    const bFlat = new Map<string, unknown>();
    flattenKeys(input.pathBSample, "", bFlat);
    for (const [k, v] of bFlat) {
      if (
        k === "targetFixtureId" ||
        k === "kickoffUtc" ||
        k === "competition" ||
        k === "providerSeason" ||
        k === "teamId" ||
        k === "opponentId" ||
        k === "targetVenueRole" ||
        k === "windowId" ||
        k === "venueMode" ||
        k === "observationCount" ||
        k === "historyFixtureIds" ||
        k === "provenanceDigest" ||
        k === "providerCallsMade"
      ) {
        continue;
      }
      if (k === "pathB" || k.startsWith("pathB.")) {
        flat.set(k, v);
      } else if (k === "populationKey") {
        flat.set(k, v);
      } else {
        flat.set(`pathB_record.${k}`, v);
      }
    }
  }

  // Ensure canonical Path A aggregate paths exist even if sample has zeros.
  for (const f of PATH_A_AGG_FIELDS) {
    for (const s of PRESENCE_AGG_SUFFIXES) {
      const p = `pathA.${f}.${s}`;
      if (!flat.has(p)) flat.set(p, null);
    }
  }

  const fields: Pe4I18FieldInventoryEntry[] = [];
  for (const [path, sampleValue] of [...flat.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (!path) continue;
    const classified = classifyPath(path, sampleValue);
    fields.push({ path, ...classified });
  }

  // Derived candidates always listed.
  const derivedCandidates = PE4I18_DERIVED_FIELD_SPECS.map((d) => d.path);
  for (const d of PE4I18_DERIVED_FIELD_SPECS) {
    fields.push({
      path: d.path,
      schemaClass: "DERIVED",
      inAllowlist: true,
      excludeReason: null,
      notes: `Derived: ${d.formula}`,
    });
  }

  const byClass: Record<Pe4I18SchemaClass, number> = {
    IDENTITY: 0,
    PROVENANCE: 0,
    AVAILABILITY: 0,
    CATEGORICAL: 0,
    NUMERIC: 0,
    DERIVED: 0,
    OPTIONAL_XG: 0,
    SCHEDULE_REST: 0,
    UNAVAILABLE: 0,
  };
  for (const f of fields) byClass[f.schemaClass] += 1;

  const identifiersExcluded = fields
    .filter((f) => !f.inAllowlist && f.excludeReason != null)
    .filter(
      (f) =>
        f.schemaClass === "IDENTITY" ||
        f.schemaClass === "PROVENANCE" ||
        f.excludeReason === "identifier_or_provenance_or_kickoff",
    )
    .map((f) => f.path);

  const allowlist = fields.filter((f) => f.inAllowlist).map((f) => f.path);

  return {
    sampleSource: "path_a_first_record",
    totalFlattenedPaths: fields.length,
    byClass,
    identifiersExcluded,
    allowlist: [...new Set(allowlist)].sort(),
    fields,
    derivedCandidates,
    opponentStrengthStatus:
      input.pathASample.opponentStrength != null ? "PARTIAL" : "UNAVAILABLE",
  };
}

/**
 * Canonical allowlist used when streaming (stable even if sample sparse).
 */
export function canonicalNumericAllowlist(): string[] {
  const paths: string[] = [
    "observationCount",
    "pathA.observationCount",
    "pathA.results.wins",
    "pathA.results.draws",
    "pathA.results.losses",
    "pathA.results.resultObsCount",
    "pathA.results.goalsMissingOrAmbiguous",
    "missingCounts.goalsMissingOrAmbiguous",
    "missingCounts.shotsForMissing",
    "missingCounts.shotsAgainstMissing",
    "ambiguityExclusions.regulationAmbiguousRejectedFromHistory",
    "ambiguityExclusions.calendar2025RejectedFromHistory",
  ];
  for (const f of PATH_A_AGG_FIELDS) {
    for (const s of PRESENCE_AGG_SUFFIXES) {
      paths.push(`pathA.${f}.${s}`);
    }
  }
  paths.push(
    "scheduleRest.daysSincePreviousMatch",
    "scheduleRest.hoursSincePreviousMatch",
    "scheduleRest.matchesInLast7d",
    "scheduleRest.matchesInLast14d",
    "scheduleRest.matchesInLast28d",
    "scheduleRest.priorMatchCount",
    "scheduleRest.ambiguityFlaggedPriorCount",
    "pathB.anyXgPresent",
    "pathB.expectedGoalsFor.mean",
    "pathB.expectedGoalsFor.sum",
    "pathB.expectedGoalsFor.obsCount",
    "pathB.expectedGoalsFor.missingCount",
    "pathB.expectedGoalsFor.ambiguousCount",
    "pathB.expectedGoalsAgainst.mean",
    "pathB.expectedGoalsAgainst.sum",
    "pathB.expectedGoalsAgainst.obsCount",
    "pathB.expectedGoalsAgainst.missingCount",
    "pathB.expectedGoalsAgainst.ambiguousCount",
    "pathB.coverage.fixturesConsidered",
    "pathB.coverage.xgPresentSides",
    "pathB.coverage.xgMissingSides",
    "pathB.coverage.xgAmbiguousSides",
    "pathB.coverage.fixturesWithBothSidesXg",
    "pathB.coverage.fixturesWithAnyXg",
    "pathB.coverage.fixturesWithNoXg",
    ...derivedCandidatesPaths(),
  );
  return [...new Set(paths)].sort();
}

/** PE-4I.20 extends, but does not mutate, the historical PE-4I.18 allowlist. */
export function pe4I20NumericAllowlist(): string[] {
  return [
    ...canonicalNumericAllowlist(),
    "opponentStrength.meanOpponentCommonStrengthAsOfM",
    "opponentStrength.observationCount",
    "opponentStrength.matchedCount",
    "opponentStrength.missingCount",
    "opponentStrength.selectedHistoryRegulationAmbiguityCount",
    "opponentStrength.cataloguePriorRegulationAmbiguityCandidateCount",
  ].sort();
}

function derivedCandidatesPaths(): string[] {
  return PE4I18_DERIVED_FIELD_SPECS.map((d) => d.path);
}

/**
 * Pairwise correlation / exact-redundancy allowlist.
 * Drops pure missing/ambiguous counters (presence-audited separately) to
 * keep O(fields²) tractable while remaining deterministic.
 */
export function pairwiseNumericAllowlist(
  full: readonly string[] = canonicalNumericAllowlist(),
): string[] {
  return full.filter((p) => {
    if (p.endsWith(".missingCount") || p.endsWith(".ambiguousCount")) {
      return false;
    }
    if (p.startsWith("pathB.coverage.")) return false;
    if (p.startsWith("missingCounts.")) return false;
    if (p.startsWith("ambiguityExclusions.")) return false;
    return true;
  });
}

export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Extract allowlisted numeric values + derived fields from joined Path A/B row.
 * Missing / null / non-finite → NaN (pairwise skipped).
 */
export function extractAllowlistedNumerics(
  pathA: Record<string, unknown>,
  pathB: Record<string, unknown> | null | undefined,
  allowlist: readonly string[],
): Record<string, number> {
  const joined: Record<string, unknown> = { ...pathA };
  if (pathB && typeof pathB === "object") {
    const pb = pathB.pathB ?? pathB;
    joined.pathB = pb;
    if ("anyXgPresent" in (pb as object)) {
      // already under pathB
    }
  }

  const out: Record<string, number> = {};
  for (const key of allowlist) {
    if (key.startsWith("derived.")) continue;
    let v: unknown;
    if (key === "pathA.observationCount") {
      v = getByPath(joined, "pathA.observationCount") ?? joined.observationCount;
    } else if (key.startsWith("pathA.")) {
      v = getByPath(joined, key);
    } else if (key.startsWith("pathB.")) {
      v = getByPath(joined, key);
    } else {
      v = getByPath(joined, key);
    }
    if (typeof v === "boolean") {
      out[key] = v ? 1 : 0;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    } else {
      out[key] = Number.NaN;
    }
  }

  const wins = out["pathA.results.wins"];
  const draws = out["pathA.results.draws"];
  const resultObs = out["pathA.results.resultObsCount"];
  const gfMean = out["pathA.goalsFor.mean"];
  const gaMean = out["pathA.goalsAgainst.mean"];
  const xgF = out["pathB.expectedGoalsFor.mean"];
  const xgA = out["pathB.expectedGoalsAgainst.mean"];

  out["derived.winRate"] =
    Number.isFinite(wins) &&
    Number.isFinite(resultObs) &&
    resultObs > 0
      ? wins / resultObs
      : Number.NaN;
  out["derived.pointsPerMatch"] =
    Number.isFinite(wins) &&
    Number.isFinite(draws) &&
    Number.isFinite(resultObs) &&
    resultObs > 0
      ? (3 * wins + draws) / resultObs
      : Number.NaN;
  out["derived.goalDiffMean"] =
    Number.isFinite(gfMean) && Number.isFinite(gaMean)
      ? gfMean - gaMean
      : Number.NaN;
  out["derived.xgDiffMean"] =
    Number.isFinite(xgF) && Number.isFinite(xgA) ? xgF - xgA : Number.NaN;

  return out;
}
