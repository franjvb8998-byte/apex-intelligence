import type {
  EvaluationReportRepository,
  KnowledgeAccumulator,
  KnowledgeStore,
} from "@/lib/learning-engine/contracts";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";

/**
 * Knowledge Accumulator — turns evaluation signals into reusable discoveries.
 * Persist via KnowledgeStore (in-memory mock today).
 */
export class DefaultKnowledgeAccumulator implements KnowledgeAccumulator {
  constructor(
    private readonly store: KnowledgeStore,
    private readonly reports?: EvaluationReportRepository,
  ) {}

  async ingestEvaluation(
    report: EvaluationReport,
  ): Promise<KnowledgeDiscovery[]> {
    if (this.reports) {
      await this.reports.save(report);
    }

    const created: KnowledgeDiscovery[] = [];
    const now = report.evaluatedAt;
    const caseIds: string[] = []; // cases not embedded in report; optional later

    for (const bias of report.biases) {
      created.push(
        await this.store.upsert({
          id: `knowledge:bias:${bias.kind}:${report.modelVersion}`,
          kind: "bias",
          title: bias.label,
          summary: bias.evidence.join(" · "),
          payload: {
            biasKind: bias.kind,
            severity: bias.severity,
            score: bias.score,
            ece: report.calibration.ece,
            accuracy: report.accuracy.outcome,
          },
          confidence: clamp01(0.45 + bias.score * 0.5),
          evidenceCaseIds: caseIds,
          modelVersions: [report.modelVersion],
          createdAt: now,
          updatedAt: now,
          tags: ["bias", bias.kind, bias.severity],
        }),
      );
    }

    for (const pattern of report.patterns) {
      created.push(
        await this.store.upsert({
          id: `knowledge:pattern:${pattern.id}`,
          kind: "pattern",
          title: pattern.label,
          summary: pattern.description,
          payload: {
            frequency: pattern.frequency,
            confidence: pattern.confidence,
            matchCount: pattern.matchIds.length,
          },
          confidence: pattern.confidence,
          evidenceCaseIds: pattern.matchIds,
          modelVersions: [report.modelVersion],
          createdAt: now,
          updatedAt: now,
          tags: ["pattern", pattern.id],
        }),
      );
    }

    created.push(
      await this.store.upsert({
        id: `knowledge:calibration:${report.modelVersion}`,
        kind: "calibration",
        title: "Estado de calibración",
        summary: `ECE=${report.calibration.ece.toFixed(3)} · accuracy=${(report.accuracy.outcome * 100).toFixed(1)}% · n=${report.sampleSize}`,
        payload: {
          ece: report.calibration.ece,
          accuracy: report.accuracy.outcome,
          meanBrier: report.aggregateError.meanBrier,
          sampleSize: report.sampleSize,
        },
        confidence: report.sampleSize >= 5 ? 0.7 : 0.4,
        evidenceCaseIds: caseIds,
        modelVersions: [report.modelVersion],
        createdAt: now,
        updatedAt: now,
        tags: ["calibration", report.modelVersion],
      }),
    );

    for (const recommendation of report.recommendations) {
      created.push(
        await this.store.upsert({
          id: `knowledge:rec:${recommendation.id}:${report.modelVersion}`,
          kind: "recommendation_outcome",
          title: recommendation.title,
          summary: `${recommendation.detail} → ${recommendation.suggestedAction}`,
          payload: {
            priority: recommendation.priority,
            area: recommendation.area,
          },
          confidence:
            recommendation.priority === "high"
              ? 0.75
              : recommendation.priority === "medium"
                ? 0.6
                : 0.45,
          evidenceCaseIds: caseIds,
          modelVersions: [report.modelVersion],
          createdAt: now,
          updatedAt: now,
          tags: ["recommendation", recommendation.area, recommendation.priority],
        }),
      );
    }

    return created;
  }

  async listDiscoveries(filter?: {
    kind?: KnowledgeDiscovery["kind"];
    tag?: string;
    minConfidence?: number;
  }): Promise<KnowledgeDiscovery[]> {
    return this.store.list(filter);
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function createKnowledgeAccumulator(
  store: KnowledgeStore,
  reports?: EvaluationReportRepository,
): KnowledgeAccumulator {
  return new DefaultKnowledgeAccumulator(store, reports);
}
