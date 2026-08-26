import type {
  PromptCatalog,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

/**
 * Prompt template ids reserved for future LLM reasoning.
 * Bodies are placeholders — no model calls.
 */
export const REASONING_PROMPT_IDS = {
  matchNarrative: "reasoning.match.narrative",
  recommendationBrief: "reasoning.recommendation.brief",
  riskSummary: "reasoning.risk.summary",
  valueBetRationale: "reasoning.value.rationale",
  reportExecutive: "reasoning.report.executive",
} as const;

export type ReasoningPromptId =
  (typeof REASONING_PROMPT_IDS)[keyof typeof REASONING_PROMPT_IDS];

export class StubPromptCatalog implements PromptCatalog {
  get(_templateId: string, _variables?: Record<string, string>): string {
    return notImplemented("PromptCatalog.get");
  }
}

export function createStubPromptCatalog(): PromptCatalog {
  return new StubPromptCatalog();
}
