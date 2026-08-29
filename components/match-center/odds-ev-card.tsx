"use client";

import { useTranslations } from "next-intl";
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

function selectionLabel(
  row: MatchCenterOddsRow,
  t: ReturnType<typeof useTranslations<"common">>,
): string {
  const key = row.selection.toLowerCase();
  if (key === "home" || key === "1") return t("home");
  if (key === "draw" || key === "x") return t("draw");
  if (key === "away" || key === "2") return t("away");
  if (key.startsWith("over")) return t("over25");
  if (key.startsWith("under")) return t("under25");
  if (key === "yes" || key === "si" || key === "sí") return t("yes");
  if (key === "no") return t("no");
  return row.label;
}

type OddsEvCardProps = {
  rows: MatchCenterOddsRow[];
};

export function OddsEvCard({ rows }: OddsEvCardProps) {
  const t = useTranslations("matchCenter");
  const common = useTranslations("common");
  const board = preMatchOddsBoard(rows);
  const bestRows = [
    ...board.oneXTwo,
    ...board.overUnder25,
    ...board.btts,
  ];
  const bookmakerLabel =
    board.bookmakerCount > 1
      ? t("bookmakers", { count: board.bookmakerCount })
      : bestRows.find((row) => row.bookmaker)?.bookmaker;

  return (
    <Card>
      <CardHeader
        title={t("oddsTitle")}
        description={
          board.bookmakerCount > 1
            ? t("oddsDescriptionMulti")
            : t("oddsDescriptionEv")
        }
        action={
          bookmakerLabel ? <Badge tone="info">{bookmakerLabel}</Badge> : undefined
        }
      />
      {bestRows.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("oddsEmpty")}
        </p>
      ) : (
        <div className="space-y-6">
          <OddsMarketGroup title={t("market1x2")} rows={board.oneXTwo} common={common} t={t} />
          <OddsMarketGroup title={t("marketOu")} rows={board.overUnder25} common={common} t={t} />
          <OddsMarketGroup title={t("marketBtts")} rows={board.btts} common={common} t={t} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--apex-border)] text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                  <th className="pb-2 font-medium">{t("colMarket")}</th>
                  <th className="pb-2 font-medium">{t("colSelection")}</th>
                  <th className="pb-2 font-medium">{t("colOdds")}</th>
                  <th className="pb-2 font-medium">{t("colBook")}</th>
                  <th className="pb-2 font-medium">{t("colModel")}</th>
                  <th className="pb-2 font-medium">{t("colImplied")}</th>
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
                        {selectionLabel(row, common)}
                      </td>
                      <td className="py-2 font-mono tabular-nums">
                        <span className="inline-flex items-center gap-2">
                          {formatOdds(row.decimalOdds)}
                          {row.isBest && (
                            <Badge tone="accent" size="sm">
                              {common("best")}
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
  common,
  t,
}: {
  title: string;
  rows: MatchCenterOddsRow[];
  common: ReturnType<typeof useTranslations<"common">>;
  t: ReturnType<typeof useTranslations<"matchCenter">>;
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
            label={selectionLabel(row, common)}
            value={formatOdds(row.decimalOdds)}
            hint={
              row.bookmaker
                ? row.isBest
                  ? t("bestOddsHint", { bookmaker: row.bookmaker })
                  : row.bookmaker
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
