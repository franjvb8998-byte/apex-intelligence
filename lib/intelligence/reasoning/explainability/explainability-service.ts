import type {
  ExplainabilityService,
  ReasoningInput,
  ReasoningOutput,
  Explanation,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubExplainabilityService implements ExplainabilityService {
  async explain(
    _input: ReasoningInput,
    _draft: Partial<ReasoningOutput>,
  ): Promise<Explanation> {
    return notImplemented("ExplainabilityService.explain");
  }
}

export function createStubExplainabilityService(): ExplainabilityService {
  return new StubExplainabilityService();
}
