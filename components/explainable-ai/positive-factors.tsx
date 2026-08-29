"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type { ExplainableFactor } from "@/lib/explainable-ai/types";

type PositiveFactorsProps = {
  factors: ExplainableFactor[];
};

export function PositiveFactors({ factors }: PositiveFactorsProps) {
  const t = useTranslations("matchCenter");
  return (
    <Card padding="sm">
      <CardHeader
        className="mb-3"
        title={t("positiveFactors")}
        description={t("positiveFactorsDescription")}
      />
      <ul className="space-y-3">
        {factors.map((factor) => (
          <li key={factor.id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--apex-fg)]">
                {factor.label}
              </p>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--apex-accent)]">
                {Math.round(factor.weight * 100)}%
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--apex-fg-muted)]">
              {factor.detail}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
