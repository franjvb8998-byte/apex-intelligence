"use client";

import { Card } from "@/components/design-system";
import { formatOdds, formatPct } from "@/lib/bankroll/format";
import { useMoneyFormatter } from "@/lib/bankroll/use-money-formatter";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type { BankrollMetrics } from "@/lib/bankroll/types";

function toneForSigned(value: number): "success" | "danger" | "neutral" {
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

type BankrollKpiGridProps = {
  metrics: BankrollMetrics;
  currency: BankrollCurrency;
};

export function BankrollKpiGrid({ metrics, currency }: BankrollKpiGridProps) {
  const { money, signed } = useMoneyFormatter(currency);
  const items: Kpi[] = [
    {
      id: "current",
      label: "Bankroll actual",
      value: money(metrics.currentBankroll),
      tone: "accent",
    },
    {
      id: "initial",
      label: "Bankroll inicial",
      value: money(metrics.initialBankroll),
    },
    {
      id: "today",
      label: "P/L de hoy",
      value: signed(metrics.todayProfit),
      tone: toneForSigned(metrics.todayProfit),
    },
    {
      id: "profit",
      label: "Beneficio total",
      value: signed(metrics.totalProfit),
      tone: toneForSigned(metrics.totalProfit),
    },
    {
      id: "roi",
      label: "ROI",
      value: formatPct(metrics.roi),
      hint: "Beneficio neto / stake arriesgado",
      tone: toneForSigned(metrics.totalProfit),
    },
    {
      id: "yield",
      label: "Yield",
      value: formatPct(metrics.yield),
      hint: "Misma fórmula que ROI (stake liquidado)",
      tone: toneForSigned(metrics.totalProfit),
    },
    {
      id: "winrate",
      label: "Win rate",
      value: formatPct(metrics.winRate, 0),
    },
    {
      id: "odds",
      label: "Cuota media",
      value: formatOdds(metrics.averageOdds),
    },
    {
      id: "count",
      label: "Nº de apuestas",
      value: String(metrics.betCount),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.id} padding="sm">
          <p className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {item.label}
          </p>
          <p
            className={`mt-2 font-mono text-2xl tabular-nums ${
              item.tone === "success"
                ? "text-[var(--apex-accent)]"
                : item.tone === "danger"
                  ? "text-[var(--apex-danger)]"
                  : "text-[var(--apex-fg)]"
            }`}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-1 text-[11px] text-[var(--apex-fg-subtle)]">
              {item.hint}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
