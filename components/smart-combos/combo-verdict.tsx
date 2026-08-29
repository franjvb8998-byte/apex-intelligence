"use client";

import { useTranslations } from "next-intl";
import { Badge, ScoreGauge } from "@/components/design-system";
import { VERDICT_BADGE_TONE } from "@/lib/apex-opportunities/display";
import { ComboMetrics } from "@/components/smart-combos/combo-metrics";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import type { ComboAnalysis } from "@/lib/smart-combos/types";

export function ComboVerdictCard({ analysis }: { analysis: ComboAnalysis }) {
  const t = useTranslations("smartCombos");
  return (
    <ComboPanel
      id="analyzer"
      eyebrow={t("comboAnalyzer")}
      title={t("verdictTitle")}
      action={
        <Badge tone={VERDICT_BADGE_TONE[analysis.verdict.kind]} size="md">
          {analysis.verdict.label}
        </Badge>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <ScoreGauge
          value={analysis.healthScore}
          label={t("health")}
          caption={t("foldConfidence", {
            fold: analysis.legs.length,
            band: analysis.confidenceBand,
          })}
          size="md"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <ComboMetrics analysis={analysis} />
          <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
            {analysis.explanation}
          </p>
          {analysis.weakest && (
            <p className="font-mono text-[11px] text-[var(--apex-warning)]">
              {t("weakest", {
                selection: analysis.weakest.selectionLabel,
                verdict: analysis.weakest.verdictLabel,
              })}
            </p>
          )}
        </div>
      </div>
    </ComboPanel>
  );
}
