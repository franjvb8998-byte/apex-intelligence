"use client";

import { Card } from "@/components/design-system";
import { useTranslations } from "next-intl";
import { formatKelly, formatSignedPct } from "@/components/apex-opportunities/format";
import type { DiscoveryDashboardStats } from "@/lib/apex-opportunities/discovery";

export function DiscoverySummary({ stats }: { stats: DiscoveryDashboardStats }) {
  const t = useTranslations("opportunities");
  const cards: Array<{
    key: keyof DiscoveryDashboardStats;
    label: string;
    format: (stats: DiscoveryDashboardStats) => string;
  }> = [
    {
      key: "today",
      label: t("today"),
      format: (s) => String(s.today),
    },
    {
      key: "elite",
      label: t("elite"),
      format: (s) => String(s.elite),
    },
    {
      key: "averageConfidence",
      label: t("avgConfidence"),
      format: (s) =>
        s.averageConfidence == null ? "n/d" : String(Math.round(s.averageConfidence)),
    },
    {
      key: "averageEv",
      label: t("avgEv"),
      format: (s) => formatSignedPct(s.averageEv),
    },
    {
      key: "highestKelly",
      label: t("highestKelly"),
      format: (s) => formatKelly(s.highestKelly),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.key} padding="sm" className="bg-[#070b14]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--apex-fg-subtle)]">
            {card.label}
          </p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-[var(--apex-fg)]">
            {card.format(stats)}
          </p>
        </Card>
      ))}
    </div>
  );
}
