"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type { PortfolioRecommendation } from "@/lib/portfolio/types";

export function PortfolioRecommendations({
  items,
}: {
  items: PortfolioRecommendation[];
}) {
  const t = useTranslations("portfolio");
  return (
    <Card className="bg-[#070b14]">
      <CardHeader
        title={t("recommendations")}
        description={t("recommendationsDescription")}
      />
      {items.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("recsEmpty")}
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <span className="font-mono text-xs tabular-nums text-[var(--apex-fg-subtle)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--apex-fg)]">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
