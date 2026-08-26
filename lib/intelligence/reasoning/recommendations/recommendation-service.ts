import type {
  Recommendation,
  RecommendationService,
  ReasoningInput,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubRecommendationService implements RecommendationService {
  async recommend(_input: ReasoningInput): Promise<Recommendation[]> {
    return notImplemented("RecommendationService.recommend");
  }
}

export function createStubRecommendationService(): RecommendationService {
  return new StubRecommendationService();
}
