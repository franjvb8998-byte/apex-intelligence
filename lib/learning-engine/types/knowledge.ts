import type { LearningId } from "@/lib/learning-engine/types/case";

/**
 * Reusable statistical discovery stored by the Knowledge Accumulator.
 */
export type KnowledgeDiscoveryKind =
  | "bias"
  | "pattern"
  | "calibration"
  | "feature_insight"
  | "market_edge"
  | "recommendation_outcome";

export type KnowledgeDiscovery = {
  id: LearningId;
  kind: KnowledgeDiscoveryKind;
  title: string;
  summary: string;
  /** Structured payload for future model/feature consumers. */
  payload: Record<string, string | number | boolean | null>;
  confidence: number;
  evidenceCaseIds: LearningId[];
  modelVersions: string[];
  createdAt: string;
  updatedAt: string;
  /** Soft tags for retrieval. */
  tags: string[];
};
