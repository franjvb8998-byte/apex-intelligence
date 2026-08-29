"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { OpportunityActions } from "@/components/apex-opportunities/opportunity-actions";
import {
  formatKelly,
  formatOdds,
} from "@/lib/apex-opportunities/display";
import { explainOpportunity } from "@/lib/opportunity-scanner/explain";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

export function ScannerDetail({
  row,
  watched,
  onWatch,
}: {
  row: ApexOpportunity;
  watched: boolean;
  onWatch: () => void;
}) {
  const t = useTranslations("scanner.detail");
  const explained = explainOpportunity(row);

  return (
    <div className="border-b border-[var(--apex-border)] bg-slate-950/60 px-3 py-4 sm:px-4">
      <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        <span className="font-medium text-[var(--apex-fg)]">{t("why")} </span>
        {explained.why}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {row.explanation}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-accent)]">
            {t("supporting")}
          </p>
          <ul className="mt-2 space-y-2">
            {explained.supporting.map((item) => (
              <li key={item.title} className="text-sm text-[var(--apex-fg)]">
                <span className="font-medium">{item.title}.</span>{" "}
                <span className="text-[var(--apex-fg-muted)]">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-warning)]">
            {t("risks")}
          </p>
          <ul className="mt-2 space-y-2">
            {explained.risks.map((item) => (
              <li key={item.title} className="text-sm text-[var(--apex-fg)]">
                <span className="font-medium">{item.title}.</span>{" "}
                <span className="text-[var(--apex-fg-muted)]">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
            {t("fairOdds")}
          </dt>
          <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
            {formatOdds(explained.fairOdds)}
          </dd>
        </div>
        <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
            {t("bankrollPct")}
          </dt>
          <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
            {explained.stakeLabel}
          </dd>
        </div>
        <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
            {t("kelly")}
          </dt>
          <dd className="font-mono text-sm tabular-nums text-[var(--apex-fg)]">
            {formatKelly(explained.kellyPct)}
          </dd>
        </div>
        <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
            {t("recommendation")}
          </dt>
          <dd className="text-sm text-[var(--apex-fg)]">{explained.recommendation}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <OpportunityActions row={row} watched={watched} onWatch={onWatch} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--apex-fg-subtle)]">
        {t("footer")}{" "}
        <Link
          href="/match-analysis"
          className="text-[var(--apex-accent)] hover:underline"
        >
          {t("openMatchAnalysis")}
        </Link>{" "}
        {t("fullFixture")}
      </p>
    </div>
  );
}
