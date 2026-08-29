"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { PortfolioInsight } from "@/lib/portfolio/types";

const TONE_CLASS: Record<PortfolioInsight["tone"], string> = {
  danger: "border-red-500/40 bg-red-500/[0.08] text-[var(--apex-danger)]",
  warning: "border-amber-500/40 bg-amber-500/[0.08] text-[var(--apex-warning)]",
  info: "border-sky-500/40 bg-sky-500/[0.08] text-[var(--apex-info)]",
  success: "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]",
};

export function PortfolioInsights({ insights }: { insights: PortfolioInsight[] }) {
  const t = useTranslations("portfolio");
  return (
    <Card className="bg-[#070b14]">
      <CardHeader
        title={t("insights")}
        description={t("insightsDescription")}
      />
      {insights.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("insightsEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className={cx(
                "rounded-[var(--apex-radius-lg)] border px-3 py-2.5 text-sm",
                TONE_CLASS[insight.tone],
              )}
            >
              {insight.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
