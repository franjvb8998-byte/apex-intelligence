/**
 * Sprint 5B.12 Elo→xG geometry counterfactuals.
 * Debug-only. Not a production policy. Not a tuner. No grid search.
 */

export const XG_GEOMETRY_COUNTERFACTUAL_VERSION = "apex.calibration.xg-geometry.5b12.v1";

export const GEOMETRY_PANELS = ["P0", "P7"] as const;
export type GeometryPanelId = (typeof GEOMETRY_PANELS)[number];

export const GEOMETRY_ARMS = ["G0", "G1", "G2", "G3", "G4", "G5"] as const;
export type GeometryArmId = (typeof GEOMETRY_ARMS)[number];

export const DECLARED_ELO_GOAL_SCALES = [400, 500, 600, 800] as const;
export const EFFECTIVE_GAP_CAP = 200;

export const GEOMETRY_EVIDENCE_SCOPES = ["all", "0", "1-3", "4-9", "10+"] as const;
export type GeometryEvidenceScope = (typeof GEOMETRY_EVIDENCE_SCOPES)[number];

export const GEOMETRY_DELTA_CONTRASTS = [
  "G1-G0",
  "G2-G0",
  "G3-G0",
  "G4-G0",
  "G5-G0",
] as const;
export type GeometryDeltaContrast = (typeof GEOMETRY_DELTA_CONTRASTS)[number];

export const P7_NON_CANDIDATE_LABEL = "NON_CANDIDATE_CLEANER_INPUT_C7";

export type GeometryArmSpec = {
  id: GeometryArmId;
  label: string;
  eloGoalScale: number;
  capEffectiveGap: boolean;
  diagnosticOnly: boolean;
};

export const GEOMETRY_ARM_SPECS: readonly GeometryArmSpec[] = [
  {
    id: "G0",
    label: "PRODUCTION S=400 no cap",
    eloGoalScale: 400,
    capEffectiveGap: false,
    diagnosticOnly: false,
  },
  {
    id: "G1",
    label: "S500",
    eloGoalScale: 500,
    capEffectiveGap: false,
    diagnosticOnly: false,
  },
  {
    id: "G2",
    label: "S600",
    eloGoalScale: 600,
    capEffectiveGap: false,
    diagnosticOnly: false,
  },
  {
    id: "G3",
    label: "S800",
    eloGoalScale: 800,
    capEffectiveGap: false,
    diagnosticOnly: false,
  },
  {
    id: "G4",
    label: "S400_SOFT_CAP ±200 diagnostic",
    eloGoalScale: 400,
    capEffectiveGap: true,
    diagnosticOnly: true,
  },
  {
    id: "G5",
    label: "S600_SOFT_CAP ±200 diagnostic",
    eloGoalScale: 600,
    capEffectiveGap: true,
    diagnosticOnly: true,
  },
];

export const GEOMETRY_NAMED_TRACES = [
  { season: "2023", home: "Aston Villa", away: "Sheffield Utd", score: "1-1" },
  { season: "2024", home: "Chelsea", away: "Ipswich", score: "2-2" },
  { season: "2025", home: "Manchester City", away: "Nottingham Forest", score: "2-2" },
] as const;

export function geometryArmSpec(id: GeometryArmId): GeometryArmSpec {
  const spec = GEOMETRY_ARM_SPECS.find((row) => row.id === id);
  if (!spec) throw new Error(`Unknown geometry arm ${id}`);
  return spec;
}

export function panelInputArm(panel: GeometryPanelId): "C0" | "C7" {
  return panel === "P0" ? "C0" : "C7";
}
