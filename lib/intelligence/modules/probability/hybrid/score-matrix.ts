import { scorelineProbability } from "@/lib/intelligence/modules/probability/math/poisson";
import { normalizeBinary } from "@/lib/intelligence/modules/probability/math/normalize";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";
import type { OutcomeProbability } from "@/lib/intelligence/types";
import type { OverUnderProbability } from "@/lib/intelligence/modules/probability/hybrid/types";

export type ScoreMatrixMarginals = {
  oneXTwo: OutcomeProbability;
  overUnder25: OverUnderProbability;
  coveredMass: number;
};

export type BothTeamsToScoreProbability = {
  yes: number;
  no: number;
};

/**
 * Build a truncated independent-Poisson score grid and marginalize.
 *
 * For i,j ∈ {0..M}:
 *   P(i,j) = Pois(i; λ_h) * Pois(j; λ_a)
 *
 * 1X2:
 *   P_home = Σ_{i>j} P(i,j)
 *   P_draw = Σ_{i=j} P(i,j)
 *   P_away = Σ_{i<j} P(i,j)
 *
 * Over/Under 2.5:
 *   P_over  = Σ_{i+j ≥ 3} P(i,j)
 *   P_under = Σ_{i+j ≤ 2} P(i,j)
 *
 * Marginals are renormalized by coveredMass = Σ P(i,j) so truncation
 * does not leak probability.
 */
export function marginalizePoissonScoreGrid(input: {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals: number;
}): ScoreMatrixMarginals {
  const { lambdaHome, lambdaAway, maxGoals } = input;

  let home = 0;
  let draw = 0;
  let away = 0;
  let over = 0;
  let under = 0;
  let coveredMass = 0;

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const p = scorelineProbability(i, j, lambdaHome, lambdaAway);
      coveredMass += p;

      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;

      if (i + j >= 3) over += p;
      else under += p;
    }
  }

  if (coveredMass <= 0) {
    throw new Error("Poisson score grid produced zero probability mass");
  }

  const oneXTwo = normalizeOutcomeProbability({
    home: home / coveredMass,
    draw: draw / coveredMass,
    away: away / coveredMass,
  });

  const ou = normalizeBinary(over / coveredMass, under / coveredMass);

  return {
    oneXTwo,
    overUnder25: {
      line: 2.5,
      over: ou.over,
      under: ou.under,
    },
    coveredMass,
  };
}

/**
 * P(home ≥ 1 and away ≥ 1) from independent Poisson lambdas.
 * Uses the same truncated score grid as 1X2 / O/U — not a separate engine.
 */
export function bothTeamsToScoreFromLambdas(input: {
  lambdaHome: number;
  lambdaAway: number;
  maxGoals: number;
}): BothTeamsToScoreProbability {
  const { lambdaHome, lambdaAway, maxGoals } = input;
  let yes = 0;
  let no = 0;
  let coveredMass = 0;

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const p = scorelineProbability(i, j, lambdaHome, lambdaAway);
      coveredMass += p;
      if (i >= 1 && j >= 1) yes += p;
      else no += p;
    }
  }

  if (coveredMass <= 0) {
    throw new Error("Poisson score grid produced zero probability mass");
  }

  const binary = normalizeBinary(yes / coveredMass, no / coveredMass);
  return { yes: binary.over, no: binary.under };
}
