import type { SimulationModule } from "@/lib/intelligence/contracts";
import type {
  FeatureVector,
  OutcomeProbability,
  SimulationResult,
  SimulationScenario,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Stub — scenario / Monte Carlo simulation.
 */
export class SimulationService implements SimulationModule {
  listDefaultScenarios(_matchId: UUID): SimulationScenario[] {
    throw new Error("SimulationService.listDefaultScenarios is not implemented");
  }

  async run(
    _features: FeatureVector,
    _scenario: SimulationScenario,
    _options?: { samples?: number },
  ): Promise<SimulationResult> {
    throw new Error("SimulationService.run is not implemented");
  }

  aggregate(_results: SimulationResult[]): OutcomeProbability {
    throw new Error("SimulationService.aggregate is not implemented");
  }
}

export function createSimulationModule(): SimulationModule {
  return new SimulationService();
}
