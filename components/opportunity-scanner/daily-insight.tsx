"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/design-system";
import type { ScannerInsight } from "@/lib/opportunity-scanner/briefing";

export function ScannerDailyInsight({ insight }: { insight: ScannerInsight }) {
  const t = useTranslations("scanner.insight");

  const unpublished = t("notPublishedYet");
  const emptyWhy = insight.quotaExhausted ? t("quotaWhy") : t("emptyWhy");

  const strongestLeague = insight.catalogEmpty
    ? unpublished
    : (insight.strongestLeagueName ?? t("evenlySpread"));
  const strongestLeagueDetail = insight.catalogEmpty
    ? emptyWhy
    : insight.strongestLeagueName
      ? t("strongestLeagueDetail")
      : t("strongestLeagueDetailEmpty");

  const highestConfidence = insight.catalogEmpty
    ? unpublished
    : insight.averageConfidence == null
      ? unpublished
      : `${Math.round(insight.averageConfidence)}%`;
  const highestConfidenceDetail = insight.catalogEmpty
    ? emptyWhy
    : insight.averageConfidence == null
      ? t("confidenceDetailEmpty")
      : t("confidenceDetail");

  const attractiveMarket = insight.catalogEmpty
    ? unpublished
    : insight.hasMarket
      ? t("matchResult")
      : unpublished;
  const attractiveMarketDetail = insight.catalogEmpty
    ? emptyWhy
    : insight.hasMarket
      ? t("marketDetail")
      : t("marketDetailEmpty");

  const interestingMatch = insight.catalogEmpty
    ? unpublished
    : (insight.interestingMatch?.label ?? unpublished);
  const interestingMatchDetail = insight.catalogEmpty
    ? emptyWhy
    : insight.interestingMatch
      ? t("matchDetail", {
          league: insight.interestingMatch.leagueName,
          score: Math.round(insight.interestingMatch.score),
        })
      : t("matchDetailEmpty");

  return (
    <Card
      padding="lg"
      className="border-[var(--apex-accent-border)]/70 bg-[#070b14]"
      aria-label={t("eyebrow")}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
        {t("eyebrow")}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--apex-fg)]">
        {t("title")}
      </h3>
      <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">{t("subtitle")}</p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <Insight
          label={t("strongestLeague")}
          value={strongestLeague}
          detail={strongestLeagueDetail}
        />
        <Insight
          label={t("highestConfidence")}
          value={highestConfidence}
          detail={highestConfidenceDetail}
        />
        <Insight
          label={t("attractiveMarket")}
          value={attractiveMarket}
          detail={attractiveMarketDetail}
        />
        <Insight
          label={t("interestingMatch")}
          value={interestingMatch}
          detail={interestingMatchDetail}
        />
      </dl>
    </Card>
  );
}

function Insight({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium text-[var(--apex-fg)]">{value}</dd>
      <p className="mt-1 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
        {detail}
      </p>
    </div>
  );
}
