"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import { formatMoney } from "@/lib/bankroll/currency";
import { formatPct } from "@/lib/bankroll/format";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type { ExposureSlice } from "@/lib/portfolio/types";

function ExposureBars({
  title,
  description,
  slices,
  currency,
}: {
  title: string;
  description: string;
  slices: ExposureSlice[];
  currency: BankrollCurrency;
}) {
  const t = useTranslations("portfolio");
  const peak = Math.max(...slices.map((slice) => slice.stake), 1);
  return (
    <Card className="bg-[#070b14]">
      <CardHeader title={title} description={description} />
      {slices.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("noStake")}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={title}>
          {slices.map((slice) => {
            const width = Math.max(6, (slice.stake / peak) * 100);
            return (
              <li key={slice.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-[var(--apex-fg-muted)]">
                    {slice.label}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--apex-fg)]">
                    {formatMoney(slice.stake, currency)} · {formatPct(slice.share, 0)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
                  <div
                    className="h-full rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function PortfolioExposureCharts({
  byLeague,
  byMarket,
  byTeam,
  byCompetition,
  currency,
}: {
  byLeague: ExposureSlice[];
  byMarket: ExposureSlice[];
  byTeam: ExposureSlice[];
  byCompetition: ExposureSlice[];
  currency: BankrollCurrency;
}) {
  const t = useTranslations("portfolio");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ExposureBars
        title={t("exposureLeague")}
        description={t("exposureLeagueDescription")}
        slices={byLeague}
        currency={currency}
      />
      <ExposureBars
        title={t("exposureMarket")}
        description={t("exposureMarketDescription")}
        slices={byMarket}
        currency={currency}
      />
      <ExposureBars
        title={t("exposureTeam")}
        description={t("exposureTeamDescription")}
        slices={byTeam}
        currency={currency}
      />
      <ExposureBars
        title={t("exposureCompetition")}
        description={t("exposureCompetitionDescription")}
        slices={byCompetition}
        currency={currency}
      />
    </div>
  );
}
