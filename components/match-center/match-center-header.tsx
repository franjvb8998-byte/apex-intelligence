"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Badge,
  Card,
  TeamLogo,
} from "@/components/design-system";
import type { MatchCenterMeta, MatchCenterPhase } from "@/lib/match-center/types";

function formatKickoff(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

const statusTone = {
  scheduled: "info" as const,
  live: "danger" as const,
  finished: "success" as const,
};

type MatchCenterHeaderProps = {
  match: MatchCenterMeta;
  phase: MatchCenterPhase;
  sourceLabel?: string;
};

/**
 * Brand + match identity for Match Center™.
 * Presentational — data arrives via props (mock or future API).
 */
export function MatchCenterHeader({
  match,
  phase,
  sourceLabel,
}: MatchCenterHeaderProps) {
  const t = useTranslations("matchCenter");
  const dashboard = useTranslations("dashboard");
  const locale = useLocale();
  const statusLabel = {
    scheduled: dashboard("scheduled"),
    live: dashboard("live"),
    finished: dashboard("finished"),
  } as const;
  const phaseEyebrow: Record<MatchCenterPhase, string> = {
    preview: t("headerPreview"),
    live: t("headerLive"),
    post: t("headerPost"),
  };
  return (
    <header className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" size="md">
            APEX Match Center™
          </Badge>
          <Badge tone={statusTone[match.status]}>
            {statusLabel[match.status]}
          </Badge>
          {(match.source === "mock" || sourceLabel) && (
            <Badge tone="info">{sourceLabel ?? dashboard("modeCatalog")}</Badge>
          )}
          {match.source === "data-platform" && (
            <Badge tone="info">
              Data Platform · {match.providerLabel ?? dashboard("modeCatalog")}
            </Badge>
          )}
        </div>

        <div>
          <p className="text-sm text-[var(--apex-fg-muted)]" suppressHydrationWarning>
            {match.leagueName}
            <span className="mx-2 text-[var(--apex-fg-subtle)]">·</span>
            {formatKickoff(match.kickoffAt, locale)}
            {match.venue?.name ? (
              <>
                <span className="mx-2 text-[var(--apex-fg-subtle)]">·</span>
                {match.venue.name}
                {match.venue.city ? `, ${match.venue.city}` : ""}
              </>
            ) : null}
            {match.referee ? (
              <>
                <span className="mx-2 text-[var(--apex-fg-subtle)]">·</span>
                {t("referee", { name: match.referee })}
              </>
            ) : null}
          </p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <TeamLogo
              src={match.homeTeam.logoUrl}
              name={match.homeTeam.name}
              shortName={match.homeTeam.shortName}
              size="md"
            />
            {match.homeTeam.name}{" "}
            <span className="text-[var(--apex-fg-subtle)]">vs</span>{" "}
            <TeamLogo
              src={match.awayTeam.logoUrl}
              name={match.awayTeam.name}
              shortName={match.awayTeam.shortName}
              size="md"
            />
            {match.awayTeam.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--apex-fg-muted)]">
            {t("headerDescription", { phase: phaseEyebrow[phase] })}
          </p>
        </div>
      </div>

      <Card padding="sm" className="grid grid-cols-3 items-center gap-3">
        <TeamCell
          short={match.homeTeam.shortName}
          name={match.homeTeam.name}
          logoUrl={match.homeTeam.logoUrl}
          align="start"
        />
        <div className="text-center">
          <p className="font-mono text-2xl font-bold tracking-[0.2em] text-[var(--apex-fg-subtle)]">
            VS
          </p>
        </div>
        <TeamCell
          short={match.awayTeam.shortName}
          name={match.awayTeam.name}
          logoUrl={match.awayTeam.logoUrl}
          align="end"
        />
      </Card>
    </header>
  );
}

function TeamCell({
  short,
  name,
  logoUrl,
  align,
}: {
  short: string;
  name: string;
  logoUrl: string | null;
  align: "start" | "end";
}) {
  return (
    <div
      className={
        align === "start"
          ? "flex flex-col items-start gap-1"
          : "flex flex-col items-end gap-1 text-right"
      }
    >
      <TeamLogo src={logoUrl} name={name} shortName={short} size="lg" />
      <span className="hidden text-xs text-[var(--apex-fg-muted)] sm:block">
        {name}
      </span>
    </div>
  );
}
