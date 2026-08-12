import type {
  FeatureVector,
  OutcomeProbability,
  SimulationResult,
  SimulationScenario,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Simulation module — scenario sweeps and Monte Carlo style exploration.
 * Algorithms intentionally unimplemented.
 */
export interface SimulationModule {
  listDefaultScenarios(matchId: UUID): SimulationScenario[];

  run(
    features: FeatureVector,
    scenario: SimulationScenario,
    options?: { samples?: number },
  ): Promise<SimulationResult>;

  /** Aggregate multiple simulation runs into a single distribution. */
  aggregate(results: SimulationResult[]): OutcomeProbability;
}
