import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app-shell/states";
import { Badge } from "@/components/design-system/badge";
import { Card, CardHeader } from "@/components/design-system/card";
import { TeamLogo } from "@/components/design-system/team-logo";
import type {
  DashboardMatchStatus,
  DashboardMatchSummary,
} from "@/lib/dashboard/types";
import {
  fixtureIdFromMatch,
  matchCenterHref,
  matchesFixtureId,
} from "@/lib/match-center/fixture-id";

function statusTone(
  status: DashboardMatchStatus,
): "accent" | "warning" | "neutral" | "info" {
  switch (status) {
    case "live":
      return "accent";
    case "scheduled":
      return "info";
    case "finished":
      return "neutral";
    default:
      return "warning";
  }
}

function formatKickoff(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function scoreLine(match: DashboardMatchSummary, vs: string): string {
  if (match.score.home == null && match.score.away == null) return vs;
  return `${match.score.home ?? "—"} – ${match.score.away ?? "—"}`;
}

type MatchListSectionProps = {
  title: string;
  description: string;
  matches: DashboardMatchSummary[];
  emptyLabel: string;
  selectedFixtureId?: string | null;
  hrefForFixture?: (fixtureId: string) => string;
};

export async function DashboardMatchList({
  title,
  description,
  matches,
  emptyLabel,
  selectedFixtureId,
  hrefForFixture = matchCenterHref,
}: MatchListSectionProps) {
  const t = await getTranslations("dashboard");
  const common = await getTranslations("common");
  const locale = await getLocale();

  function statusLabel(status: DashboardMatchStatus): string {
    switch (status) {
      case "live":
        return t("live");
      case "scheduled":
        return t("scheduled");
      case "finished":
        return t("finished");
      case "postponed":
        return t("postponed");
      case "cancelled":
        return t("cancelled");
      default:
        return "—";
    }
  }

  return (
    <Card padding="md">
      <CardHeader title={title} description={description} />
      {matches.length === 0 ? (
        <EmptyState title={t("noMatches")} description={emptyLabel} />
      ) : (
        <ul className="divide-y divide-[var(--apex-border)]">
          {matches.map((match) => {
            const fixtureId = fixtureIdFromMatch(match);
            const href = fixtureId ? hrefForFixture(fixtureId) : null;
            const selected = matchesFixtureId(match, selectedFixtureId);
            return (
              <li
                key={match.id}
                className={
                  selected
                    ? "rounded-[var(--apex-radius-md)] bg-[var(--apex-accent-muted)]/40 py-3 first:pt-3 last:pb-3"
                    : "py-3 first:pt-0 last:pb-0"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--apex-fg)]">
                      <TeamLogo
                        src={match.homeTeam.logoUrl}
                        name={match.homeTeam.name}
                        shortName={match.homeTeam.shortName}
                        size="sm"
                      />
                      <span className="min-w-0 truncate">{match.homeTeam.name}</span>
                      <span className="shrink-0 text-[var(--apex-fg-subtle)]">
                        {scoreLine(match, common("vs"))}
                      </span>
                      <TeamLogo
                        src={match.awayTeam.logoUrl}
                        name={match.awayTeam.name}
                        shortName={match.awayTeam.shortName}
                        size="sm"
                      />
                      <span className="min-w-0 truncate">{match.awayTeam.name}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
                      {match.leagueName ?? common("league")} ·{" "}
                      {formatKickoff(match.kickoffAt, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(match.status)}>
                      {statusLabel(match.status)}
                    </Badge>
                    {href && (
                      <Link
                        href={href}
                        prefetch={false}
                        className="apex-focusable relative z-10 rounded-[var(--apex-radius-md)] px-2 py-1 text-xs text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
                      >
                        {t("view")}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
