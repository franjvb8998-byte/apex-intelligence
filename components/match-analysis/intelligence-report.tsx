"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Badge,
  Card,
  CardHeader,
  ScoreGauge,
} from "@/components/design-system";
import { RatingStat } from "@/components/match-analysis/rating-stat";
import { cx } from "@/components/design-system/utils";
import type { ApexIntelligenceReport } from "@/lib/intelligence-report/types";
import type { ApexTone } from "@/components/design-system/tokens";

type IntelligenceReportProps = {
  report: ApexIntelligenceReport;
};

const verdictTone: Record<ApexIntelligenceReport["verdict"]["kind"], ApexTone> = {
  strong_bet: "accent",
  lean_bet: "warning",
  avoid: "danger",
};

const stakeTone: Record<ApexIntelligenceReport["recommendation"]["kind"], ApexTone> = {
  pass: "neutral",
  small: "info",
  medium: "warning",
  strong: "accent",
};

function formatOdds(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "n/d" : value.toFixed(2);
}

function formatPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function formatProb(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return `${(value * 100).toFixed(1)}%`;
}

function Stars({ filled }: { filled: number }) {
  return (
    <span
      className="font-mono text-2xl tracking-[0.18em] text-[var(--apex-accent)] sm:text-3xl"
      aria-label={`${filled} of 5 stars`}
    >
      {"★★★★★☆☆☆☆☆".slice(5 - filled, 10 - filled)}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="currentColor"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l4.1 4.1 6.5-6.5a1 1 0 0 1 1.4 0Z"
      />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden>
      <path
        fill="currentColor"
        d="M10.9 3.2a1 1 0 0 0-1.8 0L2.2 15.1A1 1 0 0 0 3.1 16.5h13.8a1 1 0 0 0 .9-1.4L10.9 3.2ZM10 8a.8.8 0 0 1 .8.8v3.4a.8.8 0 1 1-1.6 0V8.8A.8.8 0 0 1 10 8Zm0 7.2a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"
      />
    </svg>
  );
}

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <CardHeader
      className="mb-4"
      title={`${index} · ${title}`}
    />
  );
}

