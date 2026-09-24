/**
 * GOALS-1G.3 — Research artifact for selected refinement candidate.
 */

import { createHash } from "node:crypto";
import type { RefParams } from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";
import type { GoalsMcalRefCandidateId } from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
import {
  GOALS_MCAL_REF_LOGIT_EPSILON,
  GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";

export const GOALS_MCAL_REF_ARTIFACT_SCHEMA =
  "goals.market_calibration.refinement.artifact.v1" as const;

export type GoalsMcalRefArtifact = {
  schemaVersion: typeof GOALS_MCAL_REF_ARTIFACT_SCHEMA;
  protocolDigest: string;
  parentG1ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST;
  parentG12ProtocolDigest: typeof GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST;
  trainingSeason: "2023";
  candidateId: GoalsMcalRefCandidateId;
  intercept: number | null;
  slope: number | null;
  appliedMarkets: readonly string[];
  fitN: number;
  positiveN: number;
  negativeN: number;
  clippingEpsilon: typeof GOALS_MCAL_REF_LOGIT_EPSILON;
  parameterDigest: string;
  selectionEvidenceDigest: string;
  selectionReason: string;
  coherenceRequirements: {
    complementsDerived: true;
    noPostHocRepair: true;
    r3CrossBoundaryMonotonicityRequired: true;
    failClosedOnCoherenceInvalid: true;
  };
};

export function buildRefinementArtifact(input: {
  protocolDigest: string;
  params: RefParams;
  selectionEvidenceDigest: string;
  selectionReason: string;
}): GoalsMcalRefArtifact {
  const p = input.params;
  return {
    schemaVersion: GOALS_MCAL_REF_ARTIFACT_SCHEMA,
    protocolDigest: input.protocolDigest,
    parentG1ProtocolDigest: GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST,
    parentG12ProtocolDigest: GOALS_MCAL_REF_PARENT_G12_PROTOCOL_DIGEST,
    trainingSeason: "2023",
    candidateId: p.candidateId,
    intercept: p.intercept,
    slope: p.slope,
    appliedMarkets: p.appliedMarkets,
    fitN: p.fitN,
    positiveN: p.positiveN,
    negativeN: p.negativeN,
    clippingEpsilon: GOALS_MCAL_REF_LOGIT_EPSILON,
    parameterDigest: p.parameterDigest,
    selectionEvidenceDigest: input.selectionEvidenceDigest,
    selectionReason: input.selectionReason,
    coherenceRequirements: {
      complementsDerived: true,
      noPostHocRepair: true,
      r3CrossBoundaryMonotonicityRequired: true,
      failClosedOnCoherenceInvalid: true,
    },
  };
}

export function digestRefinementArtifact(
  artifact: GoalsMcalRefArtifact,
): string {
  return createHash("sha256")
    .update(JSON.stringify(artifact, Object.keys(artifact).sort(), 2), "utf8")
    .digest("hex");
}
