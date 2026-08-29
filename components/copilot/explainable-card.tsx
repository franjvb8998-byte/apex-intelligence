"use client";

import { ExplainablePredictionPanel } from "@/components/explainable-ai";
import { Badge, Card, CardHeader } from "@/components/design-system";
import { useTranslations } from "next-intl";
import type { CopilotExplainableCardData } from "@/lib/copilot";

type ExplainableCardProps = {
  data: CopilotExplainableCardData;
};

export function ExplainableCard({ data }: ExplainableCardProps) {
  const t = useTranslations("copilot");
  return (
    <Card
      padding="sm"
      className="mt-3 border-[var(--apex-accent-border)] bg-[var(--apex-surface-muted)]/50"
    >
      <CardHeader
        className="mb-3"
        title={t("explainable")}
        description={data.matchLabel}
        action={<Badge tone="info">rules</Badge>}
      />
      <ExplainablePredictionPanel data={data.explainable} compact />
    </Card>
  );
}
