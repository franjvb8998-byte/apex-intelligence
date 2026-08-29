"use client";

import { Card } from "@/components/design-system";
import { useTranslations } from "next-intl";
import { formatPct } from "@/lib/bankroll/format";
import { useMoneyFormatter } from "@/lib/bankroll/use-money-formatter";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type { PortfolioKpis } from "@/lib/portfolio/types";

function toneForSigned(value: number | null): "success" | "danger" | "neutral" {
  if (value == null) return "neutral";
  if (value > 0) return "success";
  if (value < 0) return "danger";
  return "neutral";
}

type Kpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger" | "neutral" | "accent";
};

export function PortfolioKpiGrid({
  kpis,
  currency,
}: {
  kpis: PortfolioKpis;
  currency: BankrollCurrency;
}) {
  const t = useTranslations("portfolio");
  const { money } = useMoneyFormatter(currency);
  const items: Kpi[] = [
    {
      id: "bankroll",
      label: t("kpiCurrent"),
      value: money(kpis.currentBankroll),
      tone: "accent",
    },
    {
      id: "exposure",
      label: t("kpiExposure"),
      value: money(kpis.activeExposure),
      hint:
        kpis.exposureRatio == null
          ? t("kpiExposureHint")
          : t("ofBankroll", { pct: formatPct(kpis.exposureRatio) }),
    },
    {
      id: "ev",
      label: t("kpiEv"),
      value: formatPct(kpis.expectedValue),
      hint:
        kpis.expectedValueMoney == null
          ? t("kpiEvEmpty")
          : t("onOpenBook", { amount: money(kpis.expectedValueMoney) }),
      tone: toneForSigned(kpis.expectedValue),
    },
    {
      id: "roi",
      label: t("expectedRoi"),
      value: formatPct(kpis.expectedRoi),
      hint: t("kpiRoiHint"),
      tone: toneForSigned(kpis.expectedRoi),
    },
    {
      id: "yield",
      label: t("expectedYield"),
      value: formatPct(kpis.expectedYield),
      hint: t("kpiYieldHint"),
      tone: toneForSigned(kpis.expectedYield),
    },
    {
      id: "kelly",
      label: t("kpiKelly"),
      value: formatPct(kpis.kellyAllocation),
      hint:
        kpis.kellyRecommended == null
          ? t("kpiKellyHint")
          : t("kellyBookHint", {
              book: formatPct(kpis.kellyAllocation),
              kelly: formatPct(kpis.kellyRecommended),
            }),
    },
    {
      id: "div",
      label: t("kpiDiversification"),
      value: String(kpis.diversificationScore),
      hint: t("divHint"),
    },
    {
      id: "risk",
      label: t("kpiRisk"),
      value: String(kpis.riskScore),
      hint: t("kpiRiskHint"),
      tone: kpis.riskScore >= 70 ? "danger" : kpis.riskScore >= 45 ? "neutral" : "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.id} padding="sm" className="bg-[#070b14]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--apex-fg-subtle)]">
            {item.label}
          </p>
          <p
            className={`mt-2 font-mono text-2xl tabular-nums ${
              item.tone === "success"
                ? "text-[var(--apex-accent)]"
                : item.tone === "danger"
                  ? "text-[var(--apex-danger)]"
                  : item.tone === "accent"
                    ? "text-[var(--apex-accent)]"
                    : "text-[var(--apex-fg)]"
            }`}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1 text-[11px] text-[var(--apex-fg-subtle)]">{item.hint}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
