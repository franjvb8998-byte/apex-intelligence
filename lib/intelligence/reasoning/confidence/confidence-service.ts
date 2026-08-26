import type {
  ConfidenceScore,
  ConfidenceService,
  ReasoningInput,
  ReasoningOutput,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubConfidenceService implements ConfidenceService {
  async score(
    _input: ReasoningInput,
    _draft: Partial<ReasoningOutput>,
  ): Promise<ConfidenceScore> {
    return notImplemented("ConfidenceService.score");
  }
}

export function createStubConfidenceService(): ConfidenceService {
  return new StubConfidenceService();
}
