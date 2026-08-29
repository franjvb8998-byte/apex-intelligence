import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { LabCalibrationChart } from "@/components/lab/lab-charts";
import { LabPanel } from "@/components/lab/lab-panel";
import { formatPctPoints } from "@/lib/lab/format";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";

function severityTone(value: "low" | "medium" | "high") {
  if (value === "high") return "danger" as const;
  if (value === "medium") return "warning" as const;
  return "info" as const;
}

export async function PerformanceReportsCard({
  report,
  knowledge,
}: {
  report: EvaluationReport;
  knowledge: KnowledgeDiscovery[];
}) {
  const t = await getTranslations("lab");
  const markets = Object.entries(report.accuracy.markets);

  return (
    <LabPanel
      id="reports"
      eyebrow={t("evaluator")}
      title={t("reports")}
      badge={<Badge tone="info">{report.modelVersion}</Badge>}
      kpis={[
        { label: "N", value: String(report.sampleSize), tone: "info" },
        {
          label: "1X2",
          value: formatPctPoints(report.accuracy.outcome, 0),
          tone: report.accuracy.outcome >= 0.5 ? "accent" : "warning",
        },
        { label: "ECE", value: report.calibration.ece.toFixed(3) },
        { label: "Brier", value: report.aggregateError.meanBrier.toFixed(3) },
        { label: "Bias", value: String(report.biases.length) },
        { label: "Know", value: String(knowledge.length) },
      ]}
      status={report.sampleSize === 0 ? "empty" : "ready"}
      emptyTitle={t("noEvaluation")}
      emptyDescription={t("noEvaluationDescription")}
      footerHref="/lab#backtest"
      footerLabel={t("openBacktestMarks")}
    >
      <p className="mb-3 text-[11px] text-[var(--apex-fg-muted)]">
        DefaultLearningEvaluator on the mock closed book. Does not call the
        Probability Engine or Decision Engine.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
            Reliability
          </p>
          <LabCalibrationChart bins={report.calibration.bins} />
          <ul className="mt-3 space-y-1">
            {markets.map(([market, stats]) => (
              <li
                key={market}
                className="flex justify-between font-mono text-[11px] text-[var(--apex-fg-muted)]"
              >
                <span>{market}</span>
                <span>
                  {formatPctPoints(stats.hitRate, 0)} · n={stats.support}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
              Recommendations
            </p>
            {report.recommendations.length === 0 ? (
              <p className="text-sm text-[var(--apex-fg-muted)]">None.</p>
            ) : (
              <ul className="space-y-2">
                {report.recommendations.slice(0, 4).map((item) => (
                  <li key={item.id} className="text-[12px] leading-snug">
                    <Badge tone={severityTone(item.priority)}>{item.area}</Badge>
                    <span className="ml-2 text-[var(--apex-fg)]">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--apex-fg-muted)]">
                      {item.suggestedAction}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
              Knowledge
            </p>
            {knowledge.length === 0 ? (
              <p className="text-sm text-[var(--apex-fg-muted)]">
                Accumulator is empty.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {knowledge.slice(0, 5).map((item) => (
                  <li key={item.id} className="text-[12px] text-[var(--apex-fg-muted)]">
                    <span className="font-mono text-[10px] text-[var(--apex-accent)]">
                      {item.kind}
                    </span>
                    {" · "}
                    {item.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </LabPanel>
  );
}
