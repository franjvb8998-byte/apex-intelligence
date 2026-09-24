/**
 * GOALS-1G.2 — Research-only market probability calibration adapter.
 * DO NOT wire into production. Fail closed to raw G1.
 */

import { createHash } from "node:crypto";
import { applyLogisticCal } from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import type { GoalsMcalPocArtifact } from "@/lib/debug/calibration/goals/market-calibration-poc/artifact";
import {
  GOALS_MCAL_POC_ARTIFACT_SCHEMA,
  digestArtifact,
} from "@/lib/debug/calibration/goals/market-calibration-poc/artifact";
import {
  GOALS_MCAL_POC_GROUPS,
  GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST,
  type GoalsMcalPocCanonicalMarket,
  type GoalsMcalPocGroupId,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";

export type CalibrateGoalsMarketInput = {
  market: GoalsMcalPocCanonicalMarket;
  rawProbability: number;
  artifact: GoalsMcalPocArtifact | null;
  expectedProtocolDigest: string;
};

export type CalibrateGoalsMarketOutput = {
  calibratedProbability: number;
  complementProbability: number;
  modelCalibratorVersion: string;
  rawProbability: number;
  calibrationApplied: boolean;
  fallbackReason: string | null;
  provenanceDigest: string;
};

function groupForMarket(
  market: GoalsMcalPocCanonicalMarket,
): GoalsMcalPocGroupId | null {
  for (const [gid, markets] of Object.entries(GOALS_MCAL_POC_GROUPS) as [
    GoalsMcalPocGroupId,
    readonly GoalsMcalPocCanonicalMarket[],
  ][]) {
    if ((markets as readonly string[]).includes(market)) return gid;
  }
  return null;
}

function provenance(parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex");
}

/**
 * Pure research adapter. Not imported by production decision paths.
 */
export function calibrateGoalsMarketProbabilities(
  input: CalibrateGoalsMarketInput,
): CalibrateGoalsMarketOutput {
  const raw = input.rawProbability;
  const fallback = (reason: string): CalibrateGoalsMarketOutput => ({
    calibratedProbability: raw,
    complementProbability: 1 - raw,
    modelCalibratorVersion: "CAL_0_IDENTITY",
    rawProbability: raw,
    calibrationApplied: false,
    fallbackReason: reason,
    provenanceDigest: provenance({
      mode: "fallback",
      reason,
      raw,
      market: input.market,
    }),
  });

  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    return fallback("invalid_raw_probability");
  }

  const group = groupForMarket(input.market);
  if (!group) return fallback("unknown_market");

  const art = input.artifact;
  if (!art) return fallback("missing_artifact");

  if (art.schemaVersion !== GOALS_MCAL_POC_ARTIFACT_SCHEMA) {
    return fallback("unsupported_version");
  }
  if (art.protocolDigest !== input.expectedProtocolDigest) {
    return fallback("digest_mismatch");
  }
  if (art.parentG1ProtocolDigest !== GOALS_MCAL_POC_PARENT_G1_PROTOCOL_DIGEST) {
    return fallback("parent_g1_digest_mismatch");
  }
  if (art.group !== group) return fallback("artifact_group_mismatch");

  if (art.calibratorFamily === "CAL_0") {
    return {
      calibratedProbability: raw,
      complementProbability: 1 - raw,
      modelCalibratorVersion: "CAL_0_IDENTITY",
      rawProbability: raw,
      calibrationApplied: false,
      fallbackReason: null,
      provenanceDigest: provenance({
        mode: "identity",
        artifactDigest: digestArtifact(art),
        market: input.market,
      }),
    };
  }

  const a = art.intercept;
  const b = art.slope;
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return fallback("non_finite_coefficients");
  }
  if (b <= 0) return fallback("non_positive_slope");

  const cal = applyLogisticCal(raw, a, b);
  if (!Number.isFinite(cal) || cal < 0 || cal > 1) {
    return fallback("incoherent_output");
  }
  const complement = 1 - cal;
  if (Math.abs(cal + complement - 1) > 1e-12) {
    return fallback("incoherent_output");
  }

  return {
    calibratedProbability: cal,
    complementProbability: complement,
    modelCalibratorVersion: `CAL_1_logistic/${art.group}`,
    rawProbability: raw,
    calibrationApplied: true,
    fallbackReason: null,
    provenanceDigest: provenance({
      mode: "calibrated",
      artifactDigest: digestArtifact(art),
      market: input.market,
      intercept: a,
      slope: b,
    }),
  };
}

/** Explicit marker — production must not import this module for wiring. */
export const GOALS_MCAL_POC_PRODUCTION_WIRED = false as const;
