"use client";

import { formatOdds } from "@/lib/bankroll/format";
import { useMoneyFormatter } from "@/lib/bankroll/use-money-formatter";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import { currencyLabel } from "@/lib/bankroll/currency";
import type { BetPreview } from "@/lib/bankroll/types";

type BetSummaryCardProps = {
  preview: BetPreview;
  market: string;
  currency: BankrollCurrency;
};

export function BetSummaryCard({
  preview,
  market,
  currency,
}: BetSummaryCardProps) {
  const { money, signed } = useMoneyFormatter(currency);

  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Stake",
      value: preview.stake == null ? "—" : money(preview.stake),
    },
    {
      label: "Cuota",
      value: formatOdds(preview.odds),
    },
    {
      label: "Retorno potencial",
      value:
        preview.potentialReturn == null ? "—" : money(preview.potentialReturn),
    },
    {
      label: "Beneficio potencial",
      value:
        preview.potentialProfit == null
          ? "—"
          : signed(preview.potentialProfit),
    },
    { label: "Mercado", value: market || "—" },
    { label: "Moneda", value: currencyLabel(currency) },
  ];

  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 p-3 sm:p-4">
      <p className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        Resumen de la apuesta
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
              {row.label}
            </dt>
            <dd className="mt-1 truncate font-mono text-sm tabular-nums text-[var(--apex-fg)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
