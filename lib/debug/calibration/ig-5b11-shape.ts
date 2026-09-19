/**
 * Sprint 5B.11 catalogue input-geometry counterfactuals.
 * Debug-only. Not a production policy. Not a tuner. No grid search.
 */

export const INPUT_GEOMETRY_VERSION = "apex.calibration.input-geometry.5b11.v1";

export const INPUT_GEOMETRY_ARMS = [
  "C0",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
] as const;
export type InputGeometryArmId = (typeof INPUT_GEOMETRY_ARMS)[number];

/** Inherited 5B.3A placeholder. Not tuned in 5B.11. */
export const INPUT_GEOMETRY_SHRINKAGE_K = 8;

export const GD_RATE_CLAMP = 3;
export const GD_RATE_COEFFICIENT = 25;
export const NON_CANDIDATE_GD_RATE_LABEL = "NON_CANDIDATE_GD_RATE_DIAGNOSTIC";

export const INPUT_GEOMETRY_EVIDENCE_SCOPES = ["all", "0", "1-3", "4-9", "10+"] as const;
export type InputGeometryEvidenceScope = (typeof INPUT_GEOMETRY_EVIDENCE_SCOPES)[number];

export const INPUT_GEOMETRY_DELTA_CONTRASTS = [
  "C1-C0",
  "C2-C0",
  "C3-C0",
  "C4-C0",
  "C7-C0",
] as const;
export type InputGeometryDeltaContrast = (typeof INPUT_GEOMETRY_DELTA_CONTRASTS)[number];

export type InputGeometryArmSpec = {
  id: InputGeometryArmId;
  label: string;
  homeBase: number;
  awayBase: number;
  shrinkage: boolean;
  gdMode: "cumulative" | "rate";
  nonCandidate: boolean;
  changes: readonly string[];
};

export const INPUT_GEOMETRY_ARM_SPECS: readonly InputGeometryArmSpec[] = [
  {
    id: "C0",
    label: "CURRENT_CATALOGUE control 1580/1520 cumulative GD",
    homeBase: 1580,
    awayBase: 1520,
    shrinkage: false,
    gdMode: "cumulative",
    nonCandidate: false,
    changes: [],
  },
  {
    id: "C1",
    label: "EQUAL_ROLE_BASES 1550/1550",
    homeBase: 1550,
    awayBase: 1550,
    shrinkage: false,
    gdMode: "cumulative",
    nonCandidate: false,
    changes: ["equal_role_bases"],
  },
  {
    id: "C2",
    label: "SAMPLE_SHRINKAGE k=8 toward 1580/1520",
    homeBase: 1580,
    awayBase: 1520,
    shrinkage: true,
    gdMode: "cumulative",
    nonCandidate: false,
    changes: ["sample_shrinkage_k8"],
  },
  {
    id: "C3",
    label: "EQUAL_ROLE_PLUS_SHRINKAGE 1550/1550 k=8",
    homeBase: 1550,
    awayBase: 1550,
    shrinkage: true,
    gdMode: "cumulative",
    nonCandidate: false,
    changes: ["equal_role_bases", "sample_shrinkage_k8"],
  },
  {
    id: "C4",
    label: NON_CANDIDATE_GD_RATE_LABEL,
    homeBase: 1580,
    awayBase: 1520,
    shrinkage: false,
    gdMode: "rate",
    nonCandidate: true,
    changes: ["gd_rate_diagnostic"],
  },
  {
    id: "C5",
    label: `${NON_CANDIDATE_GD_RATE_LABEL}+EQUAL_ROLE_BASES`,
    homeBase: 1550,
    awayBase: 1550,
    shrinkage: false,
    gdMode: "rate",
    nonCandidate: true,
    changes: ["equal_role_bases", "gd_rate_diagnostic"],
  },
  {
    id: "C6",
    label: `${NON_CANDIDATE_GD_RATE_LABEL}+SHRINKAGE_k8`,
    homeBase: 1580,
    awayBase: 1520,
    shrinkage: true,
    gdMode: "rate",
    nonCandidate: true,
    changes: ["sample_shrinkage_k8", "gd_rate_diagnostic"],
  },
  {
    id: "C7",
    label: `${NON_CANDIDATE_GD_RATE_LABEL}+EQUAL_ROLE+SHRINKAGE_k8`,
    homeBase: 1550,
    awayBase: 1550,
    shrinkage: true,
    gdMode: "rate",
    nonCandidate: true,
    changes: ["equal_role_bases", "sample_shrinkage_k8", "gd_rate_diagnostic"],
  },
];

export const INPUT_GEOMETRY_NAMED_TRACES = [
  { season: "2023", home: "Aston Villa", away: "Sheffield Utd", score: "1-1" },
  { season: "2024", home: "Chelsea", away: "Ipswich", score: "2-2" },
  { season: "2025", home: "Manchester City", away: "Nottingham Forest", score: "2-2" },
] as const;

export const PE_HOME_ADVANTAGE_REMAINS = 65;

export function armSpec(id: InputGeometryArmId): InputGeometryArmSpec {
  const spec = INPUT_GEOMETRY_ARM_SPECS.find((row) => row.id === id);
  if (!spec) throw new Error(`Unknown input-geometry arm ${id}`);
  return spec;
}
