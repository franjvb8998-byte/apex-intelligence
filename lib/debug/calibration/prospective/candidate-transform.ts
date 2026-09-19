/**
 * Prospective Elo→xG scale. Only S may differ from production.
 */

import {
  DEFAULT_HYBRID_CONFIG,
  mergeHybridConfig,
} from "@/lib/intelligence/modules/probability/hybrid/config";
import type { HybridProbabilityConfig } from "@/lib/intelligence/modules/probability/hybrid/types";

export function candidateHybridConfig(eloGoalScale: number): HybridProbabilityConfig {
  if (eloGoalScale !== 400 && eloGoalScale !== 600) {
    throw new Error(`Unregistered prospective S=${eloGoalScale}`);
  }
  return mergeHybridConfig({ eloGoalScale });
}

export function assertProductionDownstreamUnchanged(config: HybridProbabilityConfig): void {
  if (config.baseHomeGoals !== DEFAULT_HYBRID_CONFIG.baseHomeGoals) {
    throw new Error("baseHomeGoals must remain production");
  }
  if (config.baseAwayGoals !== DEFAULT_HYBRID_CONFIG.baseAwayGoals) {
    throw new Error("baseAwayGoals must remain production");
  }
  if (config.homeAdvantageElo !== DEFAULT_HYBRID_CONFIG.homeAdvantageElo) {
    throw new Error("HA must remain production");
  }
  if (config.eloDrawBase !== DEFAULT_HYBRID_CONFIG.eloDrawBase) {
    throw new Error("eloDrawBase must remain production");
  }
  if (config.poissonBlendWeight !== DEFAULT_HYBRID_CONFIG.poissonBlendWeight) {
    throw new Error("blend must remain production");
  }
  if (config.maxGoals !== DEFAULT_HYBRID_CONFIG.maxGoals) {
    throw new Error("maxGoals must remain production");
  }
}
