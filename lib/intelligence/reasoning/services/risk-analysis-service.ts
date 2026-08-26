import type {
  Recommendation,
  RiskAnalysis,
  RiskAnalysisService,
  ReasoningInput,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubRiskAnalysisService implements RiskAnalysisService {
  async analyze(
    _input: ReasoningInput,
    _recommendations: Recommendation[],
  ): Promise<RiskAnalysis> {
    return notImplemented("RiskAnalysisService.analyze");
  }
}

export function createStubRiskAnalysisService(): RiskAnalysisService {
  return new StubRiskAnalysisService();
}
