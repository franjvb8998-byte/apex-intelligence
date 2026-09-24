/**
 * GOALS-1G.3 — Research-only adapter. Fail closed to raw G1.
 * DO NOT wire into production.
 */

import { createHash } from "node:crypto";
import { applyLogisticCal } from "@/lib/debug/calibration/goals/market-calibration-poc/logistic";
import type { GoalsMcalRefArtifact } from "@/lib/debug/calibration/goals/market-calibration-refinement/artifact";
import {
  digestRefinementArtifact,
  GOALS_MCAL_REF_ARTIFACT_SCHEMA,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/artifact";
import {
  GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
  GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";

export const GOALS_MCAL_REF_PRODUCTION_WIRED = false as const;

export type CalibrateMatchTotalInput = {
  market: string;
  rawProbability: number;
  artifact: GoalsMcalRefArtifact | null;
  expectedProtocolDigest: string;
};

export type CalibrateMatchTotalOutput = {
  calibratedProbability: number;
  complementProbability: number;
  candidateId: string;
  rawProbability: number;
  calibrationApplied: boolean;
  fallbackReason: string | null;
  provenanceDigest: string;
};

function provenance(parts: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(parts), "utf8")
    .digest("hex");
}

export function calibrateMatchTotalRefinement(
  input: CalibrateMatchTotalInput,
): CalibrateMatchTotalOutput {
  const raw = input.rawProbability;
  const fallback = (reason: string): CalibrateMatchTotalOutput => ({
    calibratedProbability: raw,
    complementProbability: 1 - raw,
    candidateId: "R0",
    rawProbability: raw,
    calibrationApplied: false,
    fallbackReason: reason,
    provenanceDigest: provenance({ mode: "fallback", reason, raw }),
  });

  if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
    return fallback("invalid_raw_probability");
  }
  if (
    !(GOALS_MCAL_REF_MATCH_TOTAL_MARKETS as readonly string[]).includes(
      input.market,
    )
  ) {
    return fallback("unknown_or_non_match_total_market");
  }

  const art = input.artifact;
  if (!art) return fallback("missing_artifact");
  if (art.schemaVersion !== GOALS_MCAL_REF_ARTIFACT_SCHEMA) {
    return fallback("unsupported_version");
  }
  if (art.protocolDigest !== input.expectedProtocolDigest) {
    return fallback("digest_mismatch");
  }
  if (art.parentG1ProtocolDigest !== GOALS_MCAL_REF_PARENT_G1_PROTOCOL_DIGEST) {
    return fallback("parent_g1_digest_mismatch");
  }

  if (art.candidateId === "R0") {
    return {
      calibratedProbability: raw,
      complementProbability: 1 - raw,
      candidateId: "R0",
      rawProbability: raw,
      calibrationApplied: false,
      fallbackReason: null,
      provenanceDigest: provenance({
        mode: "identity",
        digest: digestRefinementArtifact(art),
      }),
    };
  }

  if (!art.appliedMarkets.includes(input.market)) {
    return {
      calibratedProbability: raw,
      complementProbability: 1 - raw,
      candidateId: art.candidateId,
      rawProbability: raw,
      calibrationApplied: false,
      fallbackReason: null,
      provenanceDigest: provenance({
        mode: "untouched_threshold",
        market: input.market,
        digest: digestRefinementArtifact(art),
      }),
    };
  }

  const a = art.intercept;
  const b = art.slope;
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
    return fallback("non_finite_coefficients");
  }
  if (art.candidateId === "R2" && b !== 1) return fallback("r2_slope_not_one");
  if (b <= 0) return fallback("non_positive_slope");

  const cal = applyLogisticCal(raw, a, b);
  if (!Number.isFinite(cal) || cal < 0 || cal > 1) {
    return fallback("incoherent_output");
  }

  return {
    calibratedProbability: cal,
    complementProbability: 1 - cal,
    candidateId: art.candidateId,
    rawProbability: raw,
    calibrationApplied: true,
    fallbackReason: null,
    provenanceDigest: provenance({
      mode: "calibrated",
      digest: digestRefinementArtifact(art),
      a,
      b,
    }),
  };
}
