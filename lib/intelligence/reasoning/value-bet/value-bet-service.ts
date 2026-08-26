import type {
  ReasoningInput,
  ValueBetService,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubValueBetService implements ValueBetService {
  async findOpportunities(_input: ReasoningInput): Promise<ValueOpportunity[]> {
    return notImplemented("ValueBetService.findOpportunities");
  }
}

export function createStubValueBetService(): ValueBetService {
  return new StubValueBetService();
}
