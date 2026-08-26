export type {
  EvidenceSource,
  ExplainableFactor,
  ExplainablePrediction,
  ExplanationEvidence,
  ExplanationQualityScore,
} from "@/lib/explainable-ai/types";

export {
  explainPrediction,
  createExplainableAiEngine,
  type ExplainableAiInput,
} from "@/lib/explainable-ai/engine";

export {
  explainableFromMatchAnalysis,
  explainableInputFromAnalysisContext,
} from "@/lib/explainable-ai/from-match-analysis";

export { getMockExplainablePrediction } from "@/lib/explainable-ai/mock";
