"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { PortfolioExposureCharts } from "@/components/portfolio/exposure-charts";
import { PortfolioHealthCard } from "@/components/portfolio/health-card";
import { PortfolioInsights } from "@/components/portfolio/insights-card";
import { PortfolioKpiGrid } from "@/components/portfolio/kpi-grid";
import { PortfolioRecommendations } from "@/components/portfolio/recommendations-card";
import { useBankrollSettings } from "@/lib/bankroll/use-bankroll-settings";
import { buildPortfolioReport } from "@/lib/portfolio/build";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { BankrollData, BankrollFixture } from "@/lib/bankroll/types";

type PortfolioViewProps = {
  data: BankrollData;
  fixtures: BankrollFixture[];
  analyzed?: ApexOpportunity[];
};

export function PortfolioView({
  data,
  fixtures,
  analyzed = [],
}: PortfolioViewProps) {
  const t = useTranslations("portfolio");
  const reduceMotion = useReducedMotion();
  const { settings } = useBankrollSettings();
  const report = useMemo(
    () =>
      buildPortfolioReport(
        { ...data, currency: settings.currency },
        fixtures,
        analyzed,
      ),
    [analyzed, data, fixtures, settings.currency],
  );

  return (
    <div className="w-full space-y-6">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            {t("eyebrow")}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-sm text-[var(--apex-fg-muted)]">
            {t("description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/bankroll"
            className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-3 py-2 text-[11px] font-medium text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
          >
            {t("openBankroll")}
          </Link>
          <Link
            href="/opportunities"
            className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-3 py-2 text-[11px] font-medium text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
          >
            APEX Opportunities
          </Link>
        </div>
      </motion.header>

      <PortfolioKpiGrid kpis={report.kpis} currency={settings.currency} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <PortfolioHealthCard health={report.health} />
        <PortfolioInsights insights={report.insights} />
      </div>

      <PortfolioExposureCharts
        byLeague={report.byLeague}
        byMarket={report.byMarket}
        byTeam={report.byTeam}
        byCompetition={report.byCompetition}
        currency={settings.currency}
      />

      <PortfolioRecommendations items={report.recommendations} />
    </div>
  );
}
