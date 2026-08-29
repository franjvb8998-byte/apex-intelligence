"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/design-system";
import { FeedClock } from "@/components/feed/feed-clock";
import {
  formatScanTime,
  formatSignedPct,
} from "@/lib/apex-opportunities/display";
import type { ScannerBriefing } from "@/lib/opportunity-scanner/briefing";

export function ScannerDailyBriefing({
  briefing,
}: {
  briefing: ScannerBriefing;
}) {
  const t = useTranslations("scanner.briefing");
  const common = useTranslations("common");

  function qualityLabel(value: number | null): string {
    if (value == null) return common("notPublished");
    return String(Math.round(value));
  }

  return (
    <Card
      padding="lg"
      className="border-[var(--apex-accent-border)] bg-[linear-gradient(165deg,rgba(0,212,170,0.10)_0%,transparent_42%),#070b14]"
      aria-label={t("eyebrow")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
            {briefing.quotaExhausted ? t("quotaNote") : t("normalNote")}
          </p>
        </div>
        <div className="text-right">
          <FeedClock />
          <p className="mt-1 font-mono text-[11px] text-[var(--apex-fg-subtle)]">
            {t("scan", { time: formatScanTime(briefing.generatedAt) })}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("fixturesAnalyzed")}
          value={String(briefing.fixturesAnalyzed)}
        />
        <Stat
          label={t("competitionsScanned")}
          value={String(briefing.competitionsScanned)}
        />
        <Stat
          label={t("avgMarketQuality")}
          value={qualityLabel(briefing.averageMarketQuality)}
          hint={
            briefing.averageMarketQuality == null
              ? t("avgMarketQualityHintEmpty")
              : t("avgMarketQualityHint")
          }
        />
        <Stat
          label={t("avgConfidence")}
          value={
            briefing.averageConfidence == null
              ? common("notPublished")
              : `${Math.round(briefing.averageConfidence)}%`
          }
        />
        <Stat
          label={t("highestRatedMatch")}
          value={briefing.highestRatedMatch?.label ?? t("waitingFixtures")}
          hint={
            briefing.highestRatedMatch
              ? `${briefing.highestRatedMatch.leagueName} · ${Math.round(briefing.highestRatedMatch.score)}`
              : t("highestRatedHintEmpty")
          }
        />
        <Stat
          label={t("bestLeague")}
          value={briefing.bestLeague?.name ?? common("notPublished")}
          hint={
            briefing.bestLeague
              ? t("bestLeagueHint", {
                  score: Math.round(briefing.bestLeague.averageScore),
                })
              : t("bestLeagueHintEmpty")
          }
        />
        <Stat
          label={t("bestMarket")}
          value={
            briefing.bestMarket ? t("matchResult") : common("notPublished")
          }
          hint={briefing.bestMarket ? t("bestMarketHint") : t("noMarketHint")}
        />
        <Stat
          label={t("avgEv")}
          value={
            briefing.averageEv == null
              ? common("notPublished")
              : formatSignedPct(briefing.averageEv)
          }
          hint={briefing.averageEv == null ? t("avgEvHintEmpty") : t("avgEvHint")}
        />
      </dl>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-black/25 px-3 py-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium leading-snug text-[var(--apex-fg)]">
        {value}
      </dd>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--apex-fg-subtle)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
