import type { ReasoningLlmAdapter } from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

/**
 * Stub LLM adapter — OpenAI (or other) wiring is intentionally out of scope.
 */
export class StubReasoningLlmAdapter implements ReasoningLlmAdapter {
  async complete(_prompt: string): Promise<string> {
    return notImplemented("ReasoningLlmAdapter.complete");
  }
}

export function createStubReasoningLlmAdapter(): ReasoningLlmAdapter {
  return new StubReasoningLlmAdapter();
}
