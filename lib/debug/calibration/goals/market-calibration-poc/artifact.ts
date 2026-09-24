/**
 * GOALS-1G.2 — Research artifact + parameter digests (no absolute paths/timestamps).
 */

import { createHash } from "node:crypto";
import type { LogisticFitResult } from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import type { GroupSelectionResult } from "@/lib/debug/calibration/goals/market-calibration-poc/select";
import type { GoalsMcalPocGroupId } from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import {
  GOALS_MCAL_POC_LOGIT_EPSILON,
  GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_MCAL_POC_PROTOCOL_VERSION,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export const GOALS_MCAL_POC_ARTIFACT_SCHEMA =
  "goals.market_calibration.artifact.v1" as const;

export type GoalsMcalPocArtifact = {
  schemaVersion: typeof GOALS_MCAL_POC_ARTIFACT_SCHEMA;
  protocolDigest: string;
  parentG1ProtocolDigest: typeof GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST;
  trainingSeason: "2023";
  group: GoalsMcalPocGroupId;
  calibratorFamily: "CAL_0" | "CAL_1";
  intercept: number | null;
  slope: number | null;
  fitN: number;
  positiveN: number;
  negativeN: number;
  clippingEpsilon: typeof GOALS_MCAL_POC_LOGIT_EPSILON;
  parameterDigest: string;
  selectionEvidence: {
    meanFoldLlImprovement: number;
    meanFoldBrierDelta: number;
    meanFoldO05LlWorsen: number | null;
    reason: string;
    parameterStability: GroupSelectionResult["parameterStability"];
  };
  coherenceRequirements: {
    complementsDerived: true;
    monotoneWithinGroupWhenSlopePositive: true;
    failClosedNonPositiveSlope: true;
    noPostHocRepair: true;
    noDedicatedO05Calibrator: true;
  };
};

export function buildGroupArtifact(input: {
  protocolDigest: string;
  selection: GroupSelectionResult;
}): GoalsMcalPocArtifact {
  const sel = input.selection;
  const fit: LogisticFitResult | null =
    sel.selectedFamily === "CAL_1" ? sel.fullDevFit : null;
  return {
    schemaVersion: GOALS_MCAL_POC_ARTIFACT_SCHEMA,
    protocolDigest: input.protocolDigest,
    parentG1ProtocolDigest: GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST,
    trainingSeason: "2023",
    group: sel.groupId,
    calibratorFamily: sel.selectedFamily,
    intercept: fit?.finite ? fit.intercept : null,
    slope: fit?.finite ? fit.slope : null,
    fitN: fit?.fitN ?? 0,
    positiveN: fit?.positiveN ?? 0,
    negativeN: fit?.negativeN ?? 0,
    clippingEpsilon: GOALS_MCAL_POC_LOGIT_EPSILON,
    parameterDigest:
      fit?.parameterDigest ??
      createHash("sha256").update("CAL_0_IDENTITY").digest("hex"),
    selectionEvidence: {
      meanFoldLlImprovement: sel.meanFoldLlImprovement,
      meanFoldBrierDelta: sel.meanFoldBrierDelta,
      meanFoldO05LlWorsen: sel.meanFoldO05LlWorsen,
      reason: sel.reason,
      parameterStability: sel.parameterStability,
    },
    coherenceRequirements: {
      complementsDerived: true,
      monotoneWithinGroupWhenSlopePositive: true,
      failClosedNonPositiveSlope: true,
      noPostHocRepair: true,
      noDedicatedO05Calibrator: true,
    },
  };
}

export function digestArtifact(artifact: GoalsMcalPocArtifact): string {
  return createHash("sha256")
    .update(JSON.stringify(artifact, Object.keys(artifact).sort(), 2), "utf8")
    .digest("hex");
}

export function digestArtifactBundle(
  artifacts: Record<string, GoalsMcalPocArtifact>,
): string {
  const keys = Object.keys(artifacts).sort();
  const material = keys.map((k) => ({
    group: k,
    digest: digestArtifact(artifacts[k]!),
  }));
  return createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");
}

export function protocolVersionPin(): typeof GOALS_MCAL_POC_PROTOCOL_VERSION {
  return GOALS_MCAL_POC_PROTOCOL_VERSION;
}
