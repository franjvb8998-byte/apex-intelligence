import { Badge, Card, CardHeader } from "@/components/design-system";
import type { MatchCenterOddsRow } from "@/lib/match-center/types";

function formatOdds(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatEv(value: number | null): { text: string; positive: boolean | null } {
  if (value == null || !Number.isFinite(value)) {
    return { text: "—", positive: null };
  }
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

type OddsEvCardProps = {
  rows: MatchCenterOddsRow[];
};

export function OddsEvCard({ rows }: OddsEvCardProps) {
  const bookmaker = rows.find((row) => row.bookmaker)?.bookmaker;

  return (
    <Card>
      <CardHeader
        title="Cuotas y expected value"
        description={
          bookmaker
            ? `Mercado ${bookmaker} cruzado con el Probability Engine`
            : "EV = P(modelo) × cuota − 1"
        }
        action={bookmaker ? <Badge tone="info">{bookmaker}</Badge> : undefined}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin cuotas en el catálogo para este partido. El EV aparece cuando el
          proveedor entrega mercado.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--apex-border)] text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                <th className="pb-2 font-medium">Mercado</th>
                <th className="pb-2 font-medium">Selección</th>
                <th className="pb-2 font-medium">Cuota</th>
                <th className="pb-2 font-medium">Modelo</th>
                <th className="pb-2 font-medium">Implícita</th>
                <th className="pb-2 font-medium">EV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apex-border)]">
              {rows.map((row) => {
                const ev = formatEv(row.expectedValue);
                return (
                  <tr key={row.id}>
                    <td className="py-2 text-[var(--apex-fg-muted)]">
                      {row.marketLabel}
                    </td>
                    <td className="py-2 text-[var(--apex-fg)]">{row.label}</td>
                    <td className="py-2 font-mono tabular-nums">
                      {formatOdds(row.decimalOdds)}
                    </td>
                    <td className="py-2 font-mono tabular-nums">
                      {formatPct(row.modelProbability)}
                    </td>
                    <td className="py-2 font-mono tabular-nums text-[var(--apex-fg-muted)]">
                      {formatPct(row.impliedProbability)}
                    </td>
                    <td
                      className={
                        ev.positive == null
                          ? "py-2 font-mono tabular-nums text-[var(--apex-fg-subtle)]"
                          : ev.positive
                            ? "py-2 font-mono tabular-nums text-[var(--apex-accent)]"
                            : "py-2 font-mono tabular-nums text-[var(--apex-warning)]"
                      }
                    >
                      {ev.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