export function IntelligenceReport({ report }: IntelligenceReportProps) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const };
  const flags: Array<{ id: string; label: string; tone: ApexTone }> = [];
  if (report.market.flags.positiveEv) {
    flags.push({ id: "pev", label: "Positive EV", tone: "accent" });
  }
  if (report.market.flags.negativeEv) {
    flags.push({ id: "nev", label: "Negative EV", tone: "danger" });
  }
  if (report.market.flags.underpriced) {
    flags.push({ id: "under", label: "Underpriced", tone: "accent" });
  }
  if (report.market.flags.overpriced) {
    flags.push({ id: "over", label: "Overpriced", tone: "danger" });
  }

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="space-y-5"
      aria-label="APEX Intelligence Report"
    >
      <Card
        padding="lg"
        className="overflow-hidden border-[var(--apex-accent-border)] bg-[linear-gradient(180deg,rgba(0,212,170,0.08),transparent_42%),var(--apex-surface)]"
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--apex-accent)]">
              APEX Intelligence Report
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-2xl">
              Why this recommendation exists
            </h2>
          </div>
          <Badge tone={verdictTone[report.verdict.kind]} size="md">
            {report.verdict.selectionLabel}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(0,1.2fr)] lg:items-center">
          <section aria-labelledby="apex-verdict-heading">
            <h3
              id="apex-verdict-heading"
              className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]"
            >
              01 · APEX Verdict
            </h3>
            <div className="mt-3">
              <Stars filled={report.verdict.stars} />
              <p
                className={cx(
                  "mt-2 text-3xl font-semibold tracking-tight sm:text-4xl",
                  report.verdict.kind === "avoid"
                    ? "text-[var(--apex-danger)]"
                    : report.verdict.kind === "lean_bet"
                      ? "text-[var(--apex-warning)]"
                      : "text-[var(--apex-accent)]",
                )}
              >
                {report.verdict.label}
              </p>
            </div>
          </section>

          <section aria-labelledby="apex-confidence-heading" className="flex flex-col items-center">
            <h3
              id="apex-confidence-heading"
              className="mb-2 text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]"
            >
              02 · Confidence Score
            </h3>
            <ScoreGauge
              value={report.confidence.value}
              label="Confidence"
              size="lg"
              caption={report.confidence.caption}
            />
            {report.confidence.value !== report.confidence.base ? (
              <p className="mt-1 text-center text-[11px] text-[var(--apex-fg-subtle)]">
                Base {report.confidence.base} − published risk penalties
              </p>
            ) : null}
          </section>

          <section aria-labelledby="apex-rec-heading">
            <h3
              id="apex-rec-heading"
              className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]"
            >
              06 · Recommendation
            </h3>
            <div className="mt-3 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/50 p-4">
              <Badge tone={stakeTone[report.recommendation.kind]} size="md">
                {report.recommendation.label}
              </Badge>
              <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-[var(--apex-fg)]">
                {report.recommendation.exposureLabel}
              </p>
              <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
                Recommended bankroll exposure
              </p>
            </div>
          </section>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="md">
          <SectionLabel index="03" title="Key Reasons" />
          {report.reasons.length === 0 ? (
            <p className="text-sm text-[var(--apex-fg-muted)]">
              No qualifying edges from published API-Football data.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {report.reasons.map((reason) => (
                <li
                  key={reason.id}
                  className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)]/40 p-3"
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-[var(--apex-accent)]">
                    <CheckIcon />
                    {reason.title}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-[var(--apex-fg-muted)]">
                    {reason.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md">
          <SectionLabel index="04" title="Risk Factors" />
          {report.risks.length === 0 ? (
            <p className="text-sm text-[var(--apex-fg-muted)]">
              No published risk flags. Derby, rotation and next-cup signals are omitted when the catalogue is silent.
            </p>
          ) : (
            <ul className="grid gap-3">
              {report.risks.map((risk) => (
                <li
                  key={risk.id}
                  className="rounded-[var(--apex-radius-lg)] border border-amber-500/30 bg-[var(--apex-warning-muted)]/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--apex-warning)]">
                      <WarnIcon />
                      {risk.title}
                    </p>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--apex-warning)]">
                      −{risk.penalty}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-[var(--apex-fg-muted)]">
                    {risk.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card padding="md">
        <SectionLabel index="05" title="Market Analysis" />
        {flags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {flags.map((flag) => (
              <Badge key={flag.id} tone={flag.tone}>
                {flag.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-[var(--apex-fg-muted)]">
            No EV or mispricing flag on the published board.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RatingStat
            label="Bookmaker Odds"
            value={formatOdds(report.market.bookmakerOdds)}
            hint={report.market.bookmaker ?? "Best published 1X2"}
          />
          <RatingStat
            label="Fair Odds"
            value={formatOdds(report.market.fairOdds)}
            hint="1 / model probability"
          />
          <RatingStat
            label="Probability"
            value={formatProb(report.market.modelProbability)}
            hint="Probability Engine"
          />
          <RatingStat
            label="Expected Value"
            value={formatPct(report.market.expectedValue)}
            hint="P × odds − 1"
            tone={
              report.market.flags.positiveEv
                ? "accent"
                : report.market.flags.negativeEv
                  ? "danger"
                  : "neutral"
            }
          />
          <RatingStat
            label="Kelly %"
            value={
              report.market.kellyPct == null
                ? "n/d"
                : `${report.market.kellyPct.toFixed(1)}%`
            }
            hint="¼ Kelly after Skip/Watch caps"
          />
          <RatingStat
            label="Implied Probability"
            value={formatProb(report.market.impliedProbability)}
            hint="1 / bookmaker odds"
          />
          <RatingStat
            label="Market Edge"
            value={formatPct(report.market.marketEdge)}
            hint="Model P − implied P"
            tone={
              (report.market.marketEdge ?? 0) > 0.005
                ? "accent"
                : (report.market.marketEdge ?? 0) < -0.005
                  ? "danger"
                  : "neutral"
            }
          />
        </div>
      </Card>

      <Card padding="md">
        <SectionLabel index="07" title="Natural Language Explanation" />
        <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)]">
          {report.narrative}
        </p>
      </Card>

      <Card padding="md">
        <SectionLabel index="08" title="APEX Score Breakdown" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.breakdown.map((bar) => (
            <li key={bar.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span className="text-[var(--apex-fg-muted)]">{bar.label}</span>
                <span className="font-mono tabular-nums text-[var(--apex-fg-subtle)]">
                  {bar.available ? bar.score : "n/d"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
                <div
                  className={cx(
                    "h-full rounded-[var(--apex-radius-full)] transition-[width] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]",
                    bar.available ? "bg-[var(--apex-accent)]" : "bg-slate-700",
                  )}
                  style={{ width: `${bar.available ? bar.score : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-[var(--apex-fg-subtle)]">
                {bar.note}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </motion.article>
  );
}
