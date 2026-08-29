import { Badge } from "@/components/design-system";
import { getTranslations } from "next-intl/server";
import { LabSparkline } from "@/components/lab/lab-charts";
import { LabPanel } from "@/components/lab/lab-panel";
import { LabTable } from "@/components/lab/lab-table";
import { formatPctPoints, formatScore } from "@/lib/lab/format";
import type { LabBacktest, LabTableRow } from "@/lib/lab/types";

export async function BacktestEngineCard({ backtest }: { backtest: LabBacktest }) {
  const t = await getTranslations("lab");
  const rows: LabTableRow[] = backtest.marks.map((mark) => ({
    id: mark.id,
    href: "/lab#reports",
    badge: {
      label: mark.hit ? "HIT" : "MISS",
      tone: mark.hit ? "accent" : "danger",
    },
    cells: {
      case: mark.label,
      predicted: mark.predicted,
      actual: mark.actual,
      brier: mark.brier.toFixed(3),
      conf: formatScore(mark.confidence * 100),
      equity: String(mark.equity),
      badge: mark.hit ? "HIT" : "MISS",
    },
  }));

  return (
    <LabPanel
      id="backtest"
      eyebrow={t("closedBook")}
      title={t("backtest")}
      badge={<Badge tone="info">Unit 1X2</Badge>}
      kpis={[
        { label: "N", value: String(backtest.sampleSize), tone: "info" },
        {
          label: "Hit rate",
          value: formatPctPoints(backtest.hitRate, 0),
          tone: backtest.hitRate >= 0.5 ? "accent" : "warning",
        },
        { label: "Brier", value: backtest.meanBrier.toFixed(3) },
        {
          label: "PnL u",
          value: String(backtest.equity.at(-1)?.value ?? 0),
          tone: (backtest.equity.at(-1)?.value ?? 0) >= 0 ? "accent" : "danger",
        },
      ]}
      status={backtest.sampleSize === 0 ? "empty" : "ready"}
      emptyTitle={t("noClosedCases")}
      emptyDescription={t("noClosedCasesDescription")}
      footerHref="/lab#reports"
      footerLabel={t("openPerformanceReport")}
    >
      <p className="mb-3 text-[11px] text-[var(--apex-fg-muted)]">
        {backtest.sampleLabel}. +1 / −1 on predicted 1X2. No book odds on this
        sample. Model {backtest.modelVersion}.
      </p>
      <LabSparkline points={backtest.equity} label={t("closedBookEquity")} />
      <div className="mt-4">
        <LabTable
          columns={[
            { key: "case", label: "Case" },
            { key: "predicted", label: "Pred" },
            { key: "actual", label: "Actual" },
            { key: "brier", label: "Brier", align: "right" },
            { key: "conf", label: "Conf", align: "right" },
            { key: "equity", label: "Eq", align: "right" },
            { key: "badge", label: "Mark" },
          ]}
          rows={rows}
        />
      </div>
    </LabPanel>
  );
}
