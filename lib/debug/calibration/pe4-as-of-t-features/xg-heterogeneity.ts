/**
 * PE-4I.15 — xG heterogeneity contract.
 * Optional evidence; no zero-fill / imputation; expose coverage counts.
 * Path A: universal non-xG. Path B: additive xG without population shift.
 */

export type Pe4I15XgPath =
  | "A_UNIVERSAL_NON_XG"
  | "B_ADDITIVE_XG_NO_POPULATION_SHIFT";

export type Pe4I15XgCoverageCounts = {
  fixturesConsidered: number;
  xgPresentSides: number;
  xgMissingSides: number;
  xgAmbiguousSides: number;
  fixturesWithBothSidesXg: number;
  fixturesWithAnyXg: number;
  fixturesWithNoXg: number;
};

export type Pe4I15XgHeterogeneityContract = {
  optionalEvidence: true;
  zeroFillForbidden: true;
  imputationForbidden: true;
  eloPoissonSubstitutionForbidden: true;
  paths: {
    A: {
      id: "A_UNIVERSAL_NON_XG";
      description: string;
      population: "all_temporally_eligible_fixtures_meeting_family_min_obs";
    };
    B: {
      id: "B_ADDITIVE_XG_NO_POPULATION_SHIFT";
      description: string;
      /** Must not redefine Path A population by dropping non-xG fixtures. */
      populationShiftForbidden: true;
      missingXgBehavior: "feature_null_or_family_partial_counts_not_imputed";
    };
  };
  coverageReportingRequired: true;
};

export const PE4I15_XG_HETEROGENEITY_CONTRACT: Pe4I15XgHeterogeneityContract = {
  optionalEvidence: true,
  zeroFillForbidden: true,
  imputationForbidden: true,
  eloPoissonSubstitutionForbidden: true,
  paths: {
    A: {
      id: "A_UNIVERSAL_NON_XG",
      description:
        "Universal non-xG performance/results features on the full eligible population.",
      population: "all_temporally_eligible_fixtures_meeting_family_min_obs",
    },
    B: {
      id: "B_ADDITIVE_XG_NO_POPULATION_SHIFT",
      description:
        "Additive xG features only where present; never shrink Path A population to xG-capable subset.",
      populationShiftForbidden: true,
      missingXgBehavior: "feature_null_or_family_partial_counts_not_imputed",
    },
  },
  coverageReportingRequired: true,
};

export type Pe4I15XgSidePresence = "present" | "missing" | "ambiguous";

export type Pe4I15XgFixturePresence = {
  fixtureId: string;
  home: Pe4I15XgSidePresence;
  away: Pe4I15XgSidePresence;
};

/**
 * Aggregate coverage. Does not invent values; present means provider emitted numeric xG.
 */
export function measureXgCoverage(
  rows: readonly Pe4I15XgFixturePresence[],
): Pe4I15XgCoverageCounts {
  let xgPresentSides = 0;
  let xgMissingSides = 0;
  let xgAmbiguousSides = 0;
  let fixturesWithBothSidesXg = 0;
  let fixturesWithAnyXg = 0;
  let fixturesWithNoXg = 0;

  for (const r of rows) {
    for (const side of [r.home, r.away] as const) {
      if (side === "present") xgPresentSides += 1;
      else if (side === "ambiguous") xgAmbiguousSides += 1;
      else xgMissingSides += 1;
    }
    const both = r.home === "present" && r.away === "present";
    const any = r.home === "present" || r.away === "present";
    if (both) fixturesWithBothSidesXg += 1;
    if (any) fixturesWithAnyXg += 1;
    else fixturesWithNoXg += 1;
  }

  return {
    fixturesConsidered: rows.length,
    xgPresentSides,
    xgMissingSides,
    xgAmbiguousSides,
    fixturesWithBothSidesXg,
    fixturesWithAnyXg,
    fixturesWithNoXg,
  };
}

/** Explicit refusal of zero-fill. */
export function refuseXgZeroFill(): never {
  throw new Error("PE-4I.15: xG zero-fill / imputation is forbidden");
}
