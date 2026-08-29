"use client";

import { Badge, Card, CardHeader, ConfidenceIndicator } from "@/components/design-system";
import { useTranslations } from "next-intl";
import { toPercent } from "@/components/design-system/utils";
import type { CopilotPredictionCardData } from "@/lib/copilot";

type PredictionCardProps = {
  data: CopilotPredictionCardData;
};

export function PredictionCard({ data }: PredictionCardProps) {
  const t = useTranslations("copilot");
  const common = useTranslations("common");
  return (
    <Card padding="sm" className="mt-3 border-[var(--apex-border-strong)] bg-[var(--apex-surface-muted)]/50">
      <CardHeader
        className="mb-3"
        title={t("prediction")}
        description={data.matchLabel}
        action={<Badge tone="accent">{data.outcome}</Badge>}
      />
      <ConfidenceIndicator
        value={data.confidence}
        band={
          data.confidence >= 0.75
            ? "high"
            : data.confidence >= 0.45
              ? "medium"
              : "low"
        }
        className="mb-4"
      />
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-[var(--apex-fg-subtle)]">{common("home")}</dt>
          <dd className="mt-1 font-semibold text-[var(--apex-fg)]">
            {toPercent(data.oneXTwo.home)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--apex-fg-subtle)]">{common("draw")}</dt>
          <dd className="mt-1 font-semibold text-[var(--apex-fg)]">
            {toPercent(data.oneXTwo.draw)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--apex-fg-subtle)]">{common("away")}</dt>
          <dd className="mt-1 font-semibold text-[var(--apex-fg)]">
            {toPercent(data.oneXTwo.away)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[var(--apex-accent)]">{data.valueNote}</p>
    </Card>
  );
}
