import {
  eloToExpectedGoals,
  eloToOneXTwo,
  eloWinExpectancy,
} from "@/lib/intelligence/modules/probability/math/elo";
import { normalizeOutcomeProbability } from "@/lib/intelligence/modules/probability/math/normalize";
import { mergeHybridConfig } from "@/lib/intelligence/modules/probability/hybrid/config";
import { marginalizePoissonScoreGrid } from "@/lib/intelligence/modules/probability/hybrid/score-matrix";
import type {
  HybridProbabilityConfig,
  HybridProbabilityResult,
  ProbabilityEngine,
  TeamEloInput,
} from "@/lib/intelligence/modules/probability/hybrid/types";
import type { OutcomeProbability } from "@/lib/intelligence/types";

/**
 * Hybrid Probability Engine v0.1
 *
 * Pipeline:
 * 1) Elo win expectancy + Elo→1X2 bridge
 * 2) Elo ratings → expected goals (λ_home, λ_away)
 * 3) Independent Poisson score matrix → 1X2 and O/U 2.5
 * 4) Blend Poisson/Elo 1X2 with weight w
 *
 * Over/Under 2.5 comes purely from the Poisson score model (score-based market).
 *
 * Formulas: docs/PROBABILITY_ENGINE.md
 *
 * TODO(dixon-coles): add low-score dependence correction τ for 0-0 / 1-0 / 0-1.
 * TODO(calibration): fit base goals / blend weight per league from history.
 * TODO(elo-provider): accept EloRatingProvider instead of raw ratings only.
 */
export class EloPoissonHybridEngine implements ProbabilityEngine {
  readonly modelVersion: string;
  private readonly config: HybridProbabilityConfig;

  constructor(config?: Partial<HybridProbabilityConfig>) {
    this.config = mergeHybridConfig(config);
    this.modelVersion = this.config.modelVersion;
  }

  predict(input: TeamEloInput): HybridProbabilityResult {
    validateEloInput(input);

    const {
      homeAdvantageElo,
      eloScale,
      baseHomeGoals,
      baseAwayGoals,
      eloGoalScale,
      homeGoalsAdvantage,
      eloDrawBase,
      eloDrawDecay,
      poissonBlendWeight,
      maxGoals,
    } = this.config;

    const winExpectancyHome = eloWinExpectancy({
      homeElo: input.homeElo,
      awayElo: input.awayElo,
      homeAdvantageElo,
      scale: eloScale,
    });

    const eloOneXTwo = eloToOneXTwo({
      homeElo: input.homeElo,
      awayElo: input.awayElo,
      homeAdvantageElo,
      drawBase: eloDrawBase,
      drawDecay: eloDrawDecay,
      scale: eloScale,
    });

    const { lambdaHome, lambdaAway } = eloToExpectedGoals({
      homeElo: input.homeElo,
      awayElo: input.awayElo,
      baseHomeGoals,
      baseAwayGoals,
      eloGoalScale,
      homeGoalsAdvantage,
    });

    const poissonMarginals = marginalizePoissonScoreGrid({
      lambdaHome,
      lambdaAway,
      maxGoals,
    });

    const blendedOneXTwo = blendOneXTwo(
      poissonMarginals.oneXTwo,
      eloOneXTwo,
      poissonBlendWeight,
    );

    return {
      oneXTwo: blendedOneXTwo,
      overUnder25: poissonMarginals.overUnder25,
      expectedGoals: {
        home: lambdaHome,
        away: lambdaAway,
        total: lambdaHome + lambdaAway,
      },
      elo: {
        winExpectancyHome,
        oneXTwo: eloOneXTwo,
      },
      poisson: {
        lambdaHome,
        lambdaAway,
        oneXTwo: poissonMarginals.oneXTwo,
        overUnder25: poissonMarginals.overUnder25,
        coveredMass: poissonMarginals.coveredMass,
      },
      meta: {
        modelVersion: this.modelVersion,
        poissonBlendWeight,
        config: this.config,
      },
    };
  }
}

/**
 * P = w * P_poisson + (1 - w) * P_elo, then renormalize.
 */
export function blendOneXTwo(
  poisson: OutcomeProbability,
  elo: OutcomeProbability,
  poissonWeight: number,
): OutcomeProbability {
  if (poissonWeight < 0 || poissonWeight > 1) {
    throw new Error(`poissonWeight must be in [0, 1], got ${poissonWeight}`);
  }

  const eloWeight = 1 - poissonWeight;
  return normalizeOutcomeProbability({
    home: poissonWeight * poisson.home + eloWeight * elo.home,
    draw: poissonWeight * poisson.draw + eloWeight * elo.draw,
    away: poissonWeight * poisson.away + eloWeight * elo.away,
  });
}

function validateEloInput(input: TeamEloInput): void {
  if (!Number.isFinite(input.homeElo) || !Number.isFinite(input.awayElo)) {
    throw new Error("homeElo and awayElo must be finite numbers");
  }
}

export function createEloPoissonHybridEngine(
  config?: Partial<HybridProbabilityConfig>,
): ProbabilityEngine {
  return new EloPoissonHybridEngine(config);
}

/**
 * Static Elo provider stub for tests / local demos.
 *
 * TODO(elo-provider): replace with persisted ratings + K-factor updates.
 */
export class StaticEloRatingProvider {
  constructor(
    private readonly ratings: Record<string, number>,
    private readonly fallback = 1500,
  ) {}

  async getPair(input: {
    homeTeamId: string;
    awayTeamId: string;
  }): Promise<{ homeElo: number; awayElo: number }> {
    return {
      homeElo: this.ratings[input.homeTeamId] ?? this.fallback,
      awayElo: this.ratings[input.awayTeamId] ?? this.fallback,
    };
  }
}
