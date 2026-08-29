import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { ExplainablePredictionPanel } from "@/components/explainable-ai";
import { LabPanel } from "@/components/lab/lab-panel";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";

export async function ExplainabilityViewerCard({
  explainable,
  matchLabel,
  href,
}: {
  explainable: ExplainablePrediction | null;
  matchLabel: string | null;
  href: string;
}) {
  const t = await getTranslations("lab");
  if (!explainable) {
    return (
      <LabPanel
        id="explain"
        eyebrow={t("xai")}
        title={t("explainability")}
        status="empty"
        emptyTitle={t("noFeaturedExplanation")}
        emptyDescription={t("noFeaturedExplanationDescription")}
        footerHref="/match-analysis"
        footerLabel={t("openMatchAnalysis")}
      />
    );
  }

  return (
    <LabPanel
      id="explain"
      eyebrow={t("xai")}
      title={t("explainability")}
      badge={<Badge tone="info">rules · v1</Badge>}
      kpis={[
        {
          label: "Quality",
          value: String(Math.round(explainable.qualityScore.value)),
          tone: "info",
        },
        { label: "Band", value: explainable.qualityScore.band },
        { label: "+", value: String(explainable.positiveFactors.length), tone: "accent" },
        { label: "−", value: String(explainable.negativeFactors.length), tone: "danger" },
      ]}
      footerHref={href}
      footerLabel={matchLabel ? t("openNamed", { name: matchLabel }) : t("openMatch")}
    >
      <ExplainablePredictionPanel data={explainable} compact />
    </LabPanel>
  );
}
