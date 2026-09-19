/**
 * Prospective candidate engine. Wraps production PE; does not mutate it.
 */

import { EloPoissonHybridEngine, blendOneXTwo } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability/confidence-from-hybrid";
import { buildControlGrid } from "@/lib/debug/calibration/lm-5b16-formula";
import {
  CANDIDATE_MANIFEST_FINGERPRINT,
  candidateArm,
} from "@/lib/debug/calibration/prospective/candidate-config";
import { resolveCandidateElos } from "@/lib/debug/calibration/prospective/candidate-input";
import {
  assertProductionDownstreamUnchanged,
  candidateHybridConfig,
} from "@/lib/debug/calibration/prospective/candidate-transform";
import { applyCandidateHighEqual } from "@/lib/debug/calibration/prospective/candidate-high-equal";
import type {
  ProspectiveCandidateId,
  ProspectiveEvidence,
} from "@/lib/debug/calibration/prospective/candidate-types";
import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability/hybrid/types";

export type CandidatePrediction = {
  candidateId: ProspectiveCandidateId;
  candidateVersion: string;
  candidateFingerprint: string;
  homeElo: number;
  awayElo: number;
  eloGap: number;
  lambdaHome: number;
  lambdaAway: number;
  oneXTwo: { home: number; draw: number; away: number };
  confidence: number;
  modelVersion: string;
  eloGoalScale: number;
  inputPolicy: string;
  highEqualPolicy: string;
  hybrid: HybridProbabilityResult;
};

export function predictCandidate(
  candidateId: ProspectiveCandidateId,
  evidence: ProspectiveEvidence,
): CandidatePrediction {
  const spec = candidateArm(candidateId);
  const elos = resolveCandidateElos(spec.inputPolicy, evidence);
  const config = candidateHybridConfig(spec.eloGoalScale);
  assertProductionDownstreamUnchanged(config);
  const engine = new EloPoissonHybridEngine({ eloGoalScale: spec.eloGoalScale });
  const hybrid = engine.predict({
    homeElo: elos.homeElo,
    awayElo: elos.awayElo,
    homeTeamId: evidence.homeTeamId,
    awayTeamId: evidence.awayTeamId,
    matchId: evidence.fixtureId,
  });

  let oneXTwo = hybrid.oneXTwo;
  if (spec.highEqualPolicy !== "NONE") {
    const control = buildControlGrid(hybrid.expectedGoals.home, hybrid.expectedGoals.away);
    const transferred = applyCandidateHighEqual(spec.highEqualPolicy, control);
    oneXTwo = blendOneXTwo(transferred.oneXTwo, hybrid.elo.oneXTwo, config.poissonBlendWeight);
  }

  const sum = oneXTwo.home + oneXTwo.draw + oneXTwo.away;
  if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-12) {
    throw new Error(`Candidate ${candidateId} H+D+A is ${sum}`);
  }
  if (![oneXTwo.home, oneXTwo.draw, oneXTwo.away].every((value) => value >= 0 && Number.isFinite(value))) {
    throw new Error(`Candidate ${candidateId} produced a non-finite or negative probability`);
  }

  const confidenceHybrid =
    spec.highEqualPolicy === "NONE"
      ? hybrid
      : { ...hybrid, oneXTwo };

  return {
    candidateId,
    candidateVersion: spec.candidateVersion,
    candidateFingerprint: CANDIDATE_MANIFEST_FINGERPRINT,
    homeElo: elos.homeElo,
    awayElo: elos.awayElo,
    eloGap: elos.homeElo - elos.awayElo,
    lambdaHome: hybrid.expectedGoals.home,
    lambdaAway: hybrid.expectedGoals.away,
    oneXTwo,
    confidence: confidenceFromHybrid(confidenceHybrid).value,
    modelVersion: hybrid.meta.modelVersion,
    eloGoalScale: spec.eloGoalScale,
    inputPolicy: spec.inputPolicy,
    highEqualPolicy: spec.highEqualPolicy,
    hybrid,
  };
}
