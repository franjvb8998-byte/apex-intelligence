import type { IntelligenceCore } from "@/lib/intelligence/engine";
import type {
  PredictionPipelineInput,
  PredictionPipelineResult,
  UUID,
} from "@/lib/intelligence/types";

/**
 * API-facing façade for the Intelligence Core.
 * Future Route Handlers / jobs should call this layer — not modules directly —
 * so request validation and auth stay at the HTTP boundary.
 */
export type IntelligenceApi = {
  predictMatch(
    input: PredictionPipelineInput,
  ): Promise<PredictionPipelineResult>;
  predictBatch(matchIds: UUID[]): Promise<PredictionPipelineResult[]>;
};

export function createIntelligenceApi(core: IntelligenceCore): IntelligenceApi {
  return {
    predictMatch(input) {
      return core.engine.run(input);
    },
    predictBatch(matchIds) {
      return core.engine.runBatch(matchIds);
    },
  };
}

/**
 * Suggested future HTTP surface (not registered yet):
 *
 * POST /api/intelligence/predict          { matchId, options }
 * POST /api/intelligence/predict/batch    { matchIds }
 * GET  /api/intelligence/predictions/:matchId
 * POST /api/intelligence/live/events      { matchId, event }
 * POST /api/intelligence/learning/close   { matchId }
 */
