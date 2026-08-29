import type { ProbabilityModule } from "@/lib/intelligence/contracts";
import type { MatchOutcome, OutcomeProbability } from "@/lib/intelligence/types";
import {
  mostLikelyOutcome,
  normalizeOutcomeProbability,
  normalizedEntropy,
  softmaxFromScores,
} from "@/lib/intelligence/modules/probability/math/normalize";

export {
  createEloPoissonHybridEngine,
  EloPoissonHybridEngine,
  StaticEloRatingProvider,
  blendOneXTwo,
} from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
export {
  DEFAULT_HYBRID_CONFIG,
  mergeHybridConfig,
} from "@/lib/intelligence/modules/probability/hybrid/config";
export {
  bothTeamsToScoreFromLambdas,
  marginalizePoissonScoreGrid,
} from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
export type { BothTeamsToScoreProbability } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
export type {
  EloRatingProvider,
  HybridProbabilityConfig,
  HybridProbabilityResult,
  OverUnderProbability,
  ProbabilityEngine,
  TeamEloInput,
} from "@/lib/intelligence/modules/probability/hybrid/types";

export {
  eloToExpectedGoals,
  eloToOneXTwo,
  eloWinExpectancy,
} from "@/lib/intelligence/modules/probability/math/elo";
export {
  factorial,
  poissonPmf,
  scorelineProbability,
} from "@/lib/intelligence/modules/probability/math/poisson";
export {
  mostLikelyOutcome,
  normalizeBinary,
  normalizeOutcomeProbability,
  normalizedEntropy,
  softmaxFromScores,
} from "@/lib/intelligence/modules/probability/math/normalize";
export { confidenceFromHybrid } from "@/lib/intelligence/modules/probability/confidence-from-hybrid";
export { estimateEloFromTeamId } from "@/lib/intelligence/modules/probability/elo-estimate";

/**
 * General probability utilities (normalize / softmax / entropy).
 * Match markets (1X2, O/U) live in EloPoissonHybridEngine.
 */
export class ProbabilityService implements ProbabilityModule {
  normalize(probabilities: OutcomeProbability): OutcomeProbability {
    return normalizeOutcomeProbability(probabilities);
  }

  fromScores(scores: Record<MatchOutcome, number>): OutcomeProbability {
    return softmaxFromScores(scores);
  }

  mostLikely(probabilities: OutcomeProbability): MatchOutcome {
    return mostLikelyOutcome(probabilities);
  }

  uncertainty(probabilities: OutcomeProbability): number {
    return normalizedEntropy(probabilities);
  }
}

export function createProbabilityModule(): ProbabilityModule {
  return new ProbabilityService();
}
