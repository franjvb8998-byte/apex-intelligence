/**
 * Offline home-advantage experimental configurations.
 * Instantiates isolated PE engines. Does not mutate production defaults.
 */

import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
} from "@/lib/debug/calibration/types";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { EloPoissonHybridEngine } from "@/lib/intelligence/modules/probability/hybrid/elo-poisson-engine";
import type { HybridProbabilityConfig } from "@/lib/intelligence/modules/probability/hybrid/types";
import type { ProbabilityEngine } from "@/lib/intelligence/modules/probability";

export const EQUALIZED_ROLE_ELO =
  (CALIBRATION_HOME_BASE + CALIBRATION_AWAY_BASE) / 2;

export const NEUTRAL_GOAL_BASELINE_N1 =
  (DEFAULT_HYBRID_CONFIG.baseHomeGoals + DEFAULT_HYBRID_CONFIG.baseAwayGoals) / 2;

export const NEUTRAL_GOAL_BASELINE_N2 = Math.sqrt(
  DEFAULT_HYBRID_CONFIG.baseHomeGoals * DEFAULT_HYBRID_CONFIG.baseAwayGoals,
);

export type NeutralGoalKind = "none" | "N1" | "N2";

export type ExperimentHaId =
  | "HA0_PRODUCTION"
  | "HA1_EQUAL_ROLE_PRIORS"
  | "HA2_NO_PE_HA"
  | "HA3_NEUTRAL_GOALS_N1"
  | "HA3_NEUTRAL_GOALS_N2"
  | "HA4_SINGLE_ELO_HA_N1"
  | "HA4_SINGLE_ELO_HA_N2"
  | "HA5_SINGLE_GOAL_HA"
  | "HA6_FULLY_NEUTRAL_N1"
  | "HA6_FULLY_NEUTRAL_N2";

export type ExperimentHaConfig = {
  id: ExperimentHaId;
  family: "HA0" | "HA1" | "HA2" | "HA3" | "HA4" | "HA5" | "HA6";
  label: string;
  equalizeRolePriors: boolean;
  homeAdvantageElo: number;
  baseHomeGoals: number;
  baseAwayGoals: number;
  neutralGoalKind: NeutralGoalKind;
};

export function productionHaConstants() {
  return {
    roleHomeElo: CALIBRATION_HOME_BASE,
    roleAwayElo: CALIBRATION_AWAY_BASE,
    roleEloGap: CALIBRATION_HOME_BASE - CALIBRATION_AWAY_BASE,
    equalizedRoleElo: EQUALIZED_ROLE_ELO,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
    homeGoalsAdvantage: DEFAULT_HYBRID_CONFIG.homeGoalsAdvantage,
    eloScale: DEFAULT_HYBRID_CONFIG.eloScale,
    eloGoalScale: DEFAULT_HYBRID_CONFIG.eloGoalScale,
    poissonBlendWeight: DEFAULT_HYBRID_CONFIG.poissonBlendWeight,
    modelVersion: DEFAULT_HYBRID_CONFIG.modelVersion,
    neutralGoalBaselineN1: NEUTRAL_GOAL_BASELINE_N1,
    neutralGoalBaselineN2: NEUTRAL_GOAL_BASELINE_N2,
    neutralGoalNote:
      "N1 is the arithmetic mean of production μ_home/μ_away and preserves average scoring rate. N2 is the geometric mean and preserves the product μ_home·μ_away, which is the natural invariant of the PE's multiplicative λ mapping when Elo is equal. homeGoalsAdvantage is already 1.0, so it adds no extra home edge to neutralize. PE homeAdvantageElo does not enter Elo→λ.",
  };
}

function goalsFor(kind: NeutralGoalKind): { home: number; away: number } {
  if (kind === "N1") {
    return { home: NEUTRAL_GOAL_BASELINE_N1, away: NEUTRAL_GOAL_BASELINE_N1 };
  }
  if (kind === "N2") {
    return { home: NEUTRAL_GOAL_BASELINE_N2, away: NEUTRAL_GOAL_BASELINE_N2 };
  }
  return {
    home: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    away: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  };
}

function haConfig(input: {
  id: ExperimentHaId;
  family: ExperimentHaConfig["family"];
  label: string;
  equalizeRolePriors: boolean;
  homeAdvantageElo: number;
  neutralGoalKind: NeutralGoalKind;
}): ExperimentHaConfig {
  const goals = goalsFor(input.neutralGoalKind);
  return {
    ...input,
    baseHomeGoals: goals.home,
    baseAwayGoals: goals.away,
  };
}

