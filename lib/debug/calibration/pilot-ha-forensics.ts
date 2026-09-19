/**
 * Offline home-advantage forensic decomposition.
 * Does not mutate production PE config or create a production policy.
 */

import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
} from "@/lib/debug/calibration/types";
import { confidenceFromHybrid } from "@/lib/intelligence/modules/probability";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import type { HybridProbabilityConfig } from "@/lib/intelligence/modules/probability/hybrid/types";
import type { OneXTwo } from "@/lib/debug/calibration/types";

/** Midpoint of role bases. Diagnostic equal-prior only. Not a production rating. */
export const EQUALIZED_ROLE_ELO =
  (CALIBRATION_HOME_BASE + CALIBRATION_AWAY_BASE) / 2;
/** Mean of production μ_home / μ_away. Diagnostic neutralization only. */
export const NEUTRAL_GOAL_BASELINE =
  (DEFAULT_HYBRID_CONFIG.baseHomeGoals + DEFAULT_HYBRID_CONFIG.baseAwayGoals) / 2;

export type HomeAdvantageComponents = {
  roleHomeElo: number;
  roleAwayElo: number;
  roleEloGap: number;
  homeAdvantageElo: number;
  baseHomeGoals: number;
  baseAwayGoals: number;
  homeGoalsAdvantage: number;
};

export type ForensicPrediction = {
  homeElo: number;
  awayElo: number;
  config: HybridProbabilityConfig;
  expectedGoals: { home: number; away: number };
  eloOneXTwo: OneXTwo;
  poissonOneXTwo: OneXTwo;
  hybridOneXTwo: OneXTwo;
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
};

function snapshotDefaultConfig(): HybridProbabilityConfig {
  return { ...DEFAULT_HYBRID_CONFIG };
}

function assertProductionConfigUnchanged(before: HybridProbabilityConfig): void {
  const keys = Object.keys(before) as Array<keyof HybridProbabilityConfig>;
  for (const key of keys) {
    if (DEFAULT_HYBRID_CONFIG[key] !== before[key]) {
      throw new Error(`Production hybrid config mutated at ${String(key)}`);
    }
  }
}

export function productionHomeAdvantageComponents(): HomeAdvantageComponents {
  return {
    roleHomeElo: CALIBRATION_HOME_BASE,
    roleAwayElo: CALIBRATION_AWAY_BASE,
    roleEloGap: CALIBRATION_HOME_BASE - CALIBRATION_AWAY_BASE,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
  };
}

export function predictForensicMatchup(input: {
  homeElo: number;
  awayElo: number;
  config?: Partial<HybridProbabilityConfig>;
}): ForensicPrediction {
  const before = snapshotDefaultConfig();
  const engine = new EloPoissonHybridEngine(input.config);
  const result = engine.predict({
    homeElo: input.homeElo,
    awayElo: input.awayElo,
  });
  assertProductionConfigUnchanged(before);
  const confidence = confidenceFromHybrid(result);
  return {
    homeElo: input.homeElo,
    awayElo: input.awayElo,
    config: { ...result.meta.config },
    expectedGoals: {
      home: result.expectedGoals.home,
      away: result.expectedGoals.away,
    },
    eloOneXTwo: result.elo.oneXTwo,
    poissonOneXTwo: result.poisson.oneXTwo,
    hybridOneXTwo: result.oneXTwo,
    confidence: confidence.value,
    confidenceBand: confidence.band,
  };
}

export function decomposeZeroEvidenceHomeAdvantage(): {
  production: ForensicPrediction;
  CF1: ForensicPrediction;
  CF2: ForensicPrediction;
  CF3: ForensicPrediction;
  CF4: ForensicPrediction;
  CF5: ForensicPrediction;
} {
  const before = snapshotDefaultConfig();
  const out = {
    production: predictForensicMatchup({
      homeElo: CALIBRATION_HOME_BASE,
      awayElo: CALIBRATION_AWAY_BASE,
    }),
    CF1: predictForensicMatchup({
      homeElo: EQUALIZED_ROLE_ELO,
      awayElo: EQUALIZED_ROLE_ELO,
    }),
    CF2: predictForensicMatchup({
      homeElo: CALIBRATION_HOME_BASE,
      awayElo: CALIBRATION_AWAY_BASE,
      config: { homeAdvantageElo: 0 },
    }),
    CF3: predictForensicMatchup({
      homeElo: CALIBRATION_HOME_BASE,
      awayElo: CALIBRATION_AWAY_BASE,
      config: {
        baseHomeGoals: NEUTRAL_GOAL_BASELINE,
        baseAwayGoals: NEUTRAL_GOAL_BASELINE,
      },
    }),
    CF4: predictForensicMatchup({
      homeElo: EQUALIZED_ROLE_ELO,
      awayElo: EQUALIZED_ROLE_ELO,
      config: { homeAdvantageElo: 0 },
    }),
    CF5: predictForensicMatchup({
      homeElo: EQUALIZED_ROLE_ELO,
      awayElo: EQUALIZED_ROLE_ELO,
      config: {
        homeAdvantageElo: 0,
        baseHomeGoals: NEUTRAL_GOAL_BASELINE,
        baseAwayGoals: NEUTRAL_GOAL_BASELINE,
      },
    }),
  };
  assertProductionConfigUnchanged(before);
  return out;
}
