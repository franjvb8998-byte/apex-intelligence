"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import { formatMoney, formatSignedMoney } from "@/lib/bankroll/currency";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type {
  BankrollBet,
  BankrollSnapshot,
  MonthlyProfit,
} from "@/lib/bankroll/types";

function chartBounds(values: number[]): { min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

type BankrollChartsProps = {
  evolution: BankrollSnapshot[];
  monthlyProfit: MonthlyProfit[];
  bets: BankrollBet[];
  currency: BankrollCurrency;
};

export function BankrollCharts({
  evolution,
  monthlyProfit,
  bets,
  currency,
}: BankrollChartsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <BankrollEvolutionChart points={evolution} currency={currency} />
      <MonthlyProfitChart months={monthlyProfit} currency={currency} />
      <WinLossHistoryChart bets={bets} currency={currency} />
    </div>
  );
}

function BankrollEvolutionChart({
  points,
  currency,
}: {
  points: BankrollSnapshot[];
  currency: BankrollCurrency;
}) {
  const values = points.map((point) => point.balance);
  const { min, max } = chartBounds(values);
  const width = 320;
  const height = 140;
  const coords = points.map((point, index) => {
    const x =
      points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.balance - min) / (max - min)) * height;
    return { x, y, ...point };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area =
    coords.length > 0
      ? `${line} L ${coords[coords.length - 1]!.x} ${height} L ${coords[0]!.x} ${height} Z`
      : "";

  const t = useTranslations("bankroll");
  return (
    <Card>
      <CardHeader
        title={t("evolutionTitle")}
        description={t("evolutionDescription")}
      />
      {points.length < 2 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("evolutionEmpty")}
        </p>
      ) : (
        <div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-36 w-full"
            role="img"
            aria-label={t("evolutionAria")}
          >
            <path
              d={area}
              fill="var(--apex-accent)"
              fillOpacity="0.12"
            />
            <path
              d={line}
              fill="none"
              stroke="var(--apex-accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-[var(--apex-fg-subtle)]">
            <span>{formatMoney(points[0]!.balance, currency)}</span>
            <span>{formatMoney(points[points.length - 1]!.balance, currency)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function MonthlyProfitChart({
  months,
  currency,
}: {
  months: MonthlyProfit[];
  currency: BankrollCurrency;
}) {
  const t = useTranslations("bankroll");
  const peak = Math.max(
    ...months.map((month) => Math.abs(month.profit)),
    1,
  );
  return (
    <Card>
      <CardHeader
        title={t("monthlyTitle")}
        description={t("monthlyDescription")}
      />
      {months.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("monthlyEmpty")}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={t("monthlyTitle")}>
          {months.map((month) => {
            const width = Math.max(6, (Math.abs(month.profit) / peak) * 100);
            const positive = month.profit >= 0;
            return (
              <li key={month.month}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs capitalize text-[var(--apex-fg-muted)]">
                    {month.label}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      positive
                        ? "text-[var(--apex-accent)]"
                        : "text-[var(--apex-danger)]"
                    }`}
                  >
                    {formatSignedMoney(month.profit, currency)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
                  <div
                    className={`h-full rounded-[var(--apex-radius-full)] ${
                      positive
                        ? "bg-[var(--apex-accent)]"
                        : "bg-[var(--apex-danger)]"
                    }`}
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

function WinLossHistoryChart({
  bets,
  currency,
}: {
  bets: BankrollBet[];
  currency: BankrollCurrency;
}) {
  const t = useTranslations("bankroll");
  const settled = [...bets]
    .filter((bet) => bet.result === "won" || bet.result === "lost")
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  const peak = Math.max(
    ...settled.map((bet) => Math.abs(bet.profit ?? 0)),
    1,
  );
  const wins = settled.filter((bet) => bet.result === "won").length;
  const losses = settled.length - wins;

  return (
    <Card>
      <CardHeader
        title={t("winLossTitle")}
        description={
          settled.length > 0
            ? t("winLossSettled", { wins, losses })
            : t("winLossDescription")
        }
      />
      {settled.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("winLossEmpty")}
        </p>
      ) : (
        <div
          className="flex h-36 items-end gap-1"
          role="img"
          aria-label={t("winLossAria")}
        >
          {settled.map((bet) => {
            const magnitude = Math.abs(bet.profit ?? 0);
            const height = Math.max(12, (magnitude / peak) * 100);
            const won = bet.result === "won";
            return (
              <div
                key={bet.id}
                title={`${bet.match} · ${formatSignedMoney(bet.profit ?? 0, currency)}`}
                className={`min-w-0 flex-1 rounded-t-[var(--apex-radius-sm)] ${
                  won
                    ? "bg-[var(--apex-accent)]"
                    : "bg-[var(--apex-danger)]"
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
