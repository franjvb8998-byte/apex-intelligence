"use client";

import { Badge, Card, CardHeader } from "@/components/design-system";
import { formatDate, formatOdds } from "@/lib/bankroll/format";
import { useMoneyFormatter } from "@/lib/bankroll/use-money-formatter";
import type { BankrollCurrency } from "@/lib/bankroll/currency";
import type { BankrollBet, BetResult } from "@/lib/bankroll/types";

const resultLabel: Record<BetResult, string> = {
  won: "Ganada",
  lost: "Perdida",
  void: "Nula",
  pending: "Pendiente",
};

const resultTone: Record<BetResult, "success" | "danger" | "neutral" | "warning"> = {
  won: "success",
  lost: "danger",
  void: "neutral",
  pending: "warning",
};

type BetHistoryTableProps = {
  bets: BankrollBet[];
  currency: BankrollCurrency;
};

export function BetHistoryTable({ bets, currency }: BetHistoryTableProps) {
  const { money, signed } = useMoneyFormatter(currency);
  return (
    <Card>
      <CardHeader
        title="Historial de apuestas"
        description="Ledger mock — las apuestas nuevas viven en esta sesión"
      />
      {bets.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Aún no hay apuestas. Usa Añadir apuesta para registrar la primera.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--apex-border)] text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                <th className="pb-2 pr-3 font-medium">Fecha</th>
                <th className="pb-2 pr-3 font-medium">Partido</th>
                <th className="pb-2 pr-3 font-medium">Mercado</th>
                <th className="pb-2 pr-3 font-medium">Cuota</th>
                <th className="pb-2 pr-3 font-medium">Stake</th>
                <th className="pb-2 pr-3 font-medium">Resultado</th>
                <th className="pb-2 font-medium">Beneficio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apex-border)]">
              {bets.map((bet) => (
                <tr key={bet.id}>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--apex-fg-muted)]">
                    {formatDate(bet.placedAt)}
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--apex-fg)]">{bet.match}</td>
                  <td className="py-2.5 pr-3 text-[var(--apex-fg-muted)]">
                    {bet.market}
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-[var(--apex-fg)]">
                    {formatOdds(bet.odds)}
                  </td>
                  <td className="py-2.5 pr-3 font-mono tabular-nums text-[var(--apex-fg)]">
                    {money(bet.stake)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={resultTone[bet.result]}>
                      {resultLabel[bet.result]}
                    </Badge>
                  </td>
                  <td
                    className={`py-2.5 font-mono tabular-nums ${
                      bet.profit == null
                        ? "text-[var(--apex-fg-subtle)]"
                        : bet.profit > 0
                          ? "text-[var(--apex-accent)]"
                          : bet.profit < 0
                            ? "text-[var(--apex-danger)]"
                            : "text-[var(--apex-fg-muted)]"
                    }`}
                  >
                    {bet.profit == null ? "—" : signed(bet.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
