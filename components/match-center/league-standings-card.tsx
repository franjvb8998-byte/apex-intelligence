"use client";

import { useTranslations } from "next-intl";
import { Badge, Card, CardHeader } from "@/components/design-system";
import type { MatchCenterStanding } from "@/lib/match-center/types";

function signedDiff(value: number | null): string {
  if (value == null) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

function StandingColumn({
  side,
  standing,
}: {
  side: string;
  standing: MatchCenterStanding;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--apex-fg)]">
          {standing.teamName}
        </p>
        <Badge tone="accent">#{standing.rank}</Badge>
      </div>
      <p className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {side}
      </p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Pts" value={standing.points} />
        <Stat label="PJ" value={standing.played} />
        <Stat label="DG" value={signedDiff(standing.goalsDiff)} />
      </dl>
      <p className="text-xs text-[var(--apex-fg-muted)]">
        {standing.wins ?? "—"}V · {standing.draws ?? "—"}E ·{" "}
        {standing.losses ?? "—"}D
      </p>
      <p className="text-xs text-[var(--apex-fg-muted)]">
        GF {standing.goalsFor ?? "—"} · GC {standing.goalsAgainst ?? "—"}
      </p>
      {standing.form ? (
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--apex-fg-subtle)]">
          {standing.form}
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--apex-fg)]">
        {value ?? "—"}
      </dd>
    </div>
  );
}

type LeagueStandingsCardProps = {
  home: MatchCenterStanding | null;
  away: MatchCenterStanding | null;
  leagueName?: string;
};

export function LeagueStandingsCard({
  home,
  away,
  leagueName,
}: LeagueStandingsCardProps) {
  const t = useTranslations("matchCenter");
  const common = useTranslations("common");
  const empty = !home && !away;
  return (
    <Card>
      <CardHeader
        title={t("standings")}
        description={
          leagueName
            ? t("standingsDescription", { league: leagueName })
            : t("standingsDescriptionFallback")
        }
      />
      {empty ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("standingsEmpty")}
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {home && <StandingColumn side={common("home")} standing={home} />}
          {away && <StandingColumn side={common("away")} standing={away} />}
        </div>
      )}
    </Card>
  );
}
