import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { LabSparkline } from "@/components/lab/lab-charts";
import { LabPanel } from "@/components/lab/lab-panel";
import { LabTable } from "@/components/lab/lab-table";
import { formatMoney, formatSignedMoney } from "@/lib/bankroll/currency";
import { formatPct } from "@/lib/bankroll/format";
import { hrefForMatchName } from "@/lib/feed/build";
import type { BankrollData } from "@/lib/bankroll/types";
import type { LabBacktest, LabPoint, LabTableRow } from "@/lib/lab/types";
import type { BankrollFixture } from "@/lib/bankroll/types";

export async function HistoricalSimulationCard({
  backtest,
  book,
  fixtures = [],
}: {
  backtest: LabBacktest;
  book: BankrollData;
  fixtures?: BankrollFixture[];
}) {
  const t = await getTranslations("lab");
  const bookPoints: LabPoint[] = book.evolution.map((point) => ({
    label: point.date.slice(0, 10),
    value: point.balance,
  }));

  const settled = book.bets.filter(
    (bet) => bet.result === "won" || bet.result === "lost",
  );
  const rows: LabTableRow[] = settled.slice(-8).map((bet) => ({
    id: bet.id,
    href: hrefForMatchName(bet.match, fixtures),
    badge: {
      label: bet.result.toUpperCase(),
      tone: bet.result === "won" ? "accent" : "danger",
    },
    cells: {
      match: bet.match,
      market: bet.market,
      odds: bet.odds.toFixed(2),
      stake: formatMoney(bet.stake, book.currency),
      pnl: formatSignedMoney(bet.profit ?? 0, book.currency),
      badge: bet.result.toUpperCase(),
    },
  }));

  return (
    <LabPanel
      id="simulate"
      eyebrow={t("walkForward")}
      title={t("simulation")}
      badge={<Badge>Two books</Badge>}
      kpis={[
        {
          label: "PE units",
          value: String(backtest.equity.at(-1)?.value ?? 0),
          tone: (backtest.equity.at(-1)?.value ?? 0) >= 0 ? "accent" : "danger",
        },
        {
          label: "Book",
          value: formatMoney(book.metrics.currentBankroll, book.currency),
          tone: "accent",
        },
        {
          label: "Yield",
          value: formatPct(book.metrics.yield),
        },
        {
          label: "WR",
          value: formatPct(book.metrics.winRate, 0),
        },
      ]}
      footerHref="/bankroll"
      footerLabel={t("openBankroll")}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
            Probability Engine · unit marks
          </p>
          <LabSparkline
            points={backtest.equity}
            label={t("learningEquity")}
          />
        </div>
        <div>
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
            Session book · settled ledger
          </p>
          <LabSparkline points={bookPoints} label={t("bankrollEvolution")} />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--apex-fg-muted)]">
        Left: Learning Engine closed book (no odds). Right: My Bankroll session
        ledger — not a Decision Engine replay.
      </p>
      <div className="mt-4">
        <LabTable
          columns={[
            { key: "match", label: "Match" },
            { key: "market", label: "Market" },
            { key: "odds", label: "Odds", align: "right" },
            { key: "stake", label: "Stake", align: "right" },
            { key: "pnl", label: "P/L", align: "right" },
            { key: "badge", label: "Result" },
          ]}
          rows={rows}
          empty={t("noSettledBets")}
        />
      </div>
    </LabPanel>
  );
}
