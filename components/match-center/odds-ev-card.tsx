import {
  Badge,
  Card,
  CardHeader,
  MarketChip,
} from "@/components/design-system";
import { preMatchOddsBoard } from "@/lib/match-center/markets";
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

function selectionLabel(row: MatchCenterOddsRow): string {
  const key = row.selection.toLowerCase();
  if (key === "home" || key === "1") return "Local";
  if (key === "draw" || key === "x") return "Empate";
  if (key === "away" || key === "2") return "Visitante";
  if (key.startsWith("over")) return "Over 2.5";
  if (key.startsWith("under")) return "Under 2.5";
  if (key === "yes" || key === "si" || key === "sí") return "Sí";
  if (key === "no") return "No";
  return row.label;
}

type OddsEvCardProps = {
  rows: MatchCenterOddsRow[];
};

export function OddsEvCard({ rows }: OddsEvCardProps) {
  const board = preMatchOddsBoard(rows);
  const bestRows = [
    ...board.oneXTwo,
    ...board.overUnder25,
    ...board.btts,
  ];
  const bookmakerLabel =
    board.bookmakerCount > 1
      ? `${board.bookmakerCount} casas`
      : bestRows.find((row) => row.bookmaker)?.bookmaker;

  return (
    <Card>
      <CardHeader
        title="Cuotas pre-partido"
        description={
          board.bookmakerCount > 1
            ? "Mejor cuota del catálogo API-Football cruzada con el Probability Engine"
            : "EV = P(modelo) × cuota − 1"
        }
        action={
          bookmakerLabel ? <Badge tone="info">{bookmakerLabel}</Badge> : undefined
        }
      />
      {bestRows.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin cuotas en el catálogo para este partido. El EV aparece cuando el
          proveedor entrega mercado.
        </p>
      ) : (
        <div className="space-y-6">
          <OddsMarketGroup title="1X2 — Local / Empate / Visitante" rows={board.oneXTwo} />
          <OddsMarketGroup title="Over / Under 2.5" rows={board.overUnder25} />
          <OddsMarketGroup title="Ambos marcan (BTTS)" rows={board.btts} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--apex-border)] text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                  <th className="pb-2 font-medium">Mercado</th>
                  <th className="pb-2 font-medium">Selección</th>
                  <th className="pb-2 font-medium">Cuota</th>
                  <th className="pb-2 font-medium">Casa</th>
                  <th className="pb-2 font-medium">Modelo</th>
                  <th className="pb-2 font-medium">Implícita</th>
                  <th className="pb-2 font-medium">EV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--apex-border)]">
                {bestRows.map((row) => {
                  const ev = formatEv(row.expectedValue);
                  return (
                    <tr
                      key={row.id}
                      className={
                        row.isBest
                          ? "bg-[var(--apex-accent-muted)]/40"
                          : undefined
                      }
                    >
                      <td className="py-2 text-[var(--apex-fg-muted)]">
                        {row.marketLabel}
                      </td>
                      <td className="py-2 text-[var(--apex-fg)]">
                        {selectionLabel(row)}
                      </td>
                      <td className="py-2 font-mono tabular-nums">
                        <span className="inline-flex items-center gap-2">
                          {formatOdds(row.decimalOdds)}
                          {row.isBest && (
                            <Badge tone="accent" size="sm">
                              Mejor
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-2 text-[var(--apex-fg-muted)]">
                        {row.bookmaker ?? "—"}
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
        </div>
      )}
    </Card>
  );
}

function OddsMarketGroup({
  title,
  rows,
}: {
  title: string;
  rows: MatchCenterOddsRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {title}
      </p>
      <div
        className={
          rows.length === 3
            ? "grid gap-2 sm:grid-cols-3"
            : "grid gap-2 sm:grid-cols-2"
        }
      >
        {rows.map((row) => (
          <MarketChip
            key={row.id}
            interactive={false}
            selected={row.isBest}
            label={selectionLabel(row)}
            value={formatOdds(row.decimalOdds)}
            hint={
              row.bookmaker
                ? row.isBest
                  ? `${row.bookmaker} · mejor cuota`
                  : row.bookmaker
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
