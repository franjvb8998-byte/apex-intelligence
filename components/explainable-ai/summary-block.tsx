"use client";

import { useTranslations } from "next-intl";
import { Badge, Card, CardHeader } from "@/components/design-system";

type SummaryBlockProps = {
  summary: string;
  predictedLabel: string;
  method?: "rules";
};

export function SummaryBlock({
  summary,
  predictedLabel,
  method = "rules",
}: SummaryBlockProps) {
  const t = useTranslations("matchCenter");
  return (
    <Card>
      <CardHeader
        title={t("summaryExplanation")}
        description={predictedLabel}
        action={<Badge tone="info">Explainable AI · {method}</Badge>}
      />
      <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {summary}
      </p>
    </Card>
  );
}
