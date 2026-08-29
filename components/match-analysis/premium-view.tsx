"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge, Card } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { ApexTone } from "@/components/design-system/tokens";
import { PremiumHero } from "@/components/match-analysis/premium-hero";
import {
  formatEv,
  formatOdds,
  formatProb,
  formatScore,
} from "@/components/match-analysis/premium-format";
import { buildPremiumAnalysis } from "@/lib/match-analysis/premium";
import type {
  PremiumAnalysis,
  PremiumContextFactor,
  PremiumMarketMove,
  PremiumRecKind,
  PremiumRecommendation,
} from "@/lib/match-analysis/premium";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type { ApexRiskBand } from "@/lib/decision-engine/types";

type PremiumMatchAnalysisProps = {
  data: MatchAnalysisData;
};

const REC_KIND_ORDER: PremiumRecKind[] = [
  "highestConfidence",
  "bestValue",
  "safest",
  "aggressive",
  "longshot",
  "avoid",
];

const riskLabelKey: Record<ApexRiskBand, "riskLow" | "riskMedium" | "riskHigh"> = {
  low: "riskLow",
  medium: "riskMedium",
  high: "riskHigh",
};

const riskTone: Record<ApexRiskBand, ApexTone> = {
  low: "accent",
  medium: "warning",
  high: "danger",
};

const moveCopy: Record<PremiumMarketMove, "moveUnderpriced" | "moveOverpriced" | "moveFair" | "moveUnpriced"> =
  {
    underpriced: "moveUnderpriced",
    overpriced: "moveOverpriced",
    fair: "moveFair",
    unpriced: "moveUnpriced",
  };

export function PremiumMatchAnalysis({ data }: PremiumMatchAnalysisProps) {
  const premium = buildPremiumAnalysis(data);

  return (
    <div className="w-full space-y-10">
      <PremiumHero data={data} premium={premium} />
      <RecommendationCenter premium={premium} />
      <Explainability premium={premium} />
      <TeamComparison data={data} premium={premium} />
      <ContextEngine premium={premium} />
      <MarketIntelligence premium={premium} />
      <MatchSummary premium={premium} />
      <EvidenceMeter premium={premium} />
    </div>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card as="section" padding="lg" aria-labelledby={`premium-${index}`}>
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
          {index}
        </p>
        <h2
          id={`premium-${index}`}
          className="mt-2 text-lg font-semibold text-[var(--apex-fg)]"
        >
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--apex-fg-muted)]">{hint}</p>
        ) : null}
      </header>
      {children}
    </Card>
  );
}

