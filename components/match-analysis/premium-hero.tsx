"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge, ScoreGauge } from "@/components/design-system";
import { TeamLogo } from "@/components/design-system/team-logo";
import type { ApexTone } from "@/components/design-system/tokens";
import { RatingStat } from "@/components/match-analysis/rating-stat";
import {
  formatEv,
  formatOdds,
  formatScore,
} from "@/components/match-analysis/premium-format";
import { SCORING_BADGE_TONE } from "@/lib/apex-opportunities/display";
import type { PremiumAnalysis } from "@/lib/match-analysis/premium";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import type { ApexRiskBand } from "@/lib/decision-engine/types";

type PremiumHeroProps = {
  data: MatchAnalysisData;
  premium: PremiumAnalysis;
};

const riskTone: Record<ApexRiskBand, ApexTone> = {
  low: "accent",
  medium: "warning",
  high: "danger",
};

const confidenceTone: Record<PremiumAnalysis["confidenceBand"], ApexTone> = {
  high: "accent",
  medium: "warning",
  low: "danger",
};

const statusTone = {
  scheduled: "info",
  live: "danger",
  finished: "neutral",
} as const;

const riskLabelKey: Record<ApexRiskBand, "riskLow" | "riskMedium" | "riskHigh"> = {
  low: "riskLow",
  medium: "riskMedium",
  high: "riskHigh",
};

const confidenceLabelKey: Record<
  PremiumAnalysis["confidenceBand"],
  "confidenceLow" | "confidenceMedium" | "confidenceHigh"
> = {
  high: "confidenceHigh",
  medium: "confidenceMedium",
  low: "confidenceLow",
};

function formatKickoff(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PremiumHero({ data, premium }: PremiumHeroProps) {
  const t = useTranslations("matchAnalysis");
  const p = useTranslations("matchAnalysis.premium");
  const locale = useLocale();
  const empty = t("na");
  const statusLabel = {
    scheduled: t("statusScheduled"),
    live: t("statusLive"),
    finished: t("statusFinished"),
  } as const;
  const evTone: ApexTone =
    premium.expectedValue == null
      ? "neutral"
      : premium.expectedValue > 0
        ? "accent"
        : premium.expectedValue < 0
          ? "danger"
          : "neutral";

  return (
    <header className="overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-accent-border)] bg-[linear-gradient(180deg,rgba(0,212,170,0.08),transparent_42%),#070b14] px-5 py-8 shadow-[var(--apex-shadow-sm)] sm:px-8 sm:py-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
        01 · {p("heroEyebrow")}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-[var(--apex-accent)]">{data.leagueName}</span>
        <span className="text-[var(--apex-fg-subtle)]">·</span>
        <span className="text-[var(--apex-fg-muted)]">
          {formatKickoff(data.kickoffAt, locale)}
        </span>
        <Badge tone={statusTone[data.status]}>{statusLabel[data.status]}</Badge>
      </div>

      <div className="mt-8 flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <TeamBlock
          name={data.homeTeam.name}
          shortName={data.homeTeam.shortName}
          logoUrl={data.homeTeam.logoUrl}
          align="start"
        />
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-[0.35em] text-[var(--apex-fg-subtle)] sm:text-3xl">
            {p("vs")}
          </span>
          <Badge tone={SCORING_BADGE_TONE[premium.tier]} size="md">
            {premium.tier}
          </Badge>
          <p className="max-w-[16rem] text-center text-sm text-[var(--apex-fg-muted)]">
            {premium.selectionLabel}
          </p>
        </div>
        <TeamBlock
          name={data.awayTeam.name}
          shortName={data.awayTeam.shortName}
          logoUrl={data.awayTeam.logoUrl}
          align="end"
        />
      </div>

      <div className="mt-10 grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <ScoreGauge
          value={premium.score}
          label={p("apexScore")}
          caption={premium.confidenceCaption}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <RatingStat
            label={p("confidence")}
            value={formatScore(premium.confidence, empty)}
            hint={p(confidenceLabelKey[premium.confidenceBand])}
            tone={confidenceTone[premium.confidenceBand]}
          />
          <RatingStat
            label={p("risk")}
            value={p(riskLabelKey[premium.riskBand])}
            hint={`${formatScore(premium.riskScore, empty)} / 100`}
            tone={riskTone[premium.riskBand]}
          />
          <RatingStat
            label={p("expectedValue")}
            value={formatEv(premium.expectedValue, empty)}
            hint={t("evHint")}
            tone={evTone}
          />
          <RatingStat
            label={p("fairOdds")}
            value={formatOdds(premium.fairOdds, empty)}
            hint={t("fairOddsHint")}
          />
          <RatingStat
            label={p("bookmakerOdds")}
            value={formatOdds(premium.bookmakerOdds, empty)}
            hint={premium.bookmaker ?? p("bookmaker")}
          />
          <RatingStat
            label={p("opportunity")}
            value={premium.tier}
            hint={premium.selectionLabel}
            tone={SCORING_BADGE_TONE[premium.tier]}
          />
        </div>
      </div>
    </header>
  );
}

function TeamBlock({
  name,
  shortName,
  logoUrl,
  align,
}: {
  name: string;
  shortName: string;
  logoUrl?: string | null;
  align: "start" | "end";
}) {
  const alignClass =
    align === "start"
      ? "sm:items-start sm:text-left"
      : "sm:items-end sm:text-right";

  return (
    <div
      className={`flex flex-1 flex-col items-center gap-3 text-center ${alignClass}`}
    >
      <TeamLogo src={logoUrl} name={name} shortName={shortName} size="lg" />
      <h2 className="text-xl font-semibold text-[var(--apex-fg)] sm:text-2xl">
        {name}
      </h2>
    </div>
  );
}
