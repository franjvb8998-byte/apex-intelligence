import type {
  ReasoningInput,
  ReasoningOutput,
  ReasoningService,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

/**
 * Orchestrator stub for the Reasoning Layer.
 * Will compose explainability, confidence, recommendations, value-bet, reports.
 */
export class StubReasoningService implements ReasoningService {
  async reason(_input: ReasoningInput): Promise<ReasoningOutput> {
    return notImplemented("ReasoningService.reason");
  }
}

export function createStubReasoningService(): ReasoningService {
  return new StubReasoningService();
}
