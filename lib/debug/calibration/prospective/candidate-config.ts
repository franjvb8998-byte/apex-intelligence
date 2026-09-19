/**
 * Frozen 5C.1 candidate manifest. No search. No historical ranking.
 */

import { createHash } from "node:crypto";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import {
  PRODUCTION_BASE_COMMIT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CANDIDATE_VERSION,
  PROSPECTIVE_CHECKPOINTS,
  type CandidateArmSpec,
  type ProspectiveCandidateId,
} from "@/lib/debug/calibration/prospective/candidate-types";

export const CANDIDATE_ARM_VERSION = "5c1.v1";

export const CONTROL_PRODUCTION_GEOMETRY = {
  homeRoleBase: 1580,
  awayRoleBase: 1520,
  shrinkage: false,
  gdMode: "cumulative" as const,
  catalogueOffset: -80,
  winRateCoefficient: 220,
  gdCoefficient: 2.5,
  gdClamp: 30,
  eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
  baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
  baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  lambdaClampMin: 0.05,
  lambdaClampMax: 6,
  homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
  eloDrawBase: DEFAULT_HYBRID_CONFIG.eloDrawBase,
  eloDrawDecay: DEFAULT_HYBRID_CONFIG.eloDrawDecay,
  poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
  maxGoals: DEFAULT_HYBRID_CONFIG.maxGoals,
  poisson: "independent",
  modelVersion: DEFAULT_HYBRID_CONFIG.modelVersion,
} as const;

export const C7_INPUT_GEOMETRY = {
  homeRoleBase: 1550,
  awayRoleBase: 1550,
  shrinkage: true,
  shrinkageK: 8,
  gdMode: "rate" as const,
  gdRateCoefficient: 25,
  gdRateClamp: 3,
  catalogueOffset: -80,
  winRateCoefficient: 220,
} as const;

export const T1_HIGH_EQUAL_POLICY = {
  relativeIncrease: 0.1,
  highEqualMinGoals: 2,
  donors: "non_draw_only",
  preserveLowEqual: true,
} as const;

export const CANDIDATE_ARMS: readonly CandidateArmSpec[] = [
  {
    candidateId: "CONTROL_PRODUCTION",
    candidateVersion: CANDIDATE_ARM_VERSION,
    description: "Exact production catalogue + S=400 independent Poisson hybrid",
    inputPolicy: "PRODUCTION_C0",
    eloGoalScale: 400,
    highEqualPolicy: "NONE",
    productionBaseCommit: PRODUCTION_BASE_COMMIT,
  },
  {
    candidateId: "CANDIDATE_A_INPUT",
    candidateVersion: CANDIDATE_ARM_VERSION,
    description: "Exact C7 input (1550/1550, k=8, GD-rate) + production transform",
    inputPolicy: "C7_EQUAL_BASE_SHRINKAGE_GD_RATE",
    eloGoalScale: 400,
    highEqualPolicy: "NONE",
    productionBaseCommit: PRODUCTION_BASE_COMMIT,
  },
  {
    candidateId: "CANDIDATE_B_TRANSFORM",
    candidateVersion: CANDIDATE_ARM_VERSION,
    description: "Production catalogue input + predeclared S=600",
    inputPolicy: "PRODUCTION_C0",
    eloGoalScale: 600,
    highEqualPolicy: "NONE",
    productionBaseCommit: PRODUCTION_BASE_COMMIT,
  },
  {
    candidateId: "CANDIDATE_C_COMBINED",
    candidateVersion: CANDIDATE_ARM_VERSION,
    description: "Exact A input + exact B S=600. No HIGH_EQUAL operator",
    inputPolicy: "C7_EQUAL_BASE_SHRINKAGE_GD_RATE",
    eloGoalScale: 600,
    highEqualPolicy: "NONE",
    productionBaseCommit: PRODUCTION_BASE_COMMIT,
  },
  {
    candidateId: "CANDIDATE_D_COMBINED_HIGH_EQUAL",
    candidateVersion: CANDIDATE_ARM_VERSION,
    description: "Exact C plus exact 5B.16 T1 HIGH_EQUAL transfer",
    inputPolicy: "C7_EQUAL_BASE_SHRINKAGE_GD_RATE",
    eloGoalScale: 600,
    highEqualPolicy: "T1_PLUS_10_PERCENT_FROM_NON_DRAW",
    productionBaseCommit: PRODUCTION_BASE_COMMIT,
  },
];

export const PRIMARY_PROSPECTIVE_METRICS = ["logLoss", "brier", "ece"] as const;
export const SECONDARY_PROSPECTIVE_METRICS = [
  "accuracy",
  "predictedHda",
  "observedHda",
  "homeBias",
  "drawBias",
  "awayBias",
  "meanConfidence",
  "share80",
  "share90",
  "share95",
  "highEqualOe",
  "lowEqualOe",
] as const;

export const PROSPECTIVE_PROMOTION_RULES = {
  minN: 500,
  neverPromoteOnAccuracyAlone: true,
  requireNoIntegrityViolation: true,
  requireLogLossNotWorseThanControl: true,
  requireBrierNotWorseThanControl: true,
  requireEceNotMateriallyWorseThanControl: true,
  requireNoNewPathological90or95: true,
  inspectClassBiasesIndividually: true,
  inspectTemporalStability: true,
  requireNoCandidateModification: true,
  conflictResult: "INCONCLUSIVE_REQUIRES_REVIEW",
  noCombinedWinnerScore: true,
  noAutomaticNumericPromotion: true,
  checkpointsAreDescriptiveOnly: true,
  checkpoints: PROSPECTIVE_CHECKPOINTS,
} as const;

export const HIGH_EQUAL_SPECIAL_RULE = {
  appliesTo: "CANDIDATE_D_COMBINED_HIGH_EQUAL",
  compareTo: "CANDIDATE_C_COMBINED",
  requireUsefulHighEqualDirection: true,
  forbidMaterialLowEqualDegradation: true,
  forbidMaterialProperScoreDegradation: true,
  forbidNewClassCalibrationPathology: true,
  noHistoricalFitThresholds: true,
} as const;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const CANDIDATE_MANIFEST = {
  version: PROSPECTIVE_CANDIDATE_VERSION,
  productionBaseCommit: PRODUCTION_BASE_COMMIT,
  armCount: CANDIDATE_ARMS.length,
  arms: CANDIDATE_ARMS,
  controlGeometry: CONTROL_PRODUCTION_GEOMETRY,
  c7InputGeometry: C7_INPUT_GEOMETRY,
  t1HighEqualPolicy: T1_HIGH_EQUAL_POLICY,
  promotion: PROSPECTIVE_PROMOTION_RULES,
  highEqualSpecial: HIGH_EQUAL_SPECIAL_RULE,
} as const;

export const CANDIDATE_MANIFEST_FINGERPRINT = createHash("sha256")
  .update(canonicalJson(CANDIDATE_MANIFEST))
  .digest("hex");

export function candidateArm(id: ProspectiveCandidateId): CandidateArmSpec {
  const spec = CANDIDATE_ARMS.find((row) => row.candidateId === id);
  if (!spec) throw new Error(`Unknown prospective candidate ${id}`);
  return spec;
}

export function assertExactlyFiveArms(): void {
  if (CANDIDATE_ARMS.length !== 5) {
    throw new Error("Prospective pre-registration must freeze exactly five arms");
  }
  if (PROSPECTIVE_CANDIDATE_IDS.length !== 5) {
    throw new Error("Prospective candidate ID list must contain exactly five ids");
  }
}
