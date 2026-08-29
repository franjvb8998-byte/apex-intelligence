"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterTeamTrends } from "@/lib/match-center/types";

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function avg(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

function TrendSide({
  name,
  trends,
}: {
  name: string;
  trends: MatchCenterTeamTrends;
}) {
  const t = useTranslations("matchCenter");
  const common = useTranslations("common");
  const recentLabel =
    trends.recentSample > 0
      ? t("lastN", { count: trends.recentSample })
      : t("season");
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-[var(--apex-fg)]">{name}</p>
        <p className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {recentLabel}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <Stat
          label={t("gfPerMatch")}
          value={avg(trends.goalsScoredAvg)}
          hint={
            trends.seasonGoalsScoredAvg != null
              ? t("seasonHint", { value: avg(trends.seasonGoalsScoredAvg) })
              : null
          }
        />
        <Stat
          label={t("gaPerMatch")}
          value={avg(trends.goalsConcededAvg)}
          hint={
            trends.seasonGoalsConcededAvg != null
              ? t("seasonHint", { value: avg(trends.seasonGoalsConcededAvg) })
              : null
          }
        />
        <Stat
          label={t("cleanSheets")}
          value={
            trends.cleanSheets != null ? String(trends.cleanSheets) : "—"
          }
          hint={
            trends.seasonCleanSheets != null
              ? t("seasonHint", { value: trends.seasonCleanSheets })
              : trends.cleanSheetPct != null
                ? pct(trends.cleanSheetPct)
                : null
          }
        />
        <Stat label="BTTS" value={pct(trends.bttsPct)} />
        <Stat
          label={common("over25")}
          value={pct(trends.over25Pct)}
          className="col-span-2"
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-3 py-2.5 ${className ?? ""}`}
    >
      <dt className="text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg tabular-nums text-[var(--apex-fg)]">
        {value}
      </dd>
      {hint ? (
        <p className="mt-1 text-[11px] text-[var(--apex-fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

type TeamTrendsCardProps = {
  homeName: string;
  awayName: string;
  home: MatchCenterTeamTrends | null;
  away: MatchCenterTeamTrends | null;
};

export function TeamTrendsCard({
  homeName,
  awayName,
  home,
  away,
}: TeamTrendsCardProps) {
  const t = useTranslations("matchCenter");
  const empty = !home && !away;
  return (
    <Card>
      <CardHeader
        title={t("trendsTitle")}
        description={t("trendsDescription")}
      />
      {empty ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("noTrends")}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {home && <TrendSide name={homeName} trends={home} />}
          {away && <TrendSide name={awayName} trends={away} />}
        </div>
      )}
    </Card>
  );
}
