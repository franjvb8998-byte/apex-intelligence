"use client";

import { useTranslations } from "next-intl";
import { Card, ScoreGauge } from "@/components/design-system";
import type { PortfolioHealth } from "@/lib/portfolio/types";

export function PortfolioHealthCard({ health }: { health: PortfolioHealth }) {
  const t = useTranslations("portfolio");
  const bandHint = {
    Excellent: t("healthExcellent"),
    Good: t("healthGood"),
    Average: t("healthAverage"),
    Risky: t("healthRisky"),
    Critical: t("healthCritical"),
  } as const;

  return (
    <Card className="flex flex-col items-center justify-center bg-[#070b14] sm:flex-row sm:items-center sm:gap-8">
      <ScoreGauge
        value={health.score}
        label={t("healthLabel")}
        caption={health.band}
        size="lg"
      />
      <div className="mt-4 max-w-sm text-center sm:mt-0 sm:text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
          {t("healthScoreTitle")}
        </p>
        <p className="mt-2 text-sm text-[var(--apex-fg-muted)]">
          {bandHint[health.band]}
        </p>
        <p className="mt-3 font-mono text-xs tabular-nums text-[var(--apex-fg-subtle)]">
          {health.score} / 100 · {health.band}
        </p>
      </div>
    </Card>
  );
}
