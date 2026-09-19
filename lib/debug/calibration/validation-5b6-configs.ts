/**
 * Pre-registered 5B.6 structural hypotheses.
 * Frozen from 5B.5 before any holdout is seen. Not fitted. Not a search.
 */

import {
  CALIBRATION_AWAY_BASE,
  CALIBRATION_HOME_BASE,
} from "@/lib/debug/calibration/types";
import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import { EQUALIZED_ROLE_ELO } from "@/lib/debug/calibration/experiment-5b5-ha";

/** Pre-registered arithmetic neutralization. Not fitted to any season. */
export const VALIDATION_NEUTRAL_GOAL_BASELINE = 1.3;

export type ValidationConfigId = "V0" | "V1" | "V2" | "V3" | "V4" | "V5";

export type ValidationHaConfig = {
  id: ValidationConfigId;
  label: string;
  equalizeRolePriors: boolean;
  roleHomeElo: number;
  roleAwayElo: number;
  homeAdvantageElo: number;
  baseHomeGoals: number;
  baseAwayGoals: number;
};

export const FROZEN_VALIDATION_CONFIGS: readonly ValidationHaConfig[] = [
  {
    id: "V0",
    label: "PRODUCTION role 1580/1520 + PE HA 65 + goals 1.45/1.15",
    equalizeRolePriors: false,
    roleHomeElo: CALIBRATION_HOME_BASE,
    roleAwayElo: CALIBRATION_AWAY_BASE,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  },
  {
    id: "V1",
    label: "EQUAL ROLE PRIORS ONLY 1550/1550; PE HA 65; goals 1.45/1.15",
    equalizeRolePriors: true,
    roleHomeElo: EQUALIZED_ROLE_ELO,
    roleAwayElo: EQUALIZED_ROLE_ELO,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  },
  {
    id: "V2",
    label: "NO PE HA ONLY; role 1580/1520; goals 1.45/1.15",
    equalizeRolePriors: false,
    roleHomeElo: CALIBRATION_HOME_BASE,
    roleAwayElo: CALIBRATION_AWAY_BASE,
    homeAdvantageElo: 0,
    baseHomeGoals: DEFAULT_HYBRID_CONFIG.baseHomeGoals,
    baseAwayGoals: DEFAULT_HYBRID_CONFIG.baseAwayGoals,
  },
  {
    id: "V3",
    label: "NEUTRAL GOALS ONLY 1.30/1.30; role 1580/1520; PE HA 65",
    equalizeRolePriors: false,
    roleHomeElo: CALIBRATION_HOME_BASE,
    roleAwayElo: CALIBRATION_AWAY_BASE,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
    baseAwayGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
  },
  {
    id: "V4",
    label: "SINGLE-CHANNEL HA: equal role + PE HA 65 + goals 1.30/1.30",
    equalizeRolePriors: true,
    roleHomeElo: EQUALIZED_ROLE_ELO,
    roleAwayElo: EQUALIZED_ROLE_ELO,
    homeAdvantageElo: DEFAULT_HYBRID_CONFIG.homeAdvantageElo,
    baseHomeGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
    baseAwayGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
  },
  {
    id: "V5",
    label: "FULLY NEUTRAL 1550/1550 + PE HA 0 + goals 1.30/1.30",
    equalizeRolePriors: true,
    roleHomeElo: EQUALIZED_ROLE_ELO,
    roleAwayElo: EQUALIZED_ROLE_ELO,
    homeAdvantageElo: 0,
    baseHomeGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
    baseAwayGoals: VALIDATION_NEUTRAL_GOAL_BASELINE,
  },
];

export function frozenValidationConfig(
  id: ValidationConfigId,
): ValidationHaConfig {
  const found = FROZEN_VALIDATION_CONFIGS.find((config) => config.id === id);
  if (!found) throw new Error(`Unknown frozen validation config ${id}`);
  return found;
}
