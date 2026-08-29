"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/components/design-system/utils";
import {
  formatKelly,
  formatOdds,
  formatSignedPct,
} from "@/lib/apex-opportunities/display";
import type { ComboAnalysis } from "@/lib/smart-combos/types";

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "danger" | "warning" | "muted";
}) {
  return (
    <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2.5 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={cx(
          "mt-0.5 font-mono text-sm tabular-nums text-[var(--apex-fg)]",
          tone === "accent" && "text-[var(--apex-accent)]",
          tone === "danger" && "text-[var(--apex-danger)]",
          tone === "warning" && "text-[var(--apex-warning)]",
          tone === "muted" && "text-[var(--apex-fg-muted)]",
        )}
        title={hint}
      >
        {value}
      </dd>
    </div>
  );
}

export function ComboMetrics({ analysis }: { analysis: ComboAnalysis }) {
  const t = useTranslations("smartCombos");
  const evTone =
    analysis.expectedValue == null
      ? "muted"
      : analysis.expectedValue > 0
        ? "accent"
        : "danger";
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label={t("combinedOdds")} value={formatOdds(analysis.combinedOdds)} />
      <Metric
        label={t("implied")}
        value={
          analysis.impliedProbability == null
            ? t("na")
            : `${(analysis.impliedProbability * 100).toFixed(1)}%`
        }
      />
      <Metric
        label={t("apexProbability")}
        value={
          analysis.adjustedApexProbability == null
            ? t("na")
            : `${(analysis.adjustedApexProbability * 100).toFixed(1)}%`
        }
        hint={t("independenceHint")}
      />
      <Metric
        label={t("expectedValue")}
        value={formatSignedPct(analysis.expectedValue)}
        tone={evTone}
      />
      <Metric label={t("kelly")} value={analysis.sizing.stakeLabel} />
      <Metric
        label={t("quarterKelly")}
        value={formatKelly(analysis.sizing.kellyPct)}
      />
      <Metric
        label={t("confidence")}
        value={`${analysis.confidence} · ${analysis.confidenceBand}`}
      />
      <Metric
        label={t("risk")}
        value={`${analysis.riskScore} · ${analysis.riskBand}`}
        tone={analysis.riskBand === "high" ? "danger" : undefined}
      />
    </dl>
  );
}