export const EXPERIMENT_HA_CONFIGS: readonly ExperimentHaConfig[] = [
  haConfig({
    id: "HA0_PRODUCTION",
    family: "HA0",
    label: "Production role bases + PE HA + goal baselines",
    equalizeRolePriors: false,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "none",
  }),
  haConfig({
    id: "HA1_EQUAL_ROLE_PRIORS",
    family: "HA1",
    label: "Equal role priors; current PE HA; current goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "none",
  }),
  haConfig({
    id: "HA2_NO_PE_HA",
    family: "HA2",
    label: "Current role bases; PE homeAdvantageElo=0; current goal baselines",
    equalizeRolePriors: false,
    homeAdvantageElo: 0,
    neutralGoalKind: "none",
  }),
  haConfig({
    id: "HA3_NEUTRAL_GOALS_N1",
    family: "HA3",
    label: "Current role bases; current PE HA; arithmetic-mean goal baselines",
    equalizeRolePriors: false,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "N1",
  }),
  haConfig({
    id: "HA3_NEUTRAL_GOALS_N2",
    family: "HA3",
    label: "Current role bases; current PE HA; geometric-mean goal baselines",
    equalizeRolePriors: false,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "N2",
  }),
  haConfig({
    id: "HA4_SINGLE_ELO_HA_N1",
    family: "HA4",
    label: "Equal role priors; retain PE HA; arithmetic-mean goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "N1",
  }),
  haConfig({
    id: "HA4_SINGLE_ELO_HA_N2",
    family: "HA4",
    label: "Equal role priors; retain PE HA; geometric-mean goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    neutralGoalKind: "N2",
  }),
  haConfig({
    id: "HA5_SINGLE_GOAL_HA",
    family: "HA5",
    label: "Equal role priors; PE HA=0; retain production goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: 0,
    neutralGoalKind: "none",
  }),
  haConfig({
    id: "HA6_FULLY_NEUTRAL_N1",
    family: "HA6",
    label: "Equal role priors; PE HA=0; arithmetic-mean goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: 0,
    neutralGoalKind: "N1",
  }),
  haConfig({
    id: "HA6_FULLY_NEUTRAL_N2",
    family: "HA6",
    label: "Equal role priors; PE HA=0; geometric-mean goal baselines",
    equalizeRolePriors: true,
    homeAdvantageElo: 0,
    neutralGoalKind: "N2",
  }),
];

export const COMPONENT_CONTRASTS = [
  {
    id: "equal_role_priors",
    label: "PROD → equal role priors",
    from: "HA0_PRODUCTION",
    to: "HA1_EQUAL_ROLE_PRIORS",
  },
  {
    id: "no_pe_ha",
    label: "PROD → no PE HA",
    from: "HA0_PRODUCTION",
    to: "HA2_NO_PE_HA",
  },
  {
    id: "neutral_goals_n1",
    label: "PROD → neutral goal baseline N1",
    from: "HA0_PRODUCTION",
    to: "HA3_NEUTRAL_GOALS_N1",
  },
  {
    id: "neutral_goals_n2",
    label: "PROD → neutral goal baseline N2",
    from: "HA0_PRODUCTION",
    to: "HA3_NEUTRAL_GOALS_N2",
  },
  {
    id: "fully_neutral_n1",
    label: "PROD → fully neutral N1",
    from: "HA0_PRODUCTION",
    to: "HA6_FULLY_NEUTRAL_N1",
  },
  {
    id: "fully_neutral_n2",
    label: "PROD → fully neutral N2",
    from: "HA0_PRODUCTION",
    to: "HA6_FULLY_NEUTRAL_N2",
  },
] as const;

export function snapshotDefaultHybridConfig(): HybridProbabilityConfig {
  return { ...DEFAULT_HYBRID_CONFIG };
}

export function assertProductionHybridConfigUnchanged(
  before: HybridProbabilityConfig,
): void {
  const keys = Object.keys(before) as Array<keyof HybridProbabilityConfig>;
  for (const key of keys) {
    if (DEFAULT_HYBRID_CONFIG[key] !== before[key]) {
      throw new Error(`Production hybrid config mutated at ${String(key)}`);
    }
  }
}

export function applyEqualizedRolePrior(
  elo: number,
  side: "home" | "away",
  equalize: boolean,
): number {
  if (!equalize) return elo;
  const productionBase = side === "home" ? CALIBRATION_HOME_BASE : CALIBRATION_AWAY_BASE;
  return elo + (EQUALIZED_ROLE_ELO - productionBase);
}

export function createExperimentalEngine(
  config: ExperimentHaConfig,
): ProbabilityEngine {
  const before = snapshotDefaultHybridConfig();
  const engine = new EloPoissonHybridEngine({
    homeAdvantageElo: config.homeAdvantageElo,
    baseHomeGoals: config.baseHomeGoals,
    baseAwayGoals: config.baseAwayGoals,
  });
  assertProductionHybridConfigUnchanged(before);
  return engine;
}