function RecommendationCenter({ premium }: { premium: PremiumAnalysis }) {
  const p = useTranslations("matchAnalysis.premium");
  const featured = REC_KIND_ORDER.filter((kind) => kind !== "avoid").flatMap(
    (kind) => premium.recommendations.filter((row) => row.kind === kind),
  );
  const avoided = premium.recommendations.filter((row) => row.kind === "avoid");

  return (
    <Section
      index="02"
      title={p("recCenter")}
      hint={p("recCenterHint")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {featured.map((row) => (
          <RecommendationCard key={`${row.kind}-${row.market}-${row.selection}`} row={row} />
        ))}
      </div>
      {avoided.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-danger)]">
            {p("avoid")}
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {avoided.map((row) => (
              <RecommendationCard
                key={`${row.kind}-${row.market}-${row.selection}`}
                row={row}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function RecommendationCard({ row }: { row: PremiumRecommendation }) {
  const t = useTranslations("matchAnalysis");
  const p = useTranslations("matchAnalysis.premium");
  const empty = t("na");
  const avoid = row.kind === "avoid";

  return (
    <article
      className={cx(
        "rounded-[var(--apex-radius-xl)] border bg-slate-950/40 px-5 py-5",
        avoid
          ? "border-[var(--apex-danger)]/30"
          : "border-[var(--apex-border)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {p(row.kind)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {row.primary ? <Badge>{p("primaryPick")}</Badge> : null}
          {row.riskBand ? (
            <Badge tone={riskTone[row.riskBand]}>
              {p("risk")} {p(riskLabelKey[row.riskBand])}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-base font-semibold text-[var(--apex-fg)]">
        {row.selection}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Metric
          label={p("confidence")}
          value={formatScore(row.confidence, empty)}
        />
        <Metric
          label={p("expectedValue")}
          value={formatEv(row.expectedValue, empty)}
          tone={
            row.expectedValue == null
              ? "neutral"
              : row.expectedValue > 0
                ? "accent"
                : "danger"
          }
        />
        <Metric label={p("bookmakerOdds")} value={formatOdds(row.odds, empty)} />
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {row.explanation}
      </p>
    </article>
  );
}

function Explainability({ premium }: { premium: PremiumAnalysis }) {
  const p = useTranslations("matchAnalysis.premium");
  const t = useTranslations("matchAnalysis");

  return (
    <Section index="03" title={p("explainTitle")} hint={p("explainHint")}>
      {premium.contributions.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{p("noContributions")}</p>
      ) : (
        <ul className="space-y-4">
          {premium.contributions.map((row) => {
            const plus = row.polarity === "plus";
            return (
              <li
                key={row.key}
                className="grid gap-3 border-b border-[var(--apex-border)] pb-4 last:border-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                <p
                  className={cx(
                    "font-mono text-sm font-semibold tabular-nums",
                    plus
                      ? "text-[var(--apex-accent)]"
                      : "text-[var(--apex-danger)]",
                  )}
                >
                  {plus ? "+" : "−"} {formatScore(row.score, t("na"))}
                </p>
                <div>
                  <p className="text-sm font-medium text-[var(--apex-fg)]">
                    {plus ? "+ " : "− "}
                    {row.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
                    {row.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function TeamComparison({
  data,
  premium,
}: {
  data: MatchAnalysisData;
  premium: PremiumAnalysis;
}) {
  const p = useTranslations("matchAnalysis.premium");
  const t = useTranslations("matchAnalysis");
  const empty = t("na");

  return (
    <Section
      index="04"
      title={p("comparisonTitle")}
      hint={p("comparisonHint")}
    >
      {premium.comparison.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{p("noComparison")}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-between text-xs text-[var(--apex-fg-subtle)]">
            <span>{data.homeTeam.shortName}</span>
            <span>{data.awayTeam.shortName}</span>
          </div>
          {premium.comparison.map((row) => (
            <CompareRow
              key={row.key}
              label={p(row.key)}
              home={row.home}
              away={row.away}
              empty={empty}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function CompareRow({
  label,
  home,
  away,
  empty,
}: {
  label: string;
  home: number | null;
  away: number | null;
  empty: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-mono tabular-nums text-[var(--apex-accent)]">
          {home == null ? empty : home}
        </span>
        <span className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {label}
        </span>
        <span className="font-mono tabular-nums text-slate-300">
          {away == null ? empty : away}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="ml-auto h-full rounded-full bg-[var(--apex-accent)]"
            style={{ width: `${home ?? 0}%` }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-400"
            style={{ width: `${away ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ContextEngine({ premium }: { premium: PremiumAnalysis }) {
  const p = useTranslations("matchAnalysis.premium");

  return (
    <Section index="05" title={p("contextTitle")} hint={p("contextHint")}>
      {premium.context.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{p("noContext")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {premium.context.map((row) => (
            <ContextFactor key={row.id} factor={row} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ContextFactor({ factor }: { factor: PremiumContextFactor }) {
  const p = useTranslations("matchAnalysis.premium");
  const tone =
    factor.polarity === "plus"
      ? "text-[var(--apex-accent)]"
      : factor.polarity === "minus"
        ? "text-[var(--apex-danger)]"
        : "text-[var(--apex-info)]";
  const mark =
    factor.polarity === "plus" ? "+" : factor.polarity === "minus" ? "−" : "·";

  return (
    <li className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/30 px-4 py-4">
      <p className={cx("font-mono text-xs uppercase tracking-[0.16em]", tone)}>
        {mark} {p(factor.titleKey)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {factor.detail}
      </p>
    </li>
  );
}

function MarketIntelligence({ premium }: { premium: PremiumAnalysis }) {
  const t = useTranslations("matchAnalysis");
  const p = useTranslations("matchAnalysis.premium");
  const empty = t("na");
  const evTone: ApexTone =
    premium.market.expectedValue == null
      ? "neutral"
      : premium.market.expectedValue > 0
        ? "accent"
        : "danger";

  return (
    <Section index="06" title={p("marketTitle")} hint={p("marketHint")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label={p("openingOdds")}
          value={p("openingUnpublished")}
        />
        <Metric
          label={p("currentOdds")}
          value={formatOdds(premium.market.currentOdds, empty)}
          hint={premium.bookmaker ?? p("bookmaker")}
        />
        <Metric
          label={p("fairOdds")}
          value={formatOdds(premium.market.fairOdds, empty)}
          hint={t("fairOddsHint")}
        />
        <Metric
          label={p("estimatedValue")}
          value={formatEv(premium.market.expectedValue, empty)}
          hint={t("evHint")}
          tone={evTone}
        />
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <Metric
          label={p("modelProb")}
          value={formatProb(premium.market.modelProbability, empty)}
        />
        <Metric
          label={p("impliedProb")}
          value={formatProb(premium.market.impliedProbability, empty)}
        />
      </dl>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {p("openingNote")}
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {p(moveCopy[premium.market.move])}
      </p>
    </Section>
  );
}

function MatchSummary({ premium }: { premium: PremiumAnalysis }) {
  const p = useTranslations("matchAnalysis.premium");

  return (
    <Section index="07" title={p("summaryTitle")}>
      <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)] sm:text-lg">
        {premium.summary}
      </p>
    </Section>
  );
}

function EvidenceMeter({ premium }: { premium: PremiumAnalysis }) {
  const p = useTranslations("matchAnalysis.premium");

  return (
    <Section index="08" title={p("evidenceTitle")} hint={p("evidenceHint")}>
      <p className="font-mono text-sm tabular-nums text-[var(--apex-accent)]">
        {p("signalsAligned", {
          aligned: premium.evidence.aligned,
          total: premium.evidence.total,
        })}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {premium.evidence.signals.map((signal) => (
          <li
            key={signal.id}
            className="flex items-center justify-between rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/30 px-4 py-3"
          >
            <span className="text-sm text-[var(--apex-fg)]">
              {p(signal.id)}
            </span>
            <span
              className={cx(
                "font-mono text-sm",
                signal.aligned
                  ? "text-[var(--apex-accent)]"
                  : "text-[var(--apex-fg-subtle)]",
              )}
              aria-label={signal.aligned ? p("aligned") : p("missing")}
            >
              {signal.aligned ? "✔" : "–"}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: ApexTone;
}) {
  const valueClass: Record<ApexTone, string> = {
    neutral: "text-[var(--apex-fg)]",
    accent: "text-[var(--apex-accent)]",
    success: "text-[var(--apex-accent)]",
    warning: "text-[var(--apex-warning)]",
    danger: "text-[var(--apex-danger)]",
    info: "text-[var(--apex-info)]",
  };

  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={cx(
          "mt-1 truncate font-mono text-lg font-semibold tabular-nums",
          valueClass[tone],
        )}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--apex-fg-subtle)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
