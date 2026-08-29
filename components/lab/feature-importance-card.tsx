import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { LabBarList } from "@/components/lab/lab-charts";
import { LabPanel } from "@/components/lab/lab-panel";
import type { LabFeatureSeries } from "@/lib/lab/types";

export async function FeatureImportanceCard({ series }: { series: LabFeatureSeries[] }) {
  const t = await getTranslations("lab");
  return (
    <LabPanel
      id="features"
      eyebrow={t("weightsEyebrow")}
      title={t("features")}
      badge={<Badge>Published</Badge>}
      kpis={[
        { label: "Series", value: String(series.length) },
        {
          label: "Live",
          value: series.some((item) => item.id === "live-components")
            ? "Yes"
            : "n/d",
          tone: series.some((item) => item.id === "live-components")
            ? "accent"
            : "neutral",
        },
      ]}
      status={series.length === 0 ? "empty" : "ready"}
      emptyTitle={t("noWeights")}
      emptyDescription={t("noWeightsDescription")}
      footerHref="/lab#decision"
      footerLabel={t("openDecisionBreakdown")}
    >
      <p className="mb-4 text-[11px] text-[var(--apex-fg-muted)]">
        Not SHAP. Bars are published Decision Engine / Match Rating weights, live
        pillar scores on the featured fixture, and mean |factor| mass from the
        Learning Engine sample.
      </p>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {series.map((item) => (
          <div key={item.id}>
            <p className="text-[12px] font-medium text-[var(--apex-fg)]">
              {item.title}
            </p>
            <p className="mb-3 mt-1 text-[11px] leading-snug text-[var(--apex-fg-subtle)]">
              {item.description}
            </p>
            <LabBarList bars={item.bars} />
          </div>
        ))}
      </div>
    </LabPanel>
  );
}
