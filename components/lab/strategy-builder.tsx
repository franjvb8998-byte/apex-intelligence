"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Badge } from "@/components/design-system";
import { VERDICT_BADGE_TONE } from "@/components/apex-opportunities/format";
import { LabKpiStrip, LabPanel } from "@/components/lab/lab-panel";
import { opportunityAnalysisHref } from "@/lib/apex-opportunities/hrefs";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecisionVerdictKind } from "@/lib/decision-engine/types";
import { formatEv, formatScore } from "@/lib/lab/format";
import {
  ALL_VERDICTS,
  DEFAULT_LAB_STRATEGY,
  LAB_STRATEGY_PRESETS,
  paperLabStrategy,
} from "@/lib/lab/strategy";
import type { LabStrategySpec } from "@/lib/lab/types";

function toggleVerdict(
  current: ApexDecisionVerdictKind[],
  next: ApexDecisionVerdictKind,
): ApexDecisionVerdictKind[] {
  if (current.includes(next)) {
    const rest = current.filter((item) => item !== next);
    return rest.length === 0 ? current : rest;
  }
  return [...current, next];
}

export function StrategyBuilderCard({
  analyzed,
  scanOk,
}: {
  analyzed: ApexOpportunity[];
  scanOk: boolean;
}) {
  const t = useTranslations("lab");
  const [spec, setSpec] = useState<LabStrategySpec>(DEFAULT_LAB_STRATEGY);
  const paper = useMemo(
    () => paperLabStrategy(analyzed, spec),
    [analyzed, spec],
  );

  if (!scanOk) {
    return (
      <LabPanel
        id="strategy"
        eyebrow={t("paper")}
        title={t("strategy")}
        status="error"
        errorTitle={t("scanUnavailable")}
        errorDescription={t("scanUnavailableDescription")}
        footerHref="/opportunities"
        footerLabel={t("openOpportunities")}
      />
    );
  }

  return (
    <LabPanel
      id="strategy"
      eyebrow={t("paper")}
      title={t("strategy")}
      badge={<Badge tone="warning">{t("filterOnly")}</Badge>}
      footerHref="/opportunities"
      footerLabel={t("applyOnOpportunities")}
    >
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--apex-fg-muted)]">
        {t("strategyNote")}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {LAB_STRATEGY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setSpec(preset)}
            className="apex-focusable rounded-[var(--apex-radius-sm)] border border-[var(--apex-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-[11px] text-[var(--apex-fg-muted)]">
          Min score {spec.minScore}
          <input
            type="range"
            min={0}
            max={90}
            value={spec.minScore}
            onChange={(event) =>
              setSpec({ ...spec, minScore: Number(event.target.value) })
            }
            className="mt-1 block w-full"
          />
        </label>
        <label className="text-[11px] text-[var(--apex-fg-muted)]">
          Min confidence {spec.minConfidence}
          <input
            type="range"
            min={0}
            max={90}
            value={spec.minConfidence}
            onChange={(event) =>
              setSpec({ ...spec, minConfidence: Number(event.target.value) })
            }
            className="mt-1 block w-full"
          />
        </label>
        <label className="text-[11px] text-[var(--apex-fg-muted)]">
          EV floor{" "}
          {spec.minEv == null ? "off" : spec.minEv === 0 ? "> 0" : spec.minEv}
          <input
            type="range"
            min={-1}
            max={10}
            value={spec.minEv == null ? -1 : Math.round(spec.minEv * 100)}
            onChange={(event) => {
              const raw = Number(event.target.value);
              setSpec({
                ...spec,
                minEv: raw < 0 ? null : raw / 100,
              });
            }
            }
            className="mt-1 block w-full"
          />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {ALL_VERDICTS.map((verdict) => {
          const on = spec.verdicts.includes(verdict);
          return (
            <button
              key={verdict}
              type="button"
              onClick={() =>
                setSpec({
                  ...spec,
                  verdicts: toggleVerdict(spec.verdicts, verdict),
                })
              }
              className="apex-focusable"
            >
              <Badge tone={on ? VERDICT_BADGE_TONE[verdict] : "neutral"}>
                {verdict}
              </Badge>
            </button>
          );
        })}
      </div>

      <LabKpiStrip
        kpis={[
          { label: "Selected", value: `${paper.selected}/${paper.scanned}`, tone: "accent" },
          { label: "Avg score", value: formatScore(paper.averageScore) },
          { label: "Avg conf", value: formatScore(paper.averageConfidence) },
          { label: "Avg EV", value: formatEv(paper.averageEv) },
          {
            label: "Avg Kelly",
            value:
              paper.averageKelly == null
                ? "—"
                : `${paper.averageKelly.toFixed(1)}%`,
          },
          { label: "Elite", value: String(paper.elite) },
        ]}
      />

      {paper.passed.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          No rows pass this paper filter. The Decision Engine still recommends
          waiting rather than forcing a bet.
        </p>
      ) : (
        <ul className="space-y-1">
          {paper.passed.slice(0, 6).map((row) => (
            <li key={row.fixtureId}>
              <Link
                href={opportunityAnalysisHref(row.fixtureId)}
                className="apex-focusable flex items-center justify-between gap-2 rounded-[var(--apex-radius-md)] px-1 py-1.5 hover:bg-slate-950/50"
              >
                <span className="truncate text-[12px] text-[var(--apex-fg)]">
                  {row.home.shortName} vs {row.away.shortName}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={VERDICT_BADGE_TONE[row.verdict]}>
                    {row.verdictLabel}
                  </Badge>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
                    {formatScore(row.score)} · {formatEv(row.expectedValue)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LabPanel>
  );
}
