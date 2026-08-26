import { Badge } from "@/components/design-system";
import { ConfidenceBlock } from "@/components/explainable-ai/confidence-block";
import { EvidenceList } from "@/components/explainable-ai/evidence-list";
import { NegativeFactors } from "@/components/explainable-ai/negative-factors";
import { PositiveFactors } from "@/components/explainable-ai/positive-factors";
import { QualityScore } from "@/components/explainable-ai/quality-score";
import { SummaryBlock } from "@/components/explainable-ai/summary-block";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

type ExplainablePredictionPanelProps = {
  data: ExplainablePrediction;
  /** Compact layout for Copilot cards. */
  compact?: boolean;
};

/**
 * Sprint 10 — composed Explainable AI panel (rules only, no OpenAI).
 */
export function ExplainablePredictionPanel({
  data,
  compact = false,
}: ExplainablePredictionPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">Explainable AI</Badge>
        <Badge>rules · v1</Badge>
        <Badge tone="info">{data.predictedLabel}</Badge>
      </div>

      <SummaryBlock
        summary={data.summary}
        predictedLabel={data.predictedLabel}
        method={data.method}
      />

      <div
        className={
          compact
            ? "grid gap-4 sm:grid-cols-2"
            : "grid gap-6 lg:grid-cols-5"
        }
      >
        <div
          className={
            compact ? "space-y-4 sm:col-span-2" : "space-y-6 lg:col-span-3"
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <PositiveFactors factors={data.positiveFactors} />
            <NegativeFactors factors={data.negativeFactors} />
          </div>
          {!compact && <EvidenceList evidence={data.evidence} />}
        </div>

        <div
          className={
            compact ? "space-y-4 sm:col-span-2" : "space-y-6 lg:col-span-2"
          }
        >
          <ConfidenceBlock confidence={data.confidence} />
          <QualityScore quality={data.qualityScore} />
          {compact && (
            <EvidenceList evidence={data.evidence.slice(0, 5)} />
          )}
        </div>
      </div>
    </div>
  );
}
